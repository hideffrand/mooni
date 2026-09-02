package cache

import (
	"context"
	"strconv"
	"sync"
	"time"
)

// memory is the in-process fallback used when Redis isn't configured (or is
// unreachable): same semantics, state dies with the process. Keys set with a
// TTL expire; keys created by Incr (version counters) never do, matching Redis.
type memory struct {
	mu   sync.Mutex
	vals map[string]memEntry
}

type memEntry struct {
	data    []byte
	expires time.Time // zero = never
}

func newMemory() *memory {
	return &memory{vals: make(map[string]memEntry)}
}

func (m *memory) Get(_ context.Context, key string) ([]byte, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.get(key)
}

func (m *memory) get(key string) ([]byte, bool) {
	e, ok := m.vals[key]
	if !ok {
		return nil, false
	}
	if !e.expires.IsZero() && time.Now().After(e.expires) {
		delete(m.vals, key)
		return nil, false
	}
	return e.data, true
}

func (m *memory) GetInt64(ctx context.Context, key string) int64 {
	b, ok := m.Get(ctx, key)
	if !ok {
		return 0
	}
	n, err := strconv.ParseInt(string(b), 10, 64)
	if err != nil {
		return 0
	}
	return n
}

func (m *memory) Set(_ context.Context, key string, value []byte, ttl time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now()
	// Opportunistic cleanup: keeps per-folder browse keys from accumulating.
	for k, e := range m.vals {
		if !e.expires.IsZero() && now.After(e.expires) {
			delete(m.vals, k)
		}
	}
	m.vals[key] = memEntry{data: value, expires: now.Add(ttl)}
}

// Incr stores the counter at the key itself (Redis-style), so GetInt64 on the
// same key sees the incremented value.
func (m *memory) Incr(_ context.Context, key string) int64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	n := int64(1)
	if b, ok := m.get(key); ok {
		if p, err := strconv.ParseInt(string(b), 10, 64); err == nil {
			n = p + 1
		}
	}
	m.vals[key] = memEntry{data: []byte(strconv.FormatInt(n, 10))}
	return n
}
