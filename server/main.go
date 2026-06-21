package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

// A client's bearer token must be at least this long; its sha256 is the tenant key.
const minTokenLen = 20

type Config struct {
	Addr           string   // listen address, e.g. 127.0.0.1:8091 (nginx terminates TLS)
	DataDir        string   // bbolt location
	AllowedOrigins []string // CORS allowlist (comma-separated in env); "*" allows any
	VAPIDSubject   string   // mailto:… or an https URL
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func splitAndTrim(s string) []string {
	parts := strings.Split(s, ",")
	out := parts[:0]
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// allowedOrigin returns the value to echo in Access-Control-Allow-Origin, or "" if the
// request's Origin isn't allowed.
func (c Config) allowedOrigin(origin string) string {
	for _, o := range c.AllowedOrigins {
		if o == "*" {
			return "*"
		}
		if o == origin && origin != "" {
			return origin
		}
	}
	return ""
}

type Server struct {
	cfg    Config
	store  *Store
	pusher *Pusher
}

type ctxKey string

const userKeyCtx ctxKey = "userKey"

func userKeyOf(r *http.Request) string {
	v, _ := r.Context().Value(userKeyCtx).(string)
	return v
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lmsgprefix)
	log.SetPrefix("flowstate: ")

	cfg := Config{
		Addr:           env("ADDR", "127.0.0.1:8091"),
		DataDir:        env("DATA_DIR", "./data"),
		AllowedOrigins: splitAndTrim(env("ALLOWED_ORIGIN", "*")),
		VAPIDSubject:   env("VAPID_SUBJECT", "mailto:admin@example.com"),
	}
	if err := os.MkdirAll(cfg.DataDir, 0o750); err != nil {
		log.Fatalf("create data dir: %v", err)
	}

	store, err := OpenStore(filepath.Join(cfg.DataDir, "flowstate.db"))
	if err != nil {
		log.Fatalf("open store: %v", err)
	}
	defer store.Close()

	pusher, err := NewPusher(store, cfg.VAPIDSubject)
	if err != nil {
		log.Fatalf("init pusher: %v", err)
	}

	srv := &Server{cfg: cfg, store: store, pusher: pusher}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go RunScheduler(ctx, store, pusher)

	httpSrv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           srv.routes(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("listening on %s (origins %s)", cfg.Addr, strings.Join(cfg.AllowedOrigins, ", "))
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("http: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down…")
	shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutCtx)
}

func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET /api/config", s.handleConfig) // public VAPID key
	mux.HandleFunc("GET /api/events", s.auth(s.handleListEvents))
	mux.HandleFunc("PUT /api/events/{id}", s.auth(s.handlePutEvent)) // upsert
	mux.HandleFunc("DELETE /api/events/{id}", s.auth(s.handleDeleteEvent))
	mux.HandleFunc("POST /api/subscribe", s.auth(s.handleSubscribe))
	mux.HandleFunc("POST /api/unsubscribe", s.auth(s.handleUnsubscribe))
	mux.HandleFunc("POST /api/test-push", s.auth(s.handleTestPush))
	return s.cors(mux)
}

// ---- middleware ----

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Vary", "Origin")
		if allow := s.cfg.allowedOrigin(r.Header.Get("Origin")); allow != "" {
			w.Header().Set("Access-Control-Allow-Origin", allow)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Max-Age", "86400")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// auth turns the client's bearer token into an isolated tenant key (sha256 of the token).
// No central account list: possession of a sufficiently-long random token grants access
// to that token's namespace only.
func (s *Server) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tok := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		if len(tok) < minTokenLen {
			writeErr(w, http.StatusUnauthorized, "missing or too-short sync token")
			return
		}
		sum := sha256.Sum256([]byte(tok))
		uk := hex.EncodeToString(sum[:])
		next(w, r.WithContext(context.WithValue(r.Context(), userKeyCtx, uk)))
	}
}

// ---- handlers ----

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleConfig(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"vapidPublicKey": s.pusher.PublicKey()})
}

func (s *Server) handleListEvents(w http.ResponseWriter, r *http.Request) {
	events, err := s.store.ListEvents(userKeyOf(r))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "list failed")
		return
	}
	if events == nil {
		events = []*Event{}
	}
	writeJSON(w, http.StatusOK, events)
}

func (s *Server) handlePutEvent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var e Event
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&e); err != nil {
		writeErr(w, http.StatusBadRequest, "bad json")
		return
	}
	e.ID = id
	if e.CreatedAt == 0 {
		e.CreatedAt = time.Now().UnixMilli()
	}
	if err := s.store.PutEvent(userKeyOf(r), &e); err != nil {
		writeErr(w, http.StatusInternalServerError, "save failed")
		return
	}
	writeJSON(w, http.StatusOK, &e)
}

func (s *Server) handleDeleteEvent(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteEvent(userKeyOf(r), r.PathValue("id")); err != nil {
		writeErr(w, http.StatusInternalServerError, "delete failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleSubscribe(w http.ResponseWriter, r *http.Request) {
	raw, err := readBody(w, r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "bad body")
		return
	}
	var sub struct {
		Endpoint string `json:"endpoint"`
	}
	if err := json.Unmarshal(raw, &sub); err != nil || sub.Endpoint == "" {
		writeErr(w, http.StatusBadRequest, "missing endpoint")
		return
	}
	if err := s.store.PutSub(userKeyOf(r), sub.Endpoint, raw); err != nil {
		writeErr(w, http.StatusInternalServerError, "save failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "subscribed"})
}

func (s *Server) handleUnsubscribe(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Endpoint string `json:"endpoint"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&body); err != nil || body.Endpoint == "" {
		writeErr(w, http.StatusBadRequest, "missing endpoint")
		return
	}
	_ = s.store.DeleteSub(userKeyOf(r), body.Endpoint)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleTestPush(w http.ResponseWriter, r *http.Request) {
	s.pusher.SendTo(userKeyOf(r), map[string]any{"title": "Skafld", "body": "Push is working 🎉", "url": "/"})
	writeJSON(w, http.StatusOK, map[string]string{"status": "sent"})
}

// ---- helpers ----

func readBody(w http.ResponseWriter, r *http.Request) ([]byte, error) {
	defer r.Body.Close()
	return io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}
