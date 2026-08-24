package system

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"sync"
	"time"
)

// confirmTokenTTL is how long an issued confirm token stays valid.
const confirmTokenTTL = 60 * time.Second

// confirmStore issues short-lived, single-use tokens required for power
// commands, so a leaked API key alone can't reboot/shutdown the machine.
type confirmStore struct {
	mu    sync.Mutex
	token string
	exp   time.Time
}

func newConfirmStore() *confirmStore {
	return &confirmStore{}
}

// issue returns a fresh random token, replacing any outstanding one.
func (s *confirmStore) issue() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	tok := hex.EncodeToString(b)
	s.mu.Lock()
	s.token = tok
	s.exp = time.Now().Add(confirmTokenTTL)
	s.mu.Unlock()
	return tok, nil
}

// consume validates tok and burns it. It returns false if no token is
// outstanding, the token doesn't match, or it has expired.
func (s *confirmStore) consume(tok string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.token == "" || subtle.ConstantTimeCompare([]byte(s.token), []byte(tok)) != 1 {
		return false
	}
	if time.Now().After(s.exp) {
		s.token = ""
		return false
	}
	s.token = ""
	return true
}
