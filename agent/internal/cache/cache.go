package cache

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// Cache lets services test against an in-memory fake instead of Redis.
type Cache interface {
	Get(ctx context.Context, key string) ([]byte, bool)
	GetInt64(ctx context.Context, key string) int64
	Set(ctx context.Context, key string, value []byte, ttl time.Duration)
	Incr(ctx context.Context, key string) int64
}

// cache is Redis-backed; with no addr configured it falls back to an
// in-process store so list caching works with zero configuration.
type cache struct {
	rdb *redis.Client
	mem *memory // used when rdb == nil
}

func New(addr, password string) *cache {
	if addr == "" {
		return &cache{mem: newMemory()}
	}
	return &cache{rdb: redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
	})}
}

// Enabled reports whether a real Redis client was configured.
func (c *cache) Enabled() bool {
	return c.rdb != nil
}

// Ping verifies connectivity. Used once at startup; on failure the caller may
// decide to disable the cache rather than log an error per request.
func (c *cache) Ping(ctx context.Context) error {
	if c.rdb == nil {
		return errors.New("redis not configured")
	}
	return c.rdb.Ping(ctx).Err()
}

// Close releases the Redis connection pool.
func (c *cache) Close() error {
	if c.rdb == nil {
		return nil
	}
	return c.rdb.Close()
}

func (c *cache) Get(ctx context.Context, key string) ([]byte, bool) {
	if c.rdb == nil {
		return c.mem.Get(ctx, key)
	}
	b, err := c.rdb.Get(ctx, key).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, false
	}
	if err != nil {
		log.Printf("cache get error (%s): %v", key, err)
		return nil, false
	}
	return b, true
}

func (c *cache) Set(ctx context.Context, key string, value []byte, ttl time.Duration) {
	if c.rdb == nil {
		c.mem.Set(ctx, key, value, ttl)
		return
	}
	if err := c.rdb.Set(ctx, key, value, ttl).Err(); err != nil {
		log.Printf("cache set error (%s): %v", key, err)
	}
}

func (c *cache) GetInt64(ctx context.Context, key string) int64 {
	if c.rdb == nil {
		return c.mem.GetInt64(ctx, key)
	}
	n, err := c.rdb.Get(ctx, key).Int64()
	if errors.Is(err, redis.Nil) {
		return 0
	}
	if err != nil {
		log.Printf("cache get error (%s): %v", key, err)
		return 0
	}
	return n
}

// Incr atomically increments key. Returns the new value, or 0 on error
// (fail-open: the caller just skips invalidation).
func (c *cache) Incr(ctx context.Context, key string) int64 {
	if c.rdb == nil {
		return c.mem.Incr(ctx, key)
	}
	n, err := c.rdb.Incr(ctx, key).Result()
	if err != nil {
		log.Printf("cache incr error (%s): %v", key, err)
		return 0
	}
	return n
}
