package main

import (
	"context"
	"fmt"
	"log"
	"time"
)

// fireWindowMs: once a trigger time passes we still fire if we're within this window,
// so a reminder is never silently skipped - but an event due hours ago (e.g. after the
// server was down) won't spam late. Matches the client's engine.
const fireWindowMs int64 = 120_000

// RunScheduler checks every 30s for due reminders (on-time + lead-time pre-alarm) and
// sends a Web Push for each, guarding against double-fires with a persisted "fired" key.
func RunScheduler(ctx context.Context, store *Store, pusher *Pusher) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	tick(store, pusher) // run once at startup
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			tick(store, pusher)
		}
	}
}

func tick(store *Store, pusher *Pusher) {
	now := time.Now().UnixMilli()
	userKeys, err := store.ListUserKeys()
	if err != nil {
		log.Printf("scheduler: list users: %v", err)
		return
	}
	for _, uk := range userKeys {
		events, err := store.ListEvents(uk)
		if err != nil {
			log.Printf("scheduler: list events: %v", err)
			continue
		}
		for _, e := range events {
			if e.Completed || e.Deleted || e.DueAt == nil {
				continue
			}
			due := *e.DueAt
			maybeFire(store, pusher, uk, e, "on", due, due, now)
			if e.PreAlarmMin != nil && *e.PreAlarmMin > 0 {
				trigger := due - int64(*e.PreAlarmMin)*60_000
				maybeFire(store, pusher, uk, e, "pre", trigger, due, now)
			}
		}
	}
}

func maybeFire(store *Store, pusher *Pusher, userKey string, e *Event, kind string, triggerMs, dueMs, now int64) {
	if now < triggerMs || now >= triggerMs+fireWindowMs {
		return
	}
	key := fmt.Sprintf("%s:%s:%d", e.ID, kind, dueMs)
	fired, err := store.AlreadyFired(userKey, key)
	if err != nil || fired {
		return
	}
	if err := store.MarkFired(userKey, key); err != nil {
		log.Printf("scheduler: mark fired: %v", err)
		return
	}

	title := "Now: " + e.Title
	body := "It's time."
	if kind == "pre" {
		title = "Heads up - " + e.Title
		body = fmt.Sprintf("Coming up in %d min. Want to wrap up first?", *e.PreAlarmMin)
	}
	log.Printf("scheduler: firing %s reminder for %q", kind, e.Title)
	pusher.SendTo(userKey, map[string]any{
		"title": title,
		"body":  body,
		"tag":   e.ID,
		"url":   "/",
	})
}
