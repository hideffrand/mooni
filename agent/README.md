# Mooni Backend - API

Go backend with a **single required external dependency** (`github.com/skip2/go-qrcode`,
used only to render the pairing QR code in the terminal - everything else is
the standard library). The optional `github.com/redis/go-redis/v9` is only
compiled in for the Redis cache described below and adds no runtime
requirement unless you enable it. Because the required dependency is a single
small one, `go build` on your laptop stays as simple as usual (Go downloads it
once and caches it locally, as long as there's internet during the first
build).

## Quick Setup (one script does everything)

```bash
cd agent
./install.sh
```

This script automatically:
- Install Go via `apt` if it's missing (asks for permission first)
- Generates a random API key
- Asks which folder the app is allowed to manage - it suggests common folders
  it found on your system (Documents, Downloads, Pictures, …) as numbered
  options, or you can type any custom path
- Builds the binary
- Detects the IP (Tailscale first, otherwise the LAN IP automatically)
- Optionally installs it as a systemd service (auto-start on boot)
- Optionally grants **passwordless sudo for just `systemctl reboot` and
  `systemctl poweroff`** so the app's Reboot/Shutdown buttons work - a scoped
  rule in `/etc/sudoers.d/mooni-power` (validated with `visudo -cf`), nothing
  else gets sudo
- **Prints the QR code + pairing code text** in the terminal

Configuration is stored at `~/.mooni/config.env` (mode 600), and the last
pairing code at `~/.mooni/last-pairing-code.txt` (mode 600) - neither can be
read by other users.

## Pairing - two ways, both from one command

```
Scan this QR from the app (Add Device > Scan QR):

█████████████████████████████████████████████████
████ ▄▄▄▄▄ █▄ ▄▄██  ▄▄█▀▀▄▄█▄▄▄ █▄█▀ █ ▄▄▄▄▄ ████
...

Or paste manually (Add Device > Paste Code):

MOONI1:eyJuYW1lIjoiTGFwdG9wIFRlc3QiLCJiYXNlVXJsIjoi...
```

1. **Scan QR** - open the app → **Add Device** → **Scan QR Code** → point
   your camera at the QR shown in the terminal. Fastest, and ideal for people
   who don't want to type or paste anything.
2. **Paste manually** - if the camera struggles to read the terminal screen
   (reflections, small resolution, etc.), the `MOONI1:...` text below the QR
   can be copied and pasted straight into the "Paste Code" mode.

Both contain the exact same payload (device name, server URL, API key) -
validated with a real QR decoder, not just "looks like a QR".

The QR **is always printed**, even when Tailscale isn't installed: the backend
automatically falls back to the LAN IP, or to `127.0.0.1` with a warning to
re-run with `-host` if no IP could be detected at all.

Want to give access to another phone (e.g. family)? Regenerate anytime without
re-running the setup:

```bash
source ~/.mooni/config.env && ./mooni-backend -pair -name "Family Phone"
```

## API Features

- `GET  /api/health` - check the server is alive (no API key needed)
- `GET  /api/files/list?path=...` - list folder contents (cached in Redis if enabled)
- `GET  /api/files/download?path=...` - download a file
- `GET  /api/files/preview?path=...` - stream a file (HTTP Range support → enables video scrubbing)
- `POST /api/files/upload` - multipart upload (`file`, `path` = destination folder)
- `POST /api/files/mkdir` - `{"path": "folder/new"}`
- `POST /api/files/rename` - `{"oldPath": "...", "newPath": "..."}`
- `POST /api/files/copy` - `{"src": "...", "dst": "..."}`
- `POST /api/files/move` - `{"src": "...", "dst": "..."}`
- `DELETE /api/files/delete` - `{"path": "..."}`
- `GET  /api/system/stats` - system health snapshot: CPU %, memory, disk, load
  average, uptime, process count, and CPU temperature (read straight from
  `/proc` and sysfs, no external dependency; cached in Redis for 5s if enabled)
- `POST /api/system/confirm-token` - issue a short-lived (60s), single-use
  confirm token used to authorize the power endpoints below.
- `POST /api/system/reboot` - restart the machine. Requires a valid
  `X-Confirm-Token` header (see above) plus the passwordless sudo rule from
  `install.sh` (or a local console session for `loginctl`).
- `POST /api/system/shutdown` - power the machine off. Same requirement as
  reboot.
- `GET  /api/media/list` - Photos-style media library index (see below). Add
  `mode=browse&path=...` to scope the response to one library folder: its
  subfolders as albums (`folders`, each with a recursive item count and newest
  cover) plus the media files directly inside it (`items`).
- `GET  /api/media/thumb?path=...` - downscaled image thumbnail.
- `GET  /api/media/preview?path=...` - stream a media file (Range support).
- `POST /api/media/upload` - multipart upload (`file`, one or more).
- `POST /api/media/delete` - `{"paths": [...]}` bulk delete.
- `GET  /api/system/alerts` - current alert thresholds: `{enabled, cpuPercent,
  memPercent, diskPercent, tempCelsius, cooldownMinutes}`; a threshold of 0
  disables that metric.
- `PUT  /api/system/alerts` - update thresholds (values are clamped into sane
  ranges server-side; percents round to whole numbers).
- `POST /api/system/push-token` - register an Expo push token
  (`ExponentPushToken[...]`) so this phone receives alert notifications.

All paths are **relative to `MOONI_ROOT_DIR`** and sanitized so they can
never escape that folder (protection against path traversal `../`, absolute
paths, and symlinks pointing outside the root). Uploads are capped at 2 GiB
per file, and large uploads are not cut off by a timeout (request bodies are
read without a deadline).

`rename` and `move` refuse to overwrite an existing destination file.

All `/api/files/*`, `/api/media/*` and `/api/system/*` endpoints require the
header `X-API-Key: <your api key>`.

## Windows WSL

`install.sh` detects WSL and adjusts accordingly:

- **Auto-start (systemd):** WSL only runs systemd if `/etc/wsl.conf` has
  `[boot]` / `systemd=true` (then restart with `wsl --shutdown`). Without it,
  the script skips the service and prints the manual-run command instead.
- **Power control (Reboot/Shutdown):** skipped on WSL - `systemctl reboot` /
  `poweroff` would only restart or shut down the WSL distro, never Windows.
  Reboot Windows from the Windows side (`shutdown /r`).
- **Reaching the server from your phone:** WSL's default NAT networking gives
  the distro an IP your phone can't reach directly. Either enable mirrored
  networking in `%UserProfile%\.wslconfig` (`[wsl2] networkingMode=mirrored`),
  forward the port from Windows with `netsh interface portproxy`, or use
  Tailscale. The script prints full instructions at install time.

## Manual Setup (if you don't want to use install.sh)

Needs Go 1.22+. If you don't have it on Mint: `sudo apt install golang-go`

```bash
cd agent
go build -o mooni-backend .   # Go downloads go-qrcode once (needs internet)

export MOONI_ROOT_DIR=/home/you/mooni-storage
export MOONI_API_KEY=$(openssl rand -hex 24)
export MOONI_PORT=8080
# Optional - a dedicated folder for the Photos-style media library. Unset to
# disable the media feature (see "Media library" below).
export MOONI_MEDIA_DIR=/home/you/mooni-media
# Optional - see "Redis caching" below. Skip both lines to run uncached.
export MOONI_REDIS_ADDR=127.0.0.1:6379
export MOONI_REDIS_PASSWORD=  # optional, if Redis requires auth

./mooni-backend
```

Generate a pairing code + QR manually:

```bash
./mooni-backend -pair -name "My Laptop" -host $(tailscale ip -4)
```

(The `-host` flag is optional - if omitted, the backend tries to auto-detect
via `tailscale ip -4`, then falls back to the LAN IP, then to `127.0.0.1`.)

## Media library (optional)

A Photos-style view over a **separate, dedicated folder** (`MOONI_MEDIA_DIR`) -
the app's Media tab is not the file manager and never sees `MOONI_ROOT_DIR`.
Enable it by pointing `MOONI_MEDIA_DIR` at an existing directory; without it,
all `/api/media/*` endpoints are simply not registered (404) and the app's
Media screen shows a "not enabled" notice.

- **Library index** - `GET /api/media/list` walks the folder recursively for
  images (jpg/jpeg/png/gif/bmp) and videos (mp4/mov/m4v/webm/mkv), returns them
  newest-first as `{path, name, size, modTime, kind}`, and caches the result in
  Redis (30s TTL) when available. Uploads/deletes invalidate immediately.
- **Thumbnails** - `GET /api/media/thumb?path=...` returns a downscaled JPEG
  (max 256px) generated with the Go standard library, cached on disk under
  `~/.mooni/thumbs/` (keyed by content hash + modtime + size, so editing a file
  regenerates its thumb). WebP is the one common format the stdlib can't
  decode - the app falls back to the full preview for it.
- **Preview** - `GET /api/media/preview?path=...` streams the full file via
  `http.ServeContent` with HTTP Range support (video scrubbing in the app).
  Add `&tier=large` for images: a cached downscaled JPEG (max 2560px, same
  disk cache as thumbnails) served with `Cache-Control: private, max-age=86400`
  - a fraction of the original's bytes. Videos ignore the tier (Range playback
  needs the original) and any image the thumbnailer can't decode falls back to
  streaming the original.
- **Upload** - `POST /api/media/upload` (multipart `file` field, one or more)
  saves files flat into the media directory. `filepath.Base` is applied to
  filenames and every path goes through the same sandbox as the file API.
- **Delete** - `POST /api/media/delete` with `{"paths":[...]}` bulk-deletes;
  refuses to delete the media root itself.

All media endpoints require `X-API-Key`, exactly like `/api/files/*`.

## Threshold alerts (optional)

A background monitor samples system stats every 30 seconds and pushes an Expo
notification ("Mooni: CPU at 95% ...") when a configured threshold is crossed:

- **Edge-triggered** - fires once on crossing, not repeatedly while the value
  stays high. A hysteresis band of 5 must be dropped below before the metric
  can fire again, and a per-config cooldown (default 30 min, capped at 24 h)
  applies between notifications for the same metric. Temperature only arms if
  the machine actually exposes thermal zones.
- **Configured** via the app's Alert Settings screen → `GET/PUT
  /api/system/alerts`; the phone registers its push token via
  `POST /api/system/push-token`.
- **Delivered** through Expo's push API; tokens reported as
  `DeviceNotRegistered` are pruned automatically.
- **State** lives in `~/.mooni/alerts.json` (mode 0600 - push tokens can send
  a notification to your phone, treat them accordingly). Everything is off by
  default.

## Redis caching (optional)

The backend can cache two things in Redis to make the app feel snappier:

- **File listings** (`GET /api/files/list`) - every directory listing is
  cached for 60 seconds. Any API mutation (upload, mkdir, rename, copy,
  move, delete) invalidates *all* cached listings immediately via a single
  atomic version bump, so actions done from the app always show fresh data.
  The TTL only covers changes made out-of-band (shell, SMB, another client).
- **System stats** (`GET /api/system/stats`) - cached for 5 seconds, so an
  auto-refreshing dashboard doesn't re-read `/proc` (and its ~200ms CPU
  sample) on every poll.

Enable it by pointing the agent at a running Redis server:

```bash
export MOONI_REDIS_ADDR=127.0.0.1:6379   # required to enable the cache
export MOONI_REDIS_PASSWORD=             # only if Redis requires AUTH
```

Running via systemd? Add the same two lines to `~/.mooni/config.env` - the
service already loads that file through `EnvironmentFile`.

Without `MOONI_REDIS_ADDR` the agent runs exactly as before, uncached. If
Redis is configured but unreachable at startup, the agent logs a warning and
keeps running uncached - a Redis outage never breaks the file API.

Downloads and previews are **never** cached: they stream from disk and rely
on HTTP Range support for video/audio scrubbing.

## Access via Tailscale from your phone

1. Make sure Tailscale is running on both the laptop and phone, logged into
   the same tailnet.
2. Run `install.sh` (or `-pair` manually) to get the QR / pairing code.
3. Scan the QR in the app, or paste the text code.

Because it goes through Tailscale (an encrypted peer-to-peer VPN), you **don't
need** to open any ports on your router/public firewall.

## Run automatically at boot

`install.sh` can set this up for you (answer "y" when asked). To do it
manually, create `/etc/systemd/system/mooni-backend.service`:

```ini
[Unit]
Description=Mooni Backend
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
User=you
EnvironmentFile=/home/you/.mooni/config.env
ExecStart=/home/you/agent/mooni-backend
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mooni-backend
sudo systemctl status mooni-backend
```

## Uninstall

Quick way - run the companion script from the `agent/` folder:

```bash
cd agent
./uninstall.sh
```

It removes, in order:
1. **systemd service** - stops, disables, and deletes
   `/etc/systemd/system/mooni-backend.service` (skipped if never installed).
2. **Power-control sudoers rule** - removes `/etc/sudoers.d/mooni-power`
   (the passwordless-sudo rule that powered the Reboot/Shutdown buttons).
3. **Built binary** - `agent/mooni-backend`.
4. **Config folder** `~/.mooni/` - API key + saved pairing codes (this is
   what un-pairs the phones).

**Your files are untouched by default.** The script lists the paired storage
folder and asks, by number, whether to keep the files or delete them too:

```
Paired folders:
  [1] /home/you/mooni-storage
What should uninstall do with the files in it?
  1) Keep all files - just uninstall (recommended)
  2) Uninstall AND permanently delete all files in [1]
```

If you pick option 2, it still asks you to type **DELETE** before anything is
removed - an accidental Enter can never wipe your files.

Existing pairing codes on phones stop working once the service is stopped and
the API key is deleted. Go itself is left installed (it's a general tool);
remove it manually if you want: `sudo apt remove golang-go`.

### Manual uninstall

Equivalent steps by hand:

```bash
sudo systemctl stop mooni-backend 2>/dev/null || true
sudo systemctl disable mooni-backend 2>/dev/null || true
sudo rm -f /etc/systemd/system/mooni-backend.service
sudo systemctl daemon-reload
sudo rm -f /etc/sudoers.d/mooni-power
rm -f /home/you/agent/mooni-backend
rm -rf ~/.mooni            # config + API key + saved pairing codes
# Your files under MOONI_ROOT_DIR are untouched - delete them only if you
# deliberately want them gone:
# rm -rf /home/you/mooni-storage
```

## Security notes

- Store `MOONI_API_KEY` (and the pairing code/QR, since it contains the API
  key) safely - anyone with it can read/write/delete all files inside
  `MOONI_ROOT_DIR`, and, if power control is enabled, reboot or shut down
  the machine. `install.sh` stores it at `~/.mooni/config.env` with
  permission `600` (and the `~/.mooni` folder itself is `700`). Don't
  screenshot the QR/code in the terminal and save it carelessly either.
- All file endpoints are sandboxed to `MOONI_ROOT_DIR`: path traversal
  (`../`, absolute paths) and **symlinks pointing outside the root** are
  rejected - you can't access files outside that folder even with a
  manipulated path.
- Filesystem errors (e.g. messages containing local paths) are not leaked to
  the client - the client only gets a generic message.
- The app gates Reboot/Shutdown behind the phone's device lock: the user must
  authenticate with their fingerprint/PIN (via `expo-local-authentication`)
  before the request is sent, and phones without a lock fall back to the
  **type-to-confirm modal**. That gate is enforced end-to-end: the power
  endpoints require a short-lived, single-use `X-Confirm-Token` issued by
  `POST /api/system/confirm-token` and consumed by the backend. A leaked API
  key or a replayed request alone can't reboot or shut down the machine.
