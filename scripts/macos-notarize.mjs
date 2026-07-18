#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  resolveMacosTools,
  validateAppPath,
  verifyReleaseApp,
} from "./macos-signing-verification.mjs";

function fail(message) {
  console.error(`macOS notarization blocked: ${message}`);
  process.exit(1);
}

try {
  const args = process.argv.slice(2);
  const profile = process.env.MUTINY_NOTARY_KEYCHAIN_PROFILE;
  if (args.length !== 1) throw new Error("pass exactly one signed .app path as the sole argument");
  if (!profile) throw new Error("set MUTINY_NOTARY_KEYCHAIN_PROFILE to an existing keychain profile name");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(profile)) {
    throw new Error("MUTINY_NOTARY_KEYCHAIN_PROFILE must be a simple non-option keychain profile name");
  }

  const tools = resolveMacosTools(["file", "codesign", "ditto", "xcrun", "spctl"]);
  const [appPath] = args;
  validateAppPath(appPath, "signed app");

  // This shared release verifier runs before staging exists or ditto can archive anything.
  verifyReleaseApp(appPath, tools);

  const staging = mkdtempSync(join(tmpdir(), "mutiny-notarize-"));
  const archive = join(staging, "Mutiny-notarize.zip");
  try {
    execFileSync(tools.ditto, ["-c", "-k", "--keepParent", appPath, archive], {
      stdio: "inherit",
    });
    execFileSync(
      tools.xcrun,
      ["notarytool", "submit", archive, "--keychain-profile", profile, "--wait"],
      { stdio: "inherit" },
    );
    execFileSync(tools.xcrun, ["stapler", "staple", appPath], { stdio: "inherit" });
    execFileSync(tools.xcrun, ["stapler", "validate", appPath], { stdio: "inherit" });
    execFileSync(
      tools.spctl,
      ["--assess", "--type", "execute", "--verbose=4", "--", appPath],
      { stdio: "inherit" },
    );
    console.log("Notarization, stapling, and Gatekeeper assessment passed.");
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
