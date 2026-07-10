# Stream Deck Integration for Mutiny Desktop

Mutiny exposes a loopback-only control server on `127.0.0.1:7423`. The health
check is a read-only `GET /ping`; voice and focus commands are authenticated
`POST` requests. Mutiny creates a new 256-bit session token at startup and
stores it in the Electron user-data directory as `streamdeck-token`. The token
is never printed to logs.

## Setup

Copy `mutiny-control.ps1` to a permanent local path, then configure Stream Deck
**System → Open** actions to run:

```text
powershell.exe -WindowStyle Hidden -File "C:\path\to\mutiny-control.ps1" -Command toggle-mute
```

Supported commands are `toggle-mute`, `toggle-deafen`, `disconnect`, `focus`,
and `ping` (plus the aliases listed in the script). The script reads the token
from `%APPDATA%\Mutiny\streamdeck-token`. If your Electron user-data directory
is customized, pass `-TokenPath "C:\path\to\streamdeck-token"`.

## Test

```powershell
.\mutiny-control.ps1 -Command ping
.\mutiny-control.ps1 -Command toggle-mute
```

Successful commands print `{ "ok": true, ... }`. A `409` response means the
current hosted client has no matching active call control (for example, the
user is not in a voice channel). A `401` means the token is missing/stale;
restart Mutiny and let the script read the newly provisioned token.

The server intentionally rejects state-changing GETs and all browser-originated
requests, even when they come from loopback. Do not copy the token into browser
code, Stream Deck profiles, logs, or screenshots.
