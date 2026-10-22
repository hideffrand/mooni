package main

import (
	"encoding/json"
	"fmt"
	"time"
)

// Report is the JSON body POSTed to the collector endpoint.
type Report struct {
	Agent       AgentInfo  `json:"agent"`
	Tenant      string     `json:"tenant"`
	DeviceID    string     `json:"device_id"`
	CollectedAt string     `json:"collected_at"`
	Device      Device     `json:"device"`
	Activation  Activation `json:"activation"`
	Location    Location   `json:"location"`
}

type AgentInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type Device struct {
	Hostname     string  `json:"hostname"`
	Manufacturer string  `json:"manufacturer"`
	Model        string  `json:"model"`
	Serial       string  `json:"serial"`
	CPU          string  `json:"cpu"`
	Cores        int     `json:"cores"`
	RAMMB        int64   `json:"ram_mb"`
	DiskTotalGB  float64 `json:"disk_total_gb"`
	DiskFreeGB   float64 `json:"disk_free_gb"`
	OS           string  `json:"os"`
	Build        string  `json:"build"`
	Arch         string  `json:"arch"`
	UptimeS      int64   `json:"uptime_s"`
}

// Activation carries license *status* only. The Windows product key itself is
// never read or transmitted.
type Activation struct {
	Status    string `json:"status"`
	Code      int    `json:"code"`
	Edition   string `json:"edition"`
	GraceDays int    `json:"grace_days"`
}

// Location: the agent reports where it is reachable from; the server resolves
// lat/lon from the request source IP (source=server-ip) or from public_ip.
//
// ponytail: no Windows Location API yet - it needs a WinRT/COM binding and a
// user-visible permission toggle. Upgrade path: collect lat/lon here and set
// Source="windows" once that gate exists.
type Location struct {
	Source   string   `json:"source"`
	PublicIP string   `json:"public_ip,omitempty"`
	LANIPs   []string `json:"lan_ips,omitempty"`
}

// psOut mirrors the flat object emitted by the PowerShell collector.
type psOut struct {
	MachineGUID      string  `json:"machine_guid"`
	Hostname         string  `json:"hostname"`
	Manufacturer     string  `json:"manufacturer"`
	Model            string  `json:"model"`
	Serial           string  `json:"serial"`
	CPU              string  `json:"cpu"`
	Cores            int     `json:"cores"`
	RAMMB            int64   `json:"ram_mb"`
	DiskTotalGB      float64 `json:"disk_total_gb"`
	DiskFreeGB       float64 `json:"disk_free_gb"`
	OS               string  `json:"os"`
	Build            string  `json:"build"`
	Arch             string  `json:"arch"`
	UptimeS          int64   `json:"uptime_s"`
	ActivationStatus int     `json:"activation_status"`
	ActivationName   string  `json:"activation_name"`
	GraceDays        int     `json:"grace_days"`
}

// parseInventory turns the PowerShell JSON into the wire types.
func parseInventory(raw []byte) (psOut, Device, Activation, error) {
	var p psOut
	if err := json.Unmarshal(raw, &p); err != nil {
		return p, Device{}, Activation{}, fmt.Errorf("parsing collector output: %w", err)
	}
	if p.MachineGUID == "" {
		return p, Device{}, Activation{}, fmt.Errorf("collector returned no machine_guid")
	}
	dev := Device{
		Hostname:     p.Hostname,
		Manufacturer: p.Manufacturer,
		Model:        p.Model,
		Serial:       p.Serial,
		CPU:          p.CPU,
		Cores:        p.Cores,
		RAMMB:        p.RAMMB,
		DiskTotalGB:  p.DiskTotalGB,
		DiskFreeGB:   p.DiskFreeGB,
		OS:           p.OS,
		Build:        p.Build,
		Arch:         p.Arch,
		UptimeS:      p.UptimeS,
	}
	act := Activation{
		Status:    activationName(p.ActivationStatus),
		Code:      p.ActivationStatus,
		Edition:   p.ActivationName,
		GraceDays: p.GraceDays,
	}
	return p, dev, act, nil
}

// activationName maps SoftwareLicensingProduct.LicenseStatus values.
func activationName(code int) string {
	switch code {
	case 0:
		return "unlicensed"
	case 1:
		return "licensed"
	case 2:
		return "oob_grace"
	case 3:
		return "out_of_tolerance_grace"
	case 4:
		return "non_genuine_grace"
	case 5:
		return "notification"
	case 6:
		return "extended_grace"
	default:
		return "unknown"
	}
}

func newReport(tenant, deviceID string, dev Device, act Activation, loc Location) Report {
	return Report{
		Agent:       AgentInfo{Name: "z_mdm_agent", Version: version},
		Tenant:      tenant,
		DeviceID:    deviceID,
		CollectedAt: time.Now().UTC().Format(time.RFC3339),
		Device:      dev,
		Activation:  act,
		Location:    loc,
	}
}
