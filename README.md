<div align="center">
<h1>
  Mutiny Desktop
  
  [![Stars](https://img.shields.io/github/stars/warpapaya/mutiny-desktop?style=flat-square&logoColor=white)](https://github.com/warpapaya/mutiny-desktop/stargazers)
  [![Forks](https://img.shields.io/github/forks/warpapaya/mutiny-desktop?style=flat-square&logoColor=white)](https://github.com/warpapaya/mutiny-desktop/network/members)
  [![Pull Requests](https://img.shields.io/github/issues-pr/warpapaya/mutiny-desktop?style=flat-square&logoColor=white)](https://github.com/warpapaya/mutiny-desktop/pulls)
  [![Issues](https://img.shields.io/github/issues/warpapaya/mutiny-desktop?style=flat-square&logoColor=white)](https://github.com/warpapaya/mutiny-desktop/issues)
  [![Contributors](https://img.shields.io/github/contributors/warpapaya/mutiny-desktop?style=flat-square&logoColor=white)](https://github.com/warpapaya/mutiny-desktop/graphs/contributors)
  [![License](https://img.shields.io/github/license/warpapaya/mutiny-desktop?style=flat-square&logoColor=white)](https://github.com/warpapaya/mutiny-desktop/blob/main/LICENSE)
</h1>
Desktop application for Windows, macOS, and Linux.
</div>
<br/>

## Usage

Download the latest release from the [Releases](https://github.com/warpapaya/mutiny-desktop/releases) page, or build from source below.

## Development Guide

Before getting started, you'll want to install:

- Git
- Node.js
- pnpm (run `corepack enable`)

Then proceed to setup:

```bash
# clone the repository
git clone --recursive https://github.com/warpapaya/mutiny-desktop
cd mutiny-desktop

# install all packages
pnpm i --frozen-lockfile

# start the application
pnpm start
# ... or build the bundle
pnpm package
# ... or build all distributables
pnpm make
```

Various useful commands for development testing:

```bash
# connect to the development server
pnpm start -- --force-server http://localhost:5173

# test the flatpak (after `make`)
pnpm install:flatpak
pnpm run:flatpak
# ... also connect to dev server like so:
pnpm run:flatpak --force-server http://localhost:5173

# Nix-specific instructions for testing
pnpm package
pnpm run:nix
# ... as before:
pnpm run:nix --force-server=http://localhost:5173
```

### Pulling in brand assets

If you want to pull in Mutiny brand assets after pulling, run the following:

```bash
# update the assets
git -c submodule."assets".update=checkout submodule update --init assets
```

Currently, this is required to build. Any forks are expected to provide their own assets.
