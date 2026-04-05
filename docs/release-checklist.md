# Mutiny Desktop Release Checklist

## Branding QA

- [ ] App icon matches current iOS app icon on macOS and Windows
- [ ] Window title and tray text say Mutiny
- [ ] Installer/executable names are Mutiny-branded
- [ ] About/account/version surfaces do not show upstream branding
- [ ] Stable GitHub release asset names are correct

## Runtime QA

- [ ] App boots without a white screen on macOS
- [ ] App boots without a white screen on Windows
- [ ] Hosted app at `https://app.mutinyapp.gg` passes smoke test
- [ ] External links open outside the Electron shell
- [ ] Auto-update points to the intended Mutiny Desktop release channel

## Regression QA

- [ ] Brand regression workflow passes
- [ ] Hosted smoke test workflow passes
- [ ] Manual grep found no unexpected upstream branding in tracked files
