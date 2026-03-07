# Stream Deck Integration for Mutiny Desktop

Control Mutiny (mute, deafen, disconnect) from a Stream Deck on Windows.

## How It Works

When Mutiny Desktop starts, it spins up a tiny HTTP server on `127.0.0.1:7423`.
Stream Deck buttons run a PowerShell script that hits an endpoint, which injects
JavaScript into the Mutiny renderer to interact with the voice UI.

## Setup

### 1. Copy the Script

Copy `mutiny-control.ps1` somewhere permanent on papayabox, e.g.:

```
C:\Users\<you>\Documents\StreamDeck\mutiny-control.ps1
```

### 2. Configure Each Stream Deck Button

In Stream Deck software, for each button:

- **Action:** `System → Open` (or any "Run Application" action)
- **App / Path:** `powershell.exe`
- **Arguments:** `-WindowStyle Hidden -File "C:\Users\<you>\Documents\StreamDeck\mutiny-control.ps1" -Command <command>`

Replace `<command>` with one of:

| Command         | Effect                              |
|-----------------|-------------------------------------|
| `toggle-mute`   | Mute / unmute your microphone       |
| `toggle-deafen` | Deafen / undeafen                   |
| `disconnect`    | Leave the current voice channel     |
| `focus`         | Bring the Mutiny window to the front|
| `ping`          | Health check (useful for testing)   |

### 3. Test It

Open PowerShell and run:

```powershell
.\mutiny-control.ps1 -Command ping
# Expected: OK: {"ok":true,"result":"pong"}

.\mutiny-control.ps1 -Command toggle-mute
# Expected: OK: {"ok":true,"result":"clicked:title"}
```

If you get "not reachable", make sure Mutiny Desktop is running.

## Troubleshooting

**"not reachable" error**
Mutiny isn't running, or it's an older build without the control server.
Update to the latest release and try again.

**`result: "not-found"`**
Mutiny is running but you're not currently in a voice channel (nothing to mute).
Join a voice channel first, then press the button.

**Windows Firewall prompt**
The server only binds to `127.0.0.1` so no firewall rules are needed —
Windows shouldn't prompt, but if it does, deny external access (local-only is fine).

## Adding More Buttons

You can create separate `.ps1` wrappers for each command if you prefer not to
use parameters, e.g. `mute.ps1`:

```powershell
& "$PSScriptRoot\mutiny-control.ps1" -Command toggle-mute
```

Then point the Stream Deck button at `mute.ps1` with no arguments.
