package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"time"

	bolt "go.etcd.io/bbolt"
)

// Event mirrors the client's item shape. Reminders are timezone-proof: the client
// computes dueAt (epoch ms, the on-time moment) from local date+time, so the server
// never has to reason about the user's timezone.
type Event struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Type        *string   `json:"type"`
	Date        *string   `json:"date"`
	Time        *string   `json:"time"`
	DueAt       *int64    `json:"dueAt"`       // epoch ms of the scheduled time
	PreAlarmMin *int      `json:"preAlarmMin"` // lead-time pre-alarm in minutes
	Subtasks    []Subtask `json:"subtasks"`
	Completed   bool      `json:"completed"`
	CompletedAt *int64    `json:"completedAt"`
	Deleted     bool      `json:"deleted"` // tombstone - synced so deletes propagate, never reminded
	Repeat      *string   `json:"repeat"`  // null|daily|weekdays|weekly - round-tripped for sync
	CreatedAt   int64     `json:"createdAt"`
	UpdatedAt   int64     `json:"updatedAt"`
}

type Subtask struct {
	ID   string `json:"id"`
	Text string `json:"text"`
	Done bool   `json:"done"`
}

// Layout (multi-tenant):
//   users/<userKey>/events  -> id -> Event json
//   users/<userKey>/subs    -> endpoint -> raw browser PushSubscription json
//   users/<userKey>/fired   -> "id:kind:dueAt" -> 1   (reminder de-dupe)
//   meta/                    -> server-wide VAPID keys
//
// userKey is sha256(client token); a client's data is fully isolated under it.
var (
	bUsers = []byte("users")
	bMeta  = []byte("meta")

	subEvents = []byte("events")
	subSubs   = []byte("subs")
	subFired  = []byte("fired")

	errNotFound = errors.New("not found")
)

type Store struct{ db *bolt.DB }

func OpenStore(path string) (*Store, error) {
	db, err := bolt.Open(path, 0o600, &bolt.Options{Timeout: 3 * time.Second})
	if err != nil {
		return nil, err
	}
	err = db.Update(func(tx *bolt.Tx) error {
		for _, b := range [][]byte{bUsers, bMeta} {
			if _, e := tx.CreateBucketIfNotExists(b); e != nil {
				return e
			}
		}
		return nil
	})
	if err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

// leaf returns the named sub-bucket for a user, creating the path when create=true.
// On reads it returns (nil, nil) if the user/bucket doesn't exist yet.
func leaf(tx *bolt.Tx, userKey string, name []byte, create bool) (*bolt.Bucket, error) {
	users := tx.Bucket(bUsers)
	if create {
		ub, err := users.CreateBucketIfNotExists([]byte(userKey))
		if err != nil {
			return nil, err
		}
		return ub.CreateBucketIfNotExists(name)
	}
	ub := users.Bucket([]byte(userKey))
	if ub == nil {
		return nil, nil
	}
	return ub.Bucket(name), nil
}

func (s *Store) PutEvent(userKey string, e *Event) error {
	// Preserve the client's last-write-wins clock; only stamp if missing. Overwriting it
	// here would corrupt cross-device merge ordering.
	if e.UpdatedAt == 0 {
		e.UpdatedAt = time.Now().UnixMilli()
	}
	return s.db.Update(func(tx *bolt.Tx) error {
		eb, err := leaf(tx, userKey, subEvents, true)
		if err != nil {
			return err
		}
		var old Event
		hadOld := false
		if raw := eb.Get([]byte(e.ID)); raw != nil {
			hadOld = json.Unmarshal(raw, &old) == nil
		}
		raw, err := json.Marshal(e)
		if err != nil {
			return err
		}
		if err := eb.Put([]byte(e.ID), raw); err != nil {
			return err
		}
		// When the timing/relevance changes (e.g. reschedule, snooze, un-complete),
		// drop stale fired-guard keys so the reminder can fire again.
		if hadOld && changedTiming(&old, e) {
			if fb, ferr := leaf(tx, userKey, subFired, false); ferr == nil && fb != nil {
				clearFiredFor(fb, e.ID)
			}
		}
		return nil
	})
}

func (s *Store) DeleteEvent(userKey, id string) error {
	return s.db.Update(func(tx *bolt.Tx) error {
		if eb, err := leaf(tx, userKey, subEvents, false); err == nil && eb != nil {
			_ = eb.Delete([]byte(id))
		}
		if fb, err := leaf(tx, userKey, subFired, false); err == nil && fb != nil {
			clearFiredFor(fb, id)
		}
		return nil
	})
}

func eqI64(a, b *int64) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}
func eqInt(a, b *int) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}
func changedTiming(a, b *Event) bool {
	return !eqI64(a.DueAt, b.DueAt) || !eqInt(a.PreAlarmMin, b.PreAlarmMin) || a.Completed != b.Completed || a.Deleted != b.Deleted
}

// clearFiredFor deletes every "<id>:..." fired-guard key (ids contain no ':').
func clearFiredFor(b *bolt.Bucket, id string) {
	prefix := []byte(id + ":")
	c := b.Cursor()
	var keys [][]byte
	for k, _ := c.Seek(prefix); k != nil && bytes.HasPrefix(k, prefix); k, _ = c.Next() {
		cp := make([]byte, len(k))
		copy(cp, k)
		keys = append(keys, cp)
	}
	for _, k := range keys {
		_ = b.Delete(k)
	}
}

func (s *Store) ListEvents(userKey string) ([]*Event, error) {
	var out []*Event
	err := s.db.View(func(tx *bolt.Tx) error {
		b, err := leaf(tx, userKey, subEvents, false)
		if err != nil || b == nil {
			return err
		}
		return b.ForEach(func(_, v []byte) error {
			var e Event
			if err := json.Unmarshal(v, &e); err != nil {
				return nil // skip a corrupt record rather than failing the whole list
			}
			out = append(out, &e)
			return nil
		})
	})
	return out, err
}

// ---- push subscriptions ----

func (s *Store) PutSub(userKey, endpoint string, raw []byte) error {
	return s.db.Update(func(tx *bolt.Tx) error {
		b, err := leaf(tx, userKey, subSubs, true)
		if err != nil {
			return err
		}
		return b.Put([]byte(endpoint), raw)
	})
}

func (s *Store) DeleteSub(userKey, endpoint string) error {
	return s.db.Update(func(tx *bolt.Tx) error {
		b, err := leaf(tx, userKey, subSubs, false)
		if err != nil || b == nil {
			return err
		}
		return b.Delete([]byte(endpoint))
	})
}

func (s *Store) ListSubs(userKey string) (map[string][]byte, error) {
	out := map[string][]byte{}
	err := s.db.View(func(tx *bolt.Tx) error {
		b, err := leaf(tx, userKey, subSubs, false)
		if err != nil || b == nil {
			return err
		}
		return b.ForEach(func(k, v []byte) error {
			cp := make([]byte, len(v))
			copy(cp, v)
			out[string(k)] = cp
			return nil
		})
	})
	return out, err
}

// ---- fired-reminder guard ----

func (s *Store) AlreadyFired(userKey, key string) (bool, error) {
	var found bool
	err := s.db.View(func(tx *bolt.Tx) error {
		b, err := leaf(tx, userKey, subFired, false)
		if err != nil || b == nil {
			return err
		}
		found = b.Get([]byte(key)) != nil
		return nil
	})
	return found, err
}

func (s *Store) MarkFired(userKey, key string) error {
	return s.db.Update(func(tx *bolt.Tx) error {
		b, err := leaf(tx, userKey, subFired, true)
		if err != nil {
			return err
		}
		return b.Put([]byte(key), []byte{1})
	})
}

// ListUserKeys enumerates every tenant (for the scheduler).
func (s *Store) ListUserKeys() ([]string, error) {
	var keys []string
	err := s.db.View(func(tx *bolt.Tx) error {
		return tx.Bucket(bUsers).ForEach(func(k, _ []byte) error {
			keys = append(keys, string(k))
			return nil
		})
	})
	return keys, err
}

// ---- meta (server-wide vapid keys) ----

func (s *Store) GetMeta(key string) (string, error) {
	var val string
	err := s.db.View(func(tx *bolt.Tx) error {
		v := tx.Bucket(bMeta).Get([]byte(key))
		if v == nil {
			return errNotFound
		}
		val = string(v)
		return nil
	})
	return val, err
}

func (s *Store) SetMeta(key, val string) error {
	return s.db.Update(func(tx *bolt.Tx) error {
		return tx.Bucket(bMeta).Put([]byte(key), []byte(val))
	})
}
