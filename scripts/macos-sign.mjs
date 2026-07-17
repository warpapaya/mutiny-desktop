#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { basename, relative } from "node:path";
import {
  ENTITLEMENT_PATHS,
  EXPECTED_TEAM,
  discoverSignablePaths,
  profileForApp,
  requireFile,
  resolveMacosTools,
  validateAppPath,
  verifyAdHocApp,
  verifyReleaseApp,
} from "./macos-signing-verification.mjs";

const MODES = new Set(["dev-ad-hoc", "release-developer-id"]);

function fail(message) {
  console.error(`macOS signing blocked: ${message}`);
  process.exit(1);
}

try {
  const args = process.argv.slice(2);
  const mode = process.env.MUTINY_MACOS_SIGNING_MODE;
  if (args.length !== 1) throw new Error("pass exactly one packaged .app path as the sole argument");
  if (!MODES.has(mode)) {
    throw new Error("set MUTINY_MACOS_SIGNING_MODE to exactly dev-ad-hoc or release-developer-id");
  }
  if (mode === "release-developer-id" && process.env.MUTINY_DEVELOPER_ID_TEAM !== EXPECTED_TEAM) {
    throw new Error(`release mode requires MUTINY_DEVELOPER_ID_TEAM=${EXPECTED_TEAM}`);
  }

  const tools = resolveMacosTools(["security", "file", "codesign"]);
  const [appPath] = args;
  validateAppPath(appPath, "packaged app");
  for (const [profile, path] of Object.entries(ENTITLEMENT_PATHS)) {
    requireFile(path, `${profile} entitlements`);
  }

  const discovered = discoverSignablePaths(appPath, tools.file);
  let identity = "-";
  let authority = null;
  if (mode === "release-developer-id") {
    const output = execFileSync(
      tools.security,
      ["find-identity", "-v", "-p", "codesigning"],
      { encoding: "utf8" },
    );
    const records = [];
    const pattern = /^\s*\d+\)\s+([0-9A-Fa-f]{40})\s+"(Developer ID Application:[^"]+\(([A-Z0-9]{10})\))"\s*$/gm;
    for (const match of output.matchAll(pattern)) {
      if (match[3] === EXPECTED_TEAM) {
        records.push({ hash: match[1].toUpperCase(), authority: match[2] });
      }
    }
    if (records.length !== 1) {
      throw new Error(
        `expected exactly one valid Developer ID Application identity for team ${EXPECTED_TEAM}; found ${records.length}`,
      );
    }
    identity = records[0].hash;
    authority = records[0].authority;
  }

  const sign = (path, profile = null) => {
    const signArgs = ["--force", "--sign", identity];
    if (mode === "release-developer-id") signArgs.push("--options", "runtime", "--timestamp");
    if (profile) signArgs.push("--entitlements", ENTITLEMENT_PATHS[profile]);
    signArgs.push("--", path);
    execFileSync(tools.codesign, signArgs, { stdio: "inherit" });
  };

  for (const path of discovered.leaves) sign(path);
  for (const path of discovered.bundlePaths) sign(path, profileForApp(appPath, path));
  sign(appPath, "top");

  if (mode === "release-developer-id") {
    verifyReleaseApp(appPath, tools, discovered, authority);
  } else {
    verifyAdHocApp(appPath, tools, discovered);
  }
  console.log(
    `Signed ${relative(process.cwd(), appPath)} (${basename(appPath)}) in ${mode} mode with explicit entitlement profiles.`,
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
