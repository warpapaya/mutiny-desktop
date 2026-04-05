<div align="center">

# ⚔️ Mutiny Desktop

**A modern, open-source chat platform — built for communities that want independence.**

[![Release](https://img.shields.io/github/v/release/warpapaya/mutiny-desktop?style=flat-square&color=7B2FBE)](https://github.com/warpapaya/mutiny-desktop/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/warpapaya/mutiny-desktop/total?style=flat-square&color=2EC4B6)](https://github.com/warpapaya/mutiny-desktop/releases)
[![License](https://img.shields.io/github/license/warpapaya/mutiny-desktop?style=flat-square)](https://github.com/warpapaya/mutiny-desktop/blob/main/LICENSE)

[Download](#download) • [Features](#features) • [Development](#development) • [Contributing](#contributing)

</div>

---

## Download

Get the latest version for your platform:

| Platform | Architecture | Link |
|----------|-------------|------|
| **macOS** | Apple Silicon (M1+) | [Download .zip](https://github.com/warpapaya/mutiny-desktop/releases/latest/download/Mutiny-darwin-arm64.zip) |
| **Windows** | x64 | [Download Installer](https://github.com/warpapaya/mutiny-desktop/releases/latest/download/Mutiny-Setup.exe) |

Or visit the [Releases](https://github.com/warpapaya/mutiny-desktop/releases) page for all available builds.

> **Auto-updates included** — once installed, Mutiny updates itself automatically in the background.

## Branding Source of Truth

Desktop branding should match the current iOS app branding.

- Canonical icon source: `warpapaya/mutiny-ios` → `Stoat/Resources/Assets.xcassets/AppIcons/default.appiconset/mutiny-app-icon-v4.png`
- Desktop export targets live in `assets/desktop/`
- Any icon refresh should regenerate `icon.png`, `icon.icns`, and `icon.ico` from the same source artwork

## Features

🎨 **Deep Purple Theme** — OLED-friendly dark interface designed for long sessions  
🎙️ **Voice Channels** — Crystal-clear voice powered by LiveKit  
🖥️ **Screen Sharing** — Share your screen with your community  
🔔 **Native Notifications** — System-level alerts with sound effects  
🔄 **Auto-Updates** — Always running the latest version  
🔒 **Self-Hostable** — Your data, your server, your rules  
📱 **Cross-Platform** — macOS, Windows, and web

## Screenshots

<div align="center">
<i>Coming soon</i>
</div>

## Development

### Prerequisites

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/) (`corepack enable`)

### Quick Start

```bash
# Clone with submodules
git clone --recursive https://github.com/warpapaya/mutiny-desktop
cd mutiny-desktop

# Install dependencies
pnpm i --frozen-lockfile

# Start in development mode
pnpm start

# Build distributable
pnpm make
```

### Development Commands

```bash
# Connect to a local dev server
pnpm start -- --force-server http://localhost:5173

# Package without creating installers
pnpm package

# Update brand assets
git -c submodule."assets".update=checkout submodule update --init assets
```

> **Note:** Brand assets are required to build. Forks should provide their own.

### Troubleshooting

#### White screen / hosted app fails to boot

If the shell opens but shows a blank page:

- check the target URL used by the desktop shell
- inspect renderer console output from Electron
- verify the hosted Mutiny app finishes loading at `https://app.mutinyapp.gg`
- verify CSP and network requests are not blocking startup resources
- verify the release channel still points to Mutiny-branded builds

## Architecture

Mutiny Desktop is an [Electron](https://www.electronjs.org/) wrapper around the [Mutiny web client](https://github.com/warpapaya/mutiny), built with [Electron Forge](https://www.electronforge.io/).

```
src/
├── main.ts           # Electron main process
├── renderer.ts       # Preload bridge
└── native/
    ├── window.ts     # Window management
    ├── autoLaunch.ts # Launch on startup
    ├── badges.ts     # Dock/taskbar badges
    └── tray.ts       # System tray
```

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your feature branch (`git checkout -b feat/awesome-feature`)
3. Commit your changes (`git commit -m 'feat: add awesome feature'`)
4. Push to the branch (`git push origin feat/awesome-feature`)
5. Open a Pull Request

## Community

- 🌐 **Web:** [mutinyapp.gg](https://mutinyapp.gg)
- 💬 **Chat:** [gamers.petieclark.com](https://gamers.petieclark.com)

## License

This project is licensed under the terms included in the [LICENSE](LICENSE) file.

---

<div align="center">
<sub>Built with ❤️ by the Mutiny community</sub>
</div>
