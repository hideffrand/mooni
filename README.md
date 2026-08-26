# Mooni

Control your Linux server (or just your own laptop) from your phone - over
Tailscale, so everything stays private and you don't have to open any ports
on your router.

<img src="assets/screenshots/mooni-hero.jpg" alt="Mooni app screenshot" width="300">

## What you get

- **File Manager** - browse folders, upload, download, rename, copy, move,
  delete, and preview photos & videos right from your phone. Files get
  thumbnails (images/videos) or colored type badges (PDF, XLS, ZIP, ...) at a
  glance.
- **Media** - a Photos-style library (timeline grid grouped by date,
  full-screen swipeable viewer with pinch-zoom, multi-select, gallery
  upload) over a dedicated folder on the server.
- **System Health** - a live dashboard of your server's CPU, memory, disk,
  load, uptime, and temperature.
- **Alerts** - set CPU/RAM/disk/temperature thresholds per device and get a
  push notification on your phone when one is crossed.
- **Power Control** - reboot or shut down your machine from the app, guarded
  by your phone's fingerprint/PIN (with a type-to-confirm fallback) so a
  stray tap - or a leaked API key - can't do damage.

## How it works (the short version)

Two pieces, both in this repo:

- `mobile/` - the Android app you use on your phone.
- `agent/` - a small program that runs on your server and does what the app
  asks. You set it up once with one command.

When you set up the agent, it prints a **QR code**. Scan it with the app and
your phone is connected - no IPs, no API keys to type.

## Requirements

- An Android phone.
- A Linux machine with **Tailscale** installed and turned on (the app talks
  to your server through the Tailscale network).

## Install

### 1. Set up the agent (on your server)

```bash
cd agent
./install.sh
```

The script walks you through everything: picks the folder the app may
access, generates a secret key, optionally allows reboot/shutdown from the
app, and finishes by printing a **QR code + pairing code** in your terminal.

Redis is optional but nice-to-have: if a Redis server is running, add
`MOONI_REDIS_ADDR=127.0.0.1:6379` (and optionally `MOONI_REDIS_PASSWORD`) to
`~/.mooni/config.env` and the agent will cache file listings and the health
dashboard in it - see `agent/README.md` for details. Without it, everything
works the same, just uncached.

### 2. Set up the app (on your phone)

- For development: install **Expo Go** from the Play Store, then run
  `cd mobile && npm install && npx expo start` and scan the Metro QR with
  Expo Go.
- For a production APK: `eas build --platform android` (see `mobile/README.md`).

### 3. Connect

In the app: **Add Device → Scan QR Code**, point the camera at the QR code
from step 1. Done. Your server appears and you can browse files or check its
health.

## Features

- **Dashboard**: opens straight on the system health overview of your
  selected device - CPU, memory, disk, load average, uptime, temperature -
  auto-refreshing. With more than one device connected, tap the chips at the
  top to switch which machine you're looking at.
- **Files**: list folders, upload/download, rename/copy/move/delete,
  preview images, videos and audio, share files to other apps.
- **Alerts**: threshold notifications (CPU/RAM/disk/temp) pushed to the app.
- **Power**: reboot or shut down the selected machine; the app asks you to
  type a random text token before anything happens.
- **Multiple servers**: keep several servers/devices in the app and switch
  between them anytime.

## Uninstall

### Remove the agent (on your server)

```bash
cd agent
./uninstall.sh
```

It stops the service, deletes the program, and removes the config (API key)
which un-pairs the phones. **Your files are never touched.** You can also
uninstall manually - see `agent/README.md`.

### Remove the app

Just uninstall it like any Android app.

## Where to find details

- `mobile/README.md` - the app: development, builds, folder structure.
- `agent/README.md` - the agent: API, manual setup, systemd, security.
