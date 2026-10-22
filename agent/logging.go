package main

import (
	"log"
	"os"
	"path/filepath"
)

const maxLogBytes = 5 << 20

// initLogging appends to <dataDir>/agent.log (the GUI subsystem binary has no
// console) and rotates once past maxLogBytes.
func initLogging() {
	dir := dataDir()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		log.SetOutput(os.Stderr)
		return
	}
	path := filepath.Join(dir, "agent.log")
	if st, err := os.Stat(path); err == nil && st.Size() > maxLogBytes {
		_ = os.Rename(path, path+".1")
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		log.SetOutput(os.Stderr)
		return
	}
	log.SetOutput(f)
	log.SetFlags(log.LstdFlags | log.LUTC)
}
