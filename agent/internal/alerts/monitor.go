package alerts

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"mooni-backend/internal/system"
)

const (
	checkInterval = 30 * time.Second
	pushTimeout   = 10 * time.Second
	expoPushURL   = "https://expohost/--/api/v2/push/send"

	// Hysteresis band: after firing, a metric must drop this far below its
	// threshold before it can fire again, so a value hovering at ~threshold
	// doesn't flap.
	hysteresis = 5
)

// Monitor samples system stats on a ticker and pushes a notification when
// a metric crosses its threshold (edge-triggered: once per crossing, not
// while it stays high).
type Monitor struct {
	rootDir string
	store   *Store
	client  *http.Client
	now     func() time.Time

	mu    sync.Mutex
	state map[string]metricState
}

type metricState struct {
	armed      bool
	lastNotify time.Time
}

func NewMonitor(rootDir string, store *Store) *Monitor {
	return &Monitor{
		rootDir: rootDir,
		store:   store,
		client:  &http.Client{Timeout: pushTimeout},
		now:     time.Now,
	}
}

// Run blocks, checking stats every checkInterval until ctx is cancelled.
func (m *Monitor) Run(ctx context.Context) {
	ticker := time.NewTicker(checkInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.checkOnce()
		}
	}
}

// evaluate is the pure decision core: given the current metric state,
// whether the metric is enabled, its current value and threshold, return
// whether to fire now and the next state. Exported for tests via CheckMetric.
func CheckMetric(st metricState, enabled bool, value, threshold float64, cooldown time.Duration, now time.Time) (fired bool, next metricState) {
	next = st
	if !enabled {
		next.armed = true
		return false, next
	}
	if value < threshold-hysteresis {
		next.armed = true
		return false, next
	}
	if st.armed && value >= threshold && now.Sub(st.lastNotify) >= cooldown {
		next.armed = false
		next.lastNotify = now
		return true, next
	}
	return false, next
}

func (m *Monitor) checkOnce() {
	cfg := m.store.Config()
	if !cfg.Enabled || len(m.store.Tokens()) == 0 {
		return
	}
	s, err := system.Collect(m.rootDir)
	if err != nil {
		log.Println("alerts monitor:", err)
		return
	}

	cooldown := time.Duration(cfg.CooldownMinutes) * time.Minute
	now := m.now()
	type hit struct {
		name string
		msg  string
	}
	var hits []hit

	check := func(key, name string, enabled bool, value, threshold float64, format string) {
		m.mu.Lock()
		prev := m.state[key]
		fired, next := CheckMetric(prev, enabled, value, threshold, cooldown, now)
		m.state[key] = next
		m.mu.Unlock()
		if fired {
			hits = append(hits, hit{name, fmt.Sprintf(format, value, threshold)})
		}
	}

	maxTemp := 0.0
	for _, t := range s.TempsCelsius {
		if t > maxTemp {
			maxTemp = t
		}
	}

	check("cpu", "CPU", cfg.CPUPercent > 0, s.CPUPercent, cfg.CPUPercent, "CPU at %.0f%% (threshold %.0f%%)")
	check("mem", "RAM", cfg.MemPercent > 0, s.Memory.UsedPercent, cfg.MemPercent, "RAM at %.0f%% (threshold %.0f%%)")
	check("disk", "Disk", cfg.DiskPercent > 0, s.Disk.UsedPercent, cfg.DiskPercent, "Disk at %.0f%% (threshold %.0f%%)")
	// VMs often expose no thermal zones; only arm the temp metric when we
	// actually have readings so a stale armed flag never fires on garbage.
	if maxTemp > 0 {
		check("temp", "Temperature", cfg.TempCelsius > 0, maxTemp, cfg.TempCelsius, "Temperature at %.0f°C (threshold %.0f°C)")
	} else {
		m.mu.Lock()
		delete(m.state, "temp")
		m.mu.Unlock()
	}

	for _, h := range hits {
		m.push(cfg, h.name, h.msg)
	}
}

type expoTicket struct {
	Status  string `json:"status"`
	ID      string `json:"id"`
	Message string `json:"message"`
	Details struct {
		Error string `json:"error"`
	} `json:"details"`
}

// push sends one notification to every registered token via Expo's push
// API and drops tokens Expo reports as no longer valid.
func (m *Monitor) push(cfg Config, title, body string) {
	tokens := m.store.Tokens()
	if len(tokens) == 0 {
		return
	}
	msgs := make([]map[string]any, 0, len(tokens))
	for _, t := range tokens {
		msgs = append(msgs, map[string]any{
			"to":        t,
			"title":     fmt.Sprintf("Mooni: %s", title),
			"body":      body,
			"sound":     "default",
			"channelId": "alerts",
		})
	}
	b, _ := json.Marshal(msgs)
	req, err := http.NewRequest(http.MethodPost, expoPushURL, bytes.NewReader(b))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := m.client.Do(req)
	if err != nil {
		log.Println("expo push error:", err)
		return
	}
	defer resp.Body.Close()

	var out struct {
		Data []expoTicket `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		log.Printf("expo push: bad response (%s)", resp.Status)
		return
	}
	var dead []string
	for i, tk := range out.Data {
		if tk.Status == "error" && tk.Details.Error == "DeviceNotRegistered" && i < len(tokens) {
			dead = append(dead, tokens[i])
		}
	}
	if len(dead) > 0 {
		log.Printf("expo push: pruning %d stale token(s)", len(dead))
		_ = m.store.Update(nil, nil, dead)
	}
}
