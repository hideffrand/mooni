package alerts

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

// Handler exposes the alert configuration endpoints. It registers on the
// same mux as the other /api/system/* routes, so the API-key middleware
// wrapping that mux covers these too.
type Handler struct {
	store *Store
}

func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/system/alerts", h.get)
	mux.HandleFunc("PUT /api/system/alerts", h.put)
	mux.HandleFunc("POST /api/system/push-token", h.pushToken)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, h.store.Config())
}

func (h *Handler) put(w http.ResponseWriter, r *http.Request) {
	var cfg Config
	defer r.Body.Close()
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if err := sanitize(&cfg); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if err := h.store.Update(&cfg, nil, nil); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}

// sanitize clamps thresholds into sane ranges. 0 keeps a metric disabled.
func sanitize(c *Config) error {
	c.CPUPercent = clampPercent(c.CPUPercent)
	c.MemPercent = clampPercent(c.MemPercent)
	c.DiskPercent = clampPercent(c.DiskPercent)
	if c.TempCelsius < 0 || c.TempCelsius > 150 {
		return errors.New("tempCelsius must be between 0 and 150")
	}
	switch {
	case c.CooldownMinutes <= 0:
		c.CooldownMinutes = DefaultConfig().CooldownMinutes
	case c.CooldownMinutes > 24*60:
		c.CooldownMinutes = 24 * 60
	}
	return nil
}

func clampPercent(v float64) float64 {
	if v <= 0 {
		return 0
	}
	if v > 100 {
		return 100
	}
	// Round to whole numbers so sliders/steppers can't persist 89.99999.
	return float64(int(v + 0.5))
}

func (h *Handler) pushToken(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Token string `json:"token"`
	}
	defer r.Body.Close()
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	// Expo push tokens look like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx].
	t := strings.TrimSpace(b.Token)
	if !strings.HasPrefix(t, "ExponentPushToken[") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "not an Expo push token"})
		return
	}
	if err := h.store.Update(nil, []string{t}, nil); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
