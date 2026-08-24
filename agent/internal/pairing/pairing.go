package pairing

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"os/exec"
	"strings"

	qrcode "github.com/skip2/go-qrcode"
	"mooni-backend/internal/dto"
)

const prefix = "MOONI1:"

// Encode produces the copy-pasteable code the mobile app understands
// (see src/utils/pairingCode.ts on the app side - must stay in sync).
func Encode(p dto.PairingPayload) string {
	b, _ := json.Marshal(p)
	return prefix + base64.StdEncoding.EncodeToString(b)
}

// TerminalQR renders `code` as a QR code drawn with Unicode half-block
// characters, sized to look roughly square in a normal terminal font so a
// phone camera can scan it directly off the screen.
func TerminalQR(code string) (string, error) {
	q, err := qrcode.New(code, qrcode.Low)
	if err != nil {
		return "", fmt.Errorf("generating QR code: %w", err)
	}
	return q.ToSmallString(false), nil
}

// TailscaleIPv4 finds this machine's Tailscale IP via the tailscale CLI.
func TailscaleIPv4() (string, error) {
	out, err := exec.Command("tailscale", "ip", "-4").Output()
	if err != nil {
		return "", fmt.Errorf("tailscale not available: %w", err)
	}
	ip := strings.TrimSpace(string(out))
	if ip == "" {
		return "", fmt.Errorf("tailscale returned no IPv4 address")
	}
	return ip, nil
}

// LANIPv4 returns the first non-loopback IPv4 (fallback without Tailscale).
func LANIPv4() (string, error) {
	out, err := exec.Command("hostname", "-I").Output()
	if err != nil {
		return "", fmt.Errorf("hostname -I failed: %w", err)
	}
	for _, f := range strings.Fields(string(out)) {
		if strings.HasPrefix(f, "127.") {
			continue
		}
		if net.ParseIP(f) != nil {
			return f, nil
		}
	}
	return "", fmt.Errorf("no non-loopback IPv4 address found")
}
