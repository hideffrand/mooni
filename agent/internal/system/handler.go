package system

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"mooni-backend/internal/cache"
)

// statsCacheTTL is short: stats are a polled dashboard, and CPU sampling
// itself sleeps ~200ms, so caching a few seconds cuts both load and latency.
const statsCacheTTL = 5 * time.Second

type Handler struct {
	rootDir string
	confirm *confirmStore
	cache   cache.Cache
}

func NewHandler(rootDir string, cache cache.Cache) *Handler {
	return &Handler{rootDir: rootDir, confirm: newConfirmStore(), cache: cache}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/system/stats", h.stats)
	mux.HandleFunc("POST /api/system/confirm-token", h.issueToken)
	mux.HandleFunc("POST /api/system/reboot", h.reboot)
	mux.HandleFunc("POST /api/system/shutdown", h.shutdown)
}

func (h *Handler) stats(w http.ResponseWriter, r *http.Request) {
	if b, ok := h.cache.Get(r.Context(), "mooni:system:stats"); ok {
		w.Header().Set("Content-Type", "application/json")
		w.Write(b)
		return
	}
	s, err := Collect(h.rootDir)
	if err != nil {
		log.Println("system stats error:", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	b, err := json.Marshal(s)
	if err != nil {
		log.Println("system stats marshal error:", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	h.cache.Set(r.Context(), "mooni:system:stats", b, statsCacheTTL)
	w.Header().Set("Content-Type", "application/json")
	w.Write(b)
}

func (h *Handler) reboot(w http.ResponseWriter, r *http.Request) {
	h.power(w, r, "reboot")
}

func (h *Handler) shutdown(w http.ResponseWriter, r *http.Request) {
	h.power(w, r, "shutdown")
}

func (h *Handler) issueToken(w http.ResponseWriter, r *http.Request) {
	tok, err := h.confirm.issue()
	if err != nil {
		log.Println("issue confirm token error:", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"token": tok, "expiresInSeconds": "60"})
}

func (h *Handler) power(w http.ResponseWriter, r *http.Request, action string) {
	// A fresh single-use confirm token must precede the call (replay protection).
	if !h.confirm.consume(r.Header.Get("X-Confirm-Token")) {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error": "missing or expired confirm token; request a fresh one first",
		})
		return
	}
	// Detached from the request: must run even if the phone disconnects mid-reboot.
	if err := runPower(action); err != nil {
		log.Printf("power %s error: %v", action, err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "power control failed. Grant passwordless sudo for systemctl reboot/poweroff (see install.sh), or run this on a machine with a local session.",
		})
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
