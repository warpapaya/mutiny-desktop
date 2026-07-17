# macOS signing and notarization

## Release contract

The direct-distribution macOS release contract is intentionally fixed and fail-closed:

- Electron is **38.1.2** in both `package.json` and `pnpm-lock.yaml`; release work must not silently resolve or package another Electron version.
- The app bundle identifier is `com.electron.mutiny`; helper identifiers derive from the explicit `com.electron.mutiny.helper` base.
- The only accepted Developer ID team is `VF5SMXSV89` (`MUTINY_DEVELOPER_ID_TEAM`). `package:mac:release` supplies that expected value.
- The signing implementation resolves exactly one valid `Developer ID Application` record for that team from `security find-identity`, validates its 40-hex certificate hash, and passes the hash—not a common-name label—to every `codesign` invocation.
- Forge's macOS `postPackage` hook accepts exactly one `outputPath`; unexpected multiple/no outputs abort rather than leaving an unsigned output.

These values preserve the identity used by the first accepted Electron 38.1.2 proof artifact. Changing Electron, bundle IDs, or team is a release-contract change and requires a fresh signing/notarization review.

## Packaging modes

- Local test build: `pnpm package:mac:dev` creates an ad-hoc-signed artifact. It is not Gatekeeper-ready and must never be published as a direct-distribution release.
- Release build: `pnpm package:mac:release` requires exactly one valid Developer ID Application identity for team `VF5SMXSV89`. The script adds hardened runtime and an explicit secure `--timestamp` to every signing operation.

The signer accepts exactly one canonical absolute, non-symlink `.app` directory with the expected `Contents/Info.plist`, `Contents/MacOS/mutiny-desktop`, and `Contents/Frameworks` structure. It inspects every regular file with `file`; inspection/traversal failures abort. Code is signed inside-out without `--deep`, then every signed leaf/bundle and the top app are checked for structural validity. Release mode additionally verifies the selected Developer ID Authority, `TeamIdentifier=VF5SMXSV89`, hardened-runtime flag, and secure timestamp for every signed object. A final `codesign --verify --deep --strict` is verification only.

## Entitlement profiles

The five explicit profiles mirror the role split in installed `@electron/osx-sign` **1.3.3** for Electron **38.1.2**, while removing device grants from helper processes:

| Role | Profile | Exceptions |
| --- | --- | --- |
| Top app | `entitlements.mac.plist` | JIT, microphone, camera |
| Generic helper | `entitlements.mac.helper.plist` | JIT only |
| Renderer helper | `entitlements.mac.renderer.plist` | JIT only |
| GPU helper | `entitlements.mac.gpu.plist` | JIT only |
| Plugin helper | `entitlements.mac.plugin.plist` | unsigned executable memory and disable-library-validation |

Renderer, GPU, and Plugin match the installed package profiles `default.darwin.renderer.plist`, `default.darwin.gpu.plist`, and `default.darwin.plugin.plist`; notably, the Plugin exception is retained. Camera and microphone access remain only on the top app. The generic helper keeps the JIT exception from the installed Darwin default but receives none of that default profile's device/privacy grants.

Installed implementation reference: `node_modules/@electron/osx-sign/dist/cjs/sign.js` (`defaultOptionsForFile`). Upstream source: <https://github.com/electron/osx-sign/blob/v1.3.3/src/sign.ts>. Apple hardened-runtime guidance: <https://developer.apple.com/documentation/security/hardened-runtime>. Apple custom notarization workflow: <https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution/customizing-the-notarization-workflow>.

## Notarization

After release packaging, notarize exactly the output app with a pre-created keychain profile (no secrets in environment or repository):

```sh
export MUTINY_NOTARY_KEYCHAIN_PROFILE='mutiny-notary'
pnpm notarize:mac -- /absolute/path/to/out/Mutiny-darwin-arm64/Mutiny.app
```

The profile name is constrained to a simple non-option value. The command validates the canonical app path before creating staging, creates a private temporary ZIP, waits for `notarytool submit`, and only then staples, validates the ticket, and runs `spctl --assess`. Any failed stage prevents later stages, and staging is removed in `finally` on success or failure. `codesign --verify` alone is not a Gatekeeper acceptance claim.

## Release gates and credentials

A release operator must make available exactly one `Developer ID Application` identity for team `VF5SMXSV89` and one matching `notarytool` keychain profile. Do not put certificate labels, private keys, Apple credentials, or passwords in the repository or command arguments.

Behavioral tests use synthetic app bundles and fake `security`, `file`, `codesign`, `ditto`, `xcrun`, and `spctl` tools. They prove orchestration and failure ordering without touching the keychain or Apple services. They do **not** replace the credentialed release gate: package the exact commit on a controlled Mac, notarize to `Accepted`, staple/validate, assess with Gatekeeper, verify the ZIP roundtrip, and perform a quarantined first-launch/TCC/update-path check on a clean Mac.
