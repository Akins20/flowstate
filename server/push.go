package main

import (
	"encoding/json"
	"log"
	"net/http"

	webpush "github.com/SherClockHolmes/webpush-go"
)

// Pusher holds the VAPID identity and sends Web Push messages.
type Pusher struct {
	store      *Store
	publicKey  string
	privateKey string
	subject    string // e.g. "mailto:you@example.com"
}

// NewPusher loads the VAPID keypair from the store, generating + persisting one on first run.
func NewPusher(store *Store, subject string) (*Pusher, error) {
	priv, err := store.GetMeta("vapid_private")
	pub, err2 := store.GetMeta("vapid_public")
	if err != nil || err2 != nil || priv == "" || pub == "" {
		priv, pub, err = webpush.GenerateVAPIDKeys()
		if err != nil {
			return nil, err
		}
		if err = store.SetMeta("vapid_private", priv); err != nil {
			return nil, err
		}
		if err = store.SetMeta("vapid_public", pub); err != nil {
			return nil, err
		}
		log.Println("generated a new VAPID keypair")
	}
	return &Pusher{store: store, publicKey: pub, privateKey: priv, subject: subject}, nil
}

func (p *Pusher) PublicKey() string { return p.publicKey }

// SendTo delivers a payload to every subscription belonging to one tenant,
// pruning ones the push service reports as gone (404/410).
func (p *Pusher) SendTo(userKey string, payload any) {
	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("push: marshal payload: %v", err)
		return
	}
	subs, err := p.store.ListSubs(userKey)
	if err != nil {
		log.Printf("push: list subs: %v", err)
		return
	}
	for endpoint, raw := range subs {
		var sub webpush.Subscription
		if err := json.Unmarshal(raw, &sub); err != nil {
			log.Printf("push: bad subscription, removing: %v", err)
			_ = p.store.DeleteSub(userKey, endpoint)
			continue
		}
		resp, err := webpush.SendNotification(body, &sub, &webpush.Options{
			Subscriber:      p.subject,
			VAPIDPublicKey:  p.publicKey,
			VAPIDPrivateKey: p.privateKey,
			TTL:             60,
			Urgency:         webpush.UrgencyHigh,
		})
		if err != nil {
			log.Printf("push: send error: %v", err)
			continue
		}
		resp.Body.Close()
		if resp.StatusCode == http.StatusGone || resp.StatusCode == http.StatusNotFound {
			_ = p.store.DeleteSub(userKey, endpoint)
			log.Printf("push: pruned expired subscription")
		}
	}
}
