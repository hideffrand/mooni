package cache

import (
	"context"
	"testing"
	"time"
)

func TestMemorySetGetTTL(t *testing.T) {
	m := newMemory()
	ctx := context.Background()

	m.Set(ctx, "k", []byte("v"), time.Minute)
	if b, ok := m.Get(ctx, "k"); !ok || string(b) != "v" {
		t.Fatalf("Get after Set = %q, %v", b, ok)
	}

	m.Set(ctx, "exp", []byte("x"), 5*time.Millisecond)
	time.Sleep(10 * time.Millisecond)
	if _, ok := m.Get(ctx, "exp"); ok {
		t.Fatal("expired key still visible")
	}

	if _, ok := m.Get(ctx, "missing"); ok {
		t.Fatal("missing key visible")
	}
}

func TestMemoryIncrVisibleToGetInt64(t *testing.T) {
	m := newMemory()
	ctx := context.Background()

	if n := m.GetInt64(ctx, "ver"); n != 0 {
		t.Fatalf("GetInt64 on absent key = %d, want 0", n)
	}
	for want := int64(1); want <= 3; want++ {
		if n := m.Incr(ctx, "ver"); n != want {
			t.Fatalf("Incr = %d, want %d", n, want)
		}
	}
	if n := m.GetInt64(ctx, "ver"); n != 3 {
		t.Fatalf("GetInt64 after Incr = %d, want 3", n)
	}
}

func TestMemorySetOverwritesIncr(t *testing.T) {
	m := newMemory()
	ctx := context.Background()

	m.Incr(ctx, "ver")
	m.Set(ctx, "ver", []byte("not-an-int"), time.Minute)
	if n := m.GetInt64(ctx, "ver"); n != 0 {
		t.Fatalf("GetInt64 on non-int value = %d, want 0", n)
	}
	// Redis-style: SET clears the old value; next Incr starts from 1.
	if n := m.Incr(ctx, "ver"); n != 1 {
		t.Fatalf("Incr after Set = %d, want 1", n)
	}
}
