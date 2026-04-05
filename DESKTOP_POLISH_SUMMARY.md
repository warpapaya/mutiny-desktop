# Desktop Polish Summary

This file previously documented the initial Stoat-to-Mutiny rename work.

That migration is now complete and this repo should be treated as a fully Mutiny-branded desktop client. If further branding work is needed, track it in GitHub issues and release notes instead of keeping one-off migration notes here.

## Ongoing standards

- Mutiny is the only end-user product name in desktop UI and release assets.
- Desktop icons should be generated from the same canonical source artwork used by the iOS app.
- Release QA should verify window title, tray text, installer metadata, app icon, and stable download asset names on every release.
- CI should fail if upstream Stoat/Revolt branding reappears in tracked files.
