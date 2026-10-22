# HOWTO: build, install, verify, ship

Step-by-step for `z_mdm_agent`. Payload contract and design notes live in
[README.md](README.md).

---

## 1. Build the exe (from a Linux/macOS workstation or CI)

```bash
cd agent
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build \
  -trimpath \
  -ldflags "-s -w -H=windowsgui -X main.version=0.1" \
  -o z_mdm_agent_0.1.exe .
```

Checks before you hand it out:

```bash
file z_mdm_agent_0.1.exe        # PE32+ executable (GUI) x86-64
sha256sum z_mdm_agent_0.1.exe   # record this next to the release
go test ./...                   # payload + spool tests, runnable on Linux
```

Version bump = change `-X main.version=0.1` and the filename to match. Tag push
`v0.2` makes CI produce `z_mdm_agent_0.2.exe` automatically.

## 2. Sign it (mandatory before shipping)

```powershell
signtool sign /fd sha256 /tr http://timestamp.digicert.com /td sha256 `
  /f brand.pfx /p <pfx-password> z_mdm_agent_0.1.exe
signtool verify /pa /v z_mdm_agent_0.1.exe
```

Unsigned = SmartScreen warning + likely Defender flag (it beacons and reads
WMI). Also submit the hash to Microsoft's AV portal before the first factory
batch.

## 3. Install on one test machine

Elevated PowerShell (the boot task runs as SYSTEM and needs admin to register):

```powershell
.\z_mdm_agent_0.1.exe -install -key <api-key> -tenant zyrex
```

What that did:

| Item | Location |
|---|---|
| Binary | `%ProgramData%\zyrex-mdm\z_mdm_agent_0.1.exe` |
| Config (secret, ACL: SYSTEM+Administrators) | `%ProgramData%\zyrex-mdm\config.json` |
| Log | `%ProgramData%\zyrex-mdm\agent.log` |
| Failed-report queue | `%ProgramData%\zyrex-mdm\spool\` |
| Scheduled task | `ZyrexMDM`, trigger `ONSTART`, user `SYSTEM`, highest |

Other flags: `-url <endpoint>`, `-interval <minutes>`, `-version`.
Interval default is 360 (6h) + up to 10 min jitter.

## 4. Verify it works

```powershell
# task exists and is running
schtasks /Query /TN ZyrexMDM /V /FO LIST

# force a one-shot report and see the exact JSON
& "$env:ProgramData\zyrex-mdm\z_mdm_agent_0.1.exe" -once

# check the log after a boot or manual start
Get-Content "$env:ProgramData\zyrex-mdm\agent.log" -Tail 20

# task start right now, without rebooting
schtasks /Run /TN ZyrexMDM
```

Expected: `-once` prints the report JSON and exits 0. A non-zero exit means the
POST was rejected — the payload is still printed and spooled, so you can inspect
it. Then reboot and confirm the task fires before login:

```powershell
Restart-Computer
```

After reboot, no user logged in, `agent.log` should show a `report sent` line
and your collector endpoint should have the record.

## 5. Change the endpoint or key later (no reinstall)

Re-run install with the new values, or edit config and restart the task:

```powershell
schtasks /End /TN ZyrexMDM
notepad "$env:ProgramData\zyrex-mdm\config.json"
schtasks /Run /TN ZyrexMDM
```

Env vars override the file for a single run: `ZYREX_URL`, `ZYREX_API_KEY`,
`ZYREX_TENANT`, `ZYREX_INTERVAL_MINUTES`, `ZYREX_IP_URL`, `ZYREX_DATA_DIR`.

## 6. Upgrade

Run the new exe with the same flags — it replaces the binary and recreates the
task in place:

```powershell
.\z_mdm_agent_0.2.exe -install -key <api-key> -tenant zyrex
```

`config.json` is rewritten from the flags, so pass them again (or omit them to
keep the file's current URL/tenant and only refresh the binary — the config
file is re-saved from loaded values).

## 7. Uninstall

```powershell
.\z_mdm_agent_0.1.exe -uninstall
```

Deletes task `ZyrexMDM` and `%ProgramData%\zyrex-mdm` (binary, config, log,
spool). Nothing outside that directory is touched.

## 8. Factory-image deployment (1000s of machines)

1. Copy `z_mdm_agent_0.1.exe` into the image, e.g. `C:\Windows\Setup\Scripts\`.
2. Add a `FirstLogonCommands` / `RunOnce` entry (or a provisioning step) that
   runs, elevated and unattended:
   ```powershell
   C:\Windows\Setup\Scripts\z_mdm_agent_0.1.exe -install -key <key> -tenant zyrex
   C:\Windows\Setup\Scripts\z_mdm_agent_0.1.exe -once
   ```
3. Verify one imaged machine end-to-end (section 4), then release the image.
4. Per-device identity is the machine's `MachineGuid` — cloned images must be
   sysprep'd (`/generalize`), otherwise every clone reports the same
   `device_id`.
5. Want an uninstall entry in Programs & Features and clean upgrades? Wrap the
   exe in WiX (MSI) or Inno Setup — the exe alone ships no installer metadata.

## 9. Server-side contract you must implement

```
POST https://api.zyrex.com/api/v1/devices/report
Content-Type: application/json
X-Tenant: zyrex
X-API-Key: <key>            # optional, only if configured

<report json, see README.md>
```

- Answer **2xx** or the agent spools the report and retries. Any 4xx is logged
  with the response body (first 512 bytes) — use it to debug contract drift.
- Resolve `lat/lon` from the request source IP and store it against
  `location.source = "ip"`. `location.public_ip` is an independent hint.
- Key on `device_id` (= MachineGuid). Upsert, don't append blindly.

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| No task after `-install` | not elevated; `schtasks` returns "Access is denied" |
| Task runs, no report | endpoint unreachable at boot → look in `spool\` and `agent.log`; retries back off 2→15 min |
| `collector failed` in log | PowerShell blocked by policy; the agent already passes `-ExecutionPolicy Bypass`, check GPO/AppLocker |
| `activation.status: unknown` | no `SoftwareLicensingProduct` row (KMS/OEM variants); code is still reported for your mapping |
| `public_ip` empty | `api.ipify.org` blocked; point `ZYREX_IP_URL` at your own `/ip` echo endpoint |
| Two machines, same `device_id` | image not sysprep'd |
| AV deletes the exe | unsigned; sign + AV portal submission (section 2) |

## 11. What the agent will never do

- Read or transmit the Windows product key.
- Touch files outside `%ProgramData%\zyrex-mdm`.
- Open an inbound port or accept commands — outbound POST only.
- Hide from the user: the task is visible in Task Scheduler, the binary is a
  normal signed exe, and the log is on disk.
