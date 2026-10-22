# z_mdm_agent

Minimal OEM inventory agent for Zyrex laptops. One binary, one POST, one boot
task. Windows only; the old Mooni file/media server is gone from this branch.

## What it reports

Once at boot, then every `interval_minutes` (default 6h):

- **Device**: hostname, manufacturer, model, BIOS serial, CPU, cores, RAM,
  system-disk total/free, OS caption, build, arch, uptime, machine GUID.
- **Activation**: license *status* (`licensed`, `notification`, grace days,
  edition name). **The product key is never read or transmitted** - no
  `DigitalProductId`, no OSPP, no `slmgr`.
- **Location**: public egress IP + LAN IPs. The collector resolves lat/lon from
  the request source IP. Windows Location API (true GPS/Wi-Fi fix) is not used
  in 0.1 - it needs the OS location permission toggle and a WinRT binding.

POST body (`Content-Type: application/json`, optional `X-API-Key` /
`X-Tenant` headers):

```json
{
  "agent": {"name": "z_mdm_agent", "version": "0.1"},
  "tenant": "zyrex",
  "device_id": "<MachineGuid>",
  "collected_at": "2026-10-22T08:00:00Z",
  "device": {
    "hostname": "ZYREX-01", "manufacturer": "ZYREX", "model": "NB-15",
    "serial": "SN123", "cpu": "Intel(R) Core(TM) i5", "cores": 8,
    "ram_mb": 16384, "disk_total_gb": 512, "disk_free_gb": 400.5,
    "os": "Microsoft Windows 11 Pro", "build": "22631",
    "arch": "amd64", "uptime_s": 3600
  },
  "activation": {"status": "licensed", "code": 1, "edition": "Windows(R), Professional edition", "grace_days": 0},
  "location": {"source": "ip", "public_ip": "203.0.113.7", "lan_ips": ["192.168.1.20"]}
}
```

Default endpoint: `https://api.zyrex.com/api/v1/devices/report`.

## Install (on the machine, elevated)

```powershell
.\z_mdm_agent_0.1.exe -install -key <api-key> -tenant zyrex
```

`-install` copies the exe to `%ProgramData%\zyrex-mdm\`, writes `config.json`
(0600, ACL: SYSTEM + Administrators), registers the scheduled task
**ZyrexMDM** (`ONSTART`, run as `SYSTEM`, highest privileges), and starts it.

Other flags:

| Flag | Effect |
|---|---|
| `-once` | collect + POST now, print the JSON, exit (debug) |
| `-uninstall` | delete task, remove `%ProgramData%\zyrex-mdm` |
| `-url`, `-key`, `-tenant`, `-interval <min>` | persisted into config.json |
| `-version` | print version |

Env overrides (no reinstall needed): `ZYREX_URL`, `ZYREX_API_KEY`,
`ZYREX_TENANT`, `ZYREX_INTERVAL_MINUTES`, `ZYREX_IP_URL`, `ZYREX_DATA_DIR`.

Failed POSTs are spooled to `%ProgramData%\zyrex-mdm\spool\` (max 200 files)
and replayed oldest-first on the next cycle; boot-before-DHCP therefore
self-heals with a 2-minute retry backoff. Log: `%ProgramData%\zyrex-mdm\agent.log`
(rotated at 5 MB).

## Build

```bash
cd agent
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build \
  -trimpath -ldflags "-s -w -H=windowsgui -X main.version=0.1" \
  -o z_mdm_agent_0.1.exe .
```

`CGO_ENABLED=0` = static, no runtime deps. `-H=windowsgui` = no console window
(hence the log file). Sign before shipping:

```powershell
signtool sign /fd sha256 /tr http://timestamp.digicert.com /td sha256 /f brand.pfx z_mdm_agent_0.1.exe
```

Unsigned builds are SmartScreen-blocked and likely AV-flagged: sign with the
brand's (EV) certificate and submit hashes to Microsoft's AV portal first.

## Test

```bash
go test ./...     # payload shape, auth headers, spool replay
```

Collector code is `//go:build windows`; the payload/report path is portable, so
CI on Linux still exercises it.

## Deployment notes

- Upgrade: run the new exe with `-install`; it replaces the copy and recreates
  the task.
- Uninstall shows nothing in **Programs & Features** - wrap in an MSI (WiX) or
  Inno Setup if the factory image needs an entry point.
- Boot task runs as SYSTEM: reboots of the endpoint itself are not this
  agent's job, and there is no UI.
- OEM preload legally requires the privacy notice / EULA to state that hardware
  inventory, activation status and network location are reported to Zyrex.
