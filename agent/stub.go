//go:build !windows

package main

import (
	"fmt"
	"os"
)

// The agent is Windows-only; this stub keeps `go build`/`go test` working on
// Linux so the payload shaping can be tested without a Windows runner.
func main() {
	fmt.Fprintln(os.Stderr, "z_mdm_agent targets Windows only (build with GOOS=windows)")
	os.Exit(1)
}
