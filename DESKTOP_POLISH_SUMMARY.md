# Mutiny Desktop App Polish - Summary

**Branch:** `feat/desktop-polish`  
**Commit:** 61ace4c

## Changes Made

### 1. Branding Updates ✅

- **autoLaunch.ts**: Changed app name from "Stoat" to "Mutiny" for launch-on-login functionality
- **discordRpc.ts**: Updated Discord Rich Presence to show "mutinyapp.gg" and "Join Mutiny" instead of old Stoat references
- **badges.ts**: Fixed Linux desktop file references from `stoat-desktop.desktop` to `mutiny-desktop.desktop`
- **package.json**: Changed `productName` from "mutiny-desktop" to "Mutiny" (cleaner app name)
- **index.html**: Updated window title from "Hello World!" to "Mutiny"

### 2. Deep Link Protocol Handler ✅

Added support for `mutiny://` protocol URLs:
- Registered `mutiny://` protocol handler in main.ts
- Added macOS `CFBundleURLTypes` configuration in forge.config.ts
- Implemented cross-platform protocol URL handling:
  - macOS: via `open-url` event
  - Windows/Linux: via command-line args
- Protocol URLs are forwarded to renderer via `protocol-url` IPC message

### 3. Already Working ✅

- **Window icon**: Mutiny icon properly set in window.ts
- **Tray icon**: Already branded as "Mutiny for Desktop"
- **Auto-update**: Using `update-electron-app` with correct GitHub repo
- **About dialog**: Tray menu shows version in submenu
- **Build configuration**: forge.config.ts has correct Mutiny branding
- **Notifications**: Desktop notifications configured in main.ts
- **Startup behavior**: "Launch on login" supported via auto-launch
- **macOS specifics**: 
  - Menu handling via `setMenu(null)`
  - Dock badge support in badges.ts
  - Native entitlements for camera/microphone/screen capture

## Testing Checklist

### Manual Testing
- [ ] Run `pnpm install && pnpm dev`
- [ ] Verify window title says "Mutiny"
- [ ] Check tray icon tooltip says "Mutiny for Desktop"
- [ ] Test launch-on-login toggle (if available in settings)
- [ ] Verify Discord Rich Presence shows correct branding (if enabled)
- [ ] Test protocol handler: `open mutiny://test-invite-link` (macOS)
- [ ] Build the app and verify packaged app name is "Mutiny"

### Build Testing
```bash
cd ~/Projects/mutiny-desktop
pnpm make  # Creates distributable packages
```

## Files Modified

1. `forge.config.ts` - Added CFBundleURLTypes for protocol handler
2. `index.html` - Updated title
3. `package.json` - Changed productName
4. `src/main.ts` - Added protocol handler registration and URL handling
5. `src/native/autoLaunch.ts` - Updated app name
6. `src/native/badges.ts` - Fixed desktop file references
7. `src/native/discordRpc.ts` - Updated Discord RPC branding

## Notes

- **Auto-update URL**: Correctly pointing to `warpapaya/mutiny-desktop` on GitHub
- **Protocol handler**: The web app will need to emit `protocol-url` events if it wants to handle deep links
- **No merge to main**: Changes are committed to `feat/desktop-polish` branch only
- **Window customization**: The app uses a custom frame by default (can be toggled in settings)
- **Notification ID**: Windows notifications use `gg.mutinyapp.notifications` as the app user model ID

## Remaining TODOs (Optional)

- [ ] Add an "About Mutiny" menu item to show app version, credits, and links
- [ ] Test protocol handler integration with web app invite flows
- [ ] Consider adding custom notification sounds
- [ ] Test all build targets (Windows, macOS, Linux)
- [ ] Update any screenshots or documentation showing the old branding

## How to Test Protocol Handler

### macOS
```bash
open mutiny://invite/test-channel-id
```

### Linux/Windows
```bash
mutiny-desktop mutiny://invite/test-channel-id
```

The renderer should receive the URL via IPC and can parse it to handle invites, channel links, etc.
