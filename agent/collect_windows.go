//go:build windows

package main

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

// collectScript asks WMI/CIM for inventory + licence *status*. It never reads
// the product key: no DigitalProductId, no OSPP, no slmgr.
const collectScript = `
$ErrorActionPreference = 'SilentlyContinue'
$cs   = Get-CimInstance Win32_ComputerSystem
$bios = Get-CimInstance Win32_BIOS
$os   = Get-CimInstance Win32_OperatingSystem
$cpu  = Get-CimInstance Win32_Processor | Select-Object -First 1
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID = '$env:SystemDrive'"
$lic  = Get-CimInstance SoftwareLicensingProduct -Filter "PartialProductKey IS NOT NULL AND ApplicationID LIKE '55c92734%'" | Select-Object -First 1
$guid = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Cryptography').MachineGuid
[pscustomobject]@{
  machine_guid      = "$guid"
  hostname          = "$env:COMPUTERNAME"
  manufacturer      = "$($cs.Manufacturer)"
  model             = "$($cs.Model)"
  serial            = "$($bios.SerialNumber)"
  cpu               = "$($cpu.Name)"
  cores             = [int]$cs.NumberOfLogicalProcessors
  ram_mb            = [int64]($cs.TotalPhysicalMemory / 1MB)
  disk_total_gb     = [math]::Round($disk.Size / 1GB, 1)
  disk_free_gb      = [math]::Round($disk.FreeSpace / 1GB, 1)
  os                = "$($os.Caption)"
  build             = "$($os.BuildNumber)"
  arch              = "$env:PROCESSOR_ARCHITECTURE"
  uptime_s          = [int64]((Get-Date) - $os.LastBootUpTime).TotalSeconds
  activation_status = [int]$lic.LicenseStatus
  activation_name   = "$($lic.Name)"
  grace_days        = [int]($lic.GracePeriodRemaining / 1440)
} | ConvertTo-Json -Compress
`

func collect(cfg Config) (Report, error) {
	out, err := exec.Command("powershell.exe",
		"-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
		"-Command", collectScript).Output()
	if err != nil {
		return Report{}, fmt.Errorf("collector failed: %w", err)
	}
	p, dev, act, err := parseInventory(out)
	if err != nil {
		return Report{}, err
	}
	dev.Arch = strings.ToLower(runtime.GOARCH)
	loc := Location{
		Source:   "ip",
		PublicIP: publicIP(cfg),
		LANIPs:   lanIPs(),
	}
	return newReport(cfg.Tenant, strings.TrimSpace(p.MachineGUID), dev, act, loc), nil
}
