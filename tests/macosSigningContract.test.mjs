import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const signScript = join(root, "scripts", "macos-sign.mjs");
const notaryScript = join(root, "scripts", "macos-notarize.mjs");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const configSource = readFileSync(join(root, "forge.config.ts"), "utf8");
const signSource = readFileSync(signScript, "utf8");
const notarySource = readFileSync(notaryScript, "utf8");
const verificationSource = readFileSync(join(root, "scripts", "macos-signing-verification.mjs"), "utf8");
const lockfile = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
const workspaces = [];
const HASH = "0123456789ABCDEF0123456789ABCDEF01234567";
const TEAM = "VF5SMXSV89";
const AUTHORITY = `Developer ID Application: Mutiny Release (${TEAM})`;

function validMetadata(overrides = {}) {
  const values = {
    identifier: "com.electron.mutiny",
    authority: AUTHORITY,
    team: TEAM,
    timestamp: "Jul 15, 2026 at 12:00:00 PM",
    runtime: "CodeDirectory v=20500 size=447 flags=0x10000(runtime) hashes=3+7 location=embedded",
    ...overrides,
  };
  return [
    `Identifier=${values.identifier}`,
    `Authority=${values.authority}`,
    "Authority=Developer ID Certification Authority",
    "Authority=Apple Root CA",
    `TeamIdentifier=${values.team}`,
    `Timestamp=${values.timestamp}`,
    values.runtime,
  ].join("\n") + "\n";
}

function workspace() {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "mutiny-sign-test-")));
  workspaces.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of workspaces.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function makeApp(directory) {
  const app = join(directory, "Mutiny.app");
  const macho = [];
  const makeBundle = (bundle, executable) => {
    mkdirSync(join(bundle, "Contents", "MacOS"), { recursive: true });
    writeFileSync(join(bundle, "Contents", "Info.plist"), "plist");
    const executablePath = join(bundle, "Contents", "MacOS", executable);
    writeFileSync(executablePath, "mach-o");
    macho.push(executablePath);
  };

  makeBundle(app, "mutiny-desktop");
  const frameworks = join(app, "Contents", "Frameworks");
  mkdirSync(frameworks, { recursive: true });
  for (const suffix of ["", " (Renderer)", " (GPU)", " (Plugin)"]) {
    makeBundle(join(frameworks, `Mutiny Helper${suffix}.app`), `Mutiny Helper${suffix}`);
  }
  const framework = join(frameworks, "Electron Framework.framework");
  mkdirSync(join(framework, "Versions", "A"), { recursive: true });
  const frameworkBinary = join(framework, "Versions", "A", "Electron Framework");
  writeFileSync(frameworkBinary, "mach-o");
  macho.push(frameworkBinary);
  return { app, macho };
}

function makeFakeTools(directory) {
  const bin = join(directory, "bin");
  mkdirSync(bin, { recursive: true });
  const fake = join(bin, "fake-tool");
  writeFileSync(
    fake,
    `#!${process.execPath}
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
const tool = basename(process.argv[1]);
const args = process.argv.slice(2);
appendFileSync(process.env.FAKE_TOOL_LOG, JSON.stringify({ tool, args }) + "\\n");
const fail = (message) => { console.error(message); process.exit(23); };
if (tool === "security") {
  process.stdout.write(process.env.FAKE_IDENTITIES || '  1) ${HASH} "${AUTHORITY}"\\n     1 valid identities found\\n');
} else if (tool === "file") {
  const candidate = args.at(-1);
  if (candidate === process.env.FAKE_FILE_FAIL) fail("file inspection failed");
  const machos = JSON.parse(process.env.FAKE_MACHOS || "[]");
  process.stdout.write(machos.includes(candidate) ? "Mach-O 64-bit executable\\n" : "ASCII text\\n");
} else if (tool === "codesign" && args.includes("--verify")) {
  if (process.env.FAKE_FAIL_STAGE === "codesign-verify" ||
      (process.env.FAKE_FAIL_STAGE === "deep-verify" && args.includes("--deep"))) fail("signature invalid");
} else if (tool === "codesign" && args.includes("--entitlements") && args.includes(":-")) {
  if (process.env.FAKE_FAIL_STAGE === "entitlements") fail("entitlements unreadable");
  const target = args.at(-1);
  const name = basename(target);
  let profile = "helper";
  if (name === "Mutiny.app") profile = "top";
  else if (name.includes("(Renderer)")) profile = "renderer";
  else if (name.includes("(GPU)")) profile = "gpu";
  else if (name.includes("(Plugin)")) profile = "plugin";
  const entitlementFile = profile === "top" ? "entitlements.mac.plist" : "entitlements.mac." + profile + ".plist";
  const contents = process.env.FAKE_EFFECTIVE_ENTITLEMENTS || readFileSync(join(process.env.FAKE_ENTITLEMENTS_ROOT, entitlementFile), "utf8");
  process.stderr.write(contents);
} else if (tool === "codesign" && args.includes("-d")) {
  if (process.env.FAKE_FAIL_STAGE === "codesign-display") fail("metadata unreadable");
  const target = args.at(-1);
  const identifier = target.endsWith(".app")
    ? (basename(target) === "Mutiny.app" ? "com.electron.mutiny" : "com.electron.mutiny.helper")
    : "libvk_swiftshader";
  process.stderr.write(process.env.FAKE_CODESIGN_METADATA || "Identifier=" + identifier + "\\nAuthority=${AUTHORITY}\\nAuthority=Developer ID Certification Authority\\nAuthority=Apple Root CA\\nTeamIdentifier=${TEAM}\\nTimestamp=Jul 15, 2026 at 12:00:00 PM\\nCodeDirectory v=20500 size=447 flags=0x10000(runtime) hashes=3+7 location=embedded\\n");
} else if (tool === "codesign" && args.includes("--sign")) {
  if (process.env.FAKE_FAIL_STAGE === "codesign-sign") fail("sign failed");
} else if (tool === "ditto") {
  if (process.env.FAKE_FAIL_STAGE === "ditto") fail("ditto failed");
  writeFileSync(args.at(-1), "zip");
} else if (tool === "xcrun") {
  const stage = args[0] === "notarytool" ? "notarytool" : args[1];
  if (process.env.FAKE_FAIL_STAGE === stage) fail(stage + " failed");
} else if (tool === "spctl" && process.env.FAKE_FAIL_STAGE === "spctl") {
  fail("spctl failed");
}
`,
  );
  chmodSync(fake, 0o755);
  for (const tool of ["security", "file", "codesign", "ditto", "xcrun", "spctl"]) {
    symlinkSync("fake-tool", join(bin, tool));
  }
  return bin;
}

function runScript(script, args, overrides = {}, fixture) {
  const directory = fixture ?? workspace();
  const log = join(directory, `tools-${Math.random()}.jsonl`);
  const bin = makeFakeTools(join(directory, `fake-${Math.random()}`));
  const result = spawnSync(process.execPath, [script, ...args], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      MUTINY_TEST_TOOL_DIR: bin,
      PATH: "/definitely/not/a/tool/path",
      FAKE_TOOL_LOG: log,
      FAKE_ENTITLEMENTS_ROOT: root,
      MUTINY_MACOS_SIGNING_MODE: "release-developer-id",
      MUTINY_DEVELOPER_ID_TEAM: TEAM,
      MUTINY_NOTARY_KEYCHAIN_PROFILE: "mutiny-notary",
      ...overrides,
    },
    encoding: "utf8",
  });
  const calls = existsSync(log)
    ? readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];
  return { result, calls };
}

function signedFixture(overrides = {}) {
  const directory = workspace();
  const fixture = makeApp(directory);
  return {
    ...fixture,
    directory,
    run: (extra = {}) =>
      runScript(
        signScript,
        [fixture.app],
        { FAKE_MACHOS: JSON.stringify(fixture.macho), ...overrides, ...extra },
        directory,
      ),
  };
}

describe("macOS release contract", () => {
  it("pins the resolved Electron release and stable bundle identifiers", () => {
    expect(packageJson.devDependencies.electron).toBe("38.1.2");
    expect(lockfile).toContain("electron@38.1.2:");
    expect(lockfile).toContain("'@electron/osx-sign@1.3.3':");
    expect(configSource).toContain('appBundleId: "com.electron.mutiny"');
    expect(configSource).toContain('helperBundleId: "com.electron.mutiny.helper"');
    expect(configSource).toContain("options.outputPaths.length !== 1");
    expect(packageJson.scripts["package:mac:release"]).toContain(
      `MUTINY_DEVELOPER_ID_TEAM=${TEAM}`,
    );
  });

  it("keeps helper entitlements least-privilege and retains the Plugin exception", () => {
    for (const profile of ["helper", "renderer", "gpu", "plugin"]) {
      const contents = readFileSync(join(root, `entitlements.mac.${profile}.plist`), "utf8");
      expect(contents).not.toContain("com.apple.security.device.audio-input");
      expect(contents).not.toContain("com.apple.security.device.camera");
    }
    expect(readFileSync(join(root, "entitlements.mac.plugin.plist"), "utf8")).toContain(
      "com.apple.security.cs.disable-library-validation",
    );
  });

  it("pins absolute production tool paths and permits injection only in tests", () => {
    const combined = `${signSource}\n${notarySource}\n${verificationSource}`;
    for (const path of [
      "/usr/bin/security",
      "/usr/bin/file",
      "/usr/bin/codesign",
      "/usr/bin/ditto",
      "/usr/bin/xcrun",
      "/usr/sbin/spctl",
    ]) {
      expect(combined).toContain(path);
    }
    expect(combined).toContain("MUTINY_TEST_TOOL_DIR");

    const directory = workspace();
    const fixture = makeApp(directory);
    const fakeDirectory = makeFakeTools(join(directory, "production-fakes"));
    const log = join(directory, "production-tools.jsonl");
    const result = spawnSync(process.execPath, [signScript, fixture.app], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        MUTINY_TEST_TOOL_DIR: fakeDirectory,
        FAKE_TOOL_LOG: log,
        MUTINY_MACOS_SIGNING_MODE: "release-developer-id",
        MUTINY_DEVELOPER_ID_TEAM: TEAM,
      },
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("MUTINY_TEST_TOOL_DIR");
    expect(existsSync(log)).toBe(false);
  });

  it("uses one shared verifier for post-sign and pre-notary release checks", () => {
    expect(signSource).toContain('from "./macos-signing-verification.mjs"');
    expect(notarySource).toContain('from "./macos-signing-verification.mjs"');
    expect(signSource).toContain("verifyReleaseApp(appPath");
    expect(notarySource).toContain("verifyReleaseApp(appPath");
    expect((verificationSource.match(/export function verifyReleaseApp/g) ?? [])).toHaveLength(1);
  });

  it("uses the unique team-pinned identity hash, timestamp, helper profiles, and inside-out order", () => {
    const fixture = signedFixture();
    const { result, calls } = fixture.run();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const signCalls = calls.filter(
      ({ tool, args }) => tool === "codesign" && args.includes("--sign"),
    );
    expect(signCalls.length).toBeGreaterThan(6);
    for (const { args } of signCalls) {
      expect(args).toContain("--timestamp");
      expect(args).toContain("runtime");
      expect(args[args.indexOf("--sign") + 1]).toBe(HASH);
      expect(args.at(-2)).toBe("--");
    }

    const entitlementFor = (name) => {
      const call = signCalls.find(({ args }) => args.at(-1).endsWith(name));
      expect(call).toBeDefined();
      return basename(call.args[call.args.indexOf("--entitlements") + 1]);
    };
    expect(entitlementFor("Mutiny.app")).toBe("entitlements.mac.plist");
    expect(entitlementFor("Mutiny Helper.app")).toBe("entitlements.mac.helper.plist");
    expect(entitlementFor("Mutiny Helper (Renderer).app")).toBe(
      "entitlements.mac.renderer.plist",
    );
    expect(entitlementFor("Mutiny Helper (GPU).app")).toBe("entitlements.mac.gpu.plist");
    expect(entitlementFor("Mutiny Helper (Plugin).app")).toBe(
      "entitlements.mac.plugin.plist",
    );

    const signedPaths = signCalls.map(({ args }) => args.at(-1));
    for (const suffix of ["", " (Renderer)", " (GPU)", " (Plugin)"]) {
      const helper = join(
        fixture.app,
        "Contents",
        "Frameworks",
        `Mutiny Helper${suffix}.app`,
      );
      expect(signedPaths.indexOf(join(helper, "Contents", "MacOS", `Mutiny Helper${suffix}`))).toBeLessThan(
        signedPaths.indexOf(helper),
      );
      expect(signedPaths.indexOf(helper)).toBeLessThan(signedPaths.indexOf(fixture.app));
    }
    expect(signedPaths.at(-1)).toBe(fixture.app);
  });

  it("post-verifies every signed object for signature, authority, team, runtime, and timestamp", () => {
    const { result, calls } = signedFixture().run();
    expect(result.status).toBe(0);
    const signCount = calls.filter(({ tool, args }) => tool === "codesign" && args.includes("--sign"))
      .length;
    const verifies = calls.filter(
      ({ tool, args }) => tool === "codesign" && args.includes("--verify") && !args.includes("--deep"),
    );
    const displays = calls.filter(
      ({ tool, args }) => tool === "codesign" && args.includes("-d") && args.includes("--verbose=4"),
    );
    const entitlementDisplays = calls.filter(
      ({ tool, args }) => tool === "codesign" && args.includes("--entitlements") && args.includes(":-"),
    );
    expect(verifies).toHaveLength(signCount);
    expect(displays).toHaveLength(signCount);
    expect(entitlementDisplays).toHaveLength(5);
    for (const { args } of verifies) {
      expect(args).toEqual(["--verify", "--strict", "--verbose=2", "--", args.at(-1)]);
    }
    for (const { args } of displays) {
      expect(args).toEqual(["-d", "--verbose=4", "--", args.at(-1)]);
    }
  });

  it("fails closed when Mach-O inspection fails", () => {
    const fixture = signedFixture();
    const failedPath = fixture.macho[0];
    const { result, calls } = fixture.run({ FAKE_FILE_FAIL: failedPath });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(failedPath);
    expect(calls.find(({ tool, args }) => tool === "file" && args.at(-1) === failedPath)?.args).toEqual([
      "-b",
      "--",
      failedPath,
    ]);
    expect(calls.some(({ tool, args }) => tool === "codesign" && args.includes("--sign"))).toBe(false);
  });

  it("rejects ambiguous, missing, or wrong-team Developer ID records", () => {
    const fixture = signedFixture();
    const duplicate = `  1) ${HASH} "${AUTHORITY}"\n  2) AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA "${AUTHORITY}"\n`;
    for (const overrides of [
      { FAKE_IDENTITIES: "0 valid identities found\n" },
      { FAKE_IDENTITIES: duplicate },
      { MUTINY_DEVELOPER_ID_TEAM: "WRONGTEAM" },
    ]) {
      const { result, calls } = fixture.run(overrides);
      expect(result.status).not.toBe(0);
      expect(calls.some(({ tool }) => tool === "codesign")).toBe(false);
    }
  });

  it("rejects missing, extra, relative, file, symlink, non-app, and malformed app arguments", () => {
    const directory = workspace();
    const valid = makeApp(directory).app;
    const file = join(directory, "file.app");
    writeFileSync(file, "not a directory");
    const symlink = join(directory, "linked.app");
    symlinkSync(valid, symlink);
    const nonApp = join(directory, "Mutiny.bundle");
    mkdirSync(nonApp);
    const malformed = join(directory, "Malformed.app");
    mkdirSync(malformed);
    const cases = [
      [],
      [valid, valid],
      ["relative.app"],
      [file],
      [symlink],
      [nonApp],
      [malformed],
    ];
    for (const args of cases) {
      const { result, calls } = runScript(signScript, args, {}, directory);
      expect(result.status).not.toBe(0);
      expect(calls.some(({ tool }) => tool === "codesign")).toBe(false);
    }
  });

  it("rejects absent or unknown modes before tool lookup and signing", () => {
    const directory = workspace();
    const { app } = makeApp(directory);
    for (const mode of [undefined, "unknown"]) {
      const overrides = { MUTINY_MACOS_SIGNING_MODE: mode };
      const { result, calls } = runScript(signScript, [app], overrides, directory);
      expect(result.status).not.toBe(0);
      expect(calls).toHaveLength(0);
    }
  });

  it("fails tool lookup and traversal before identity lookup or signing, then stops on sign failure", () => {
    const directory = workspace();
    const fixture = makeApp(directory);
    const incompleteTools = makeFakeTools(join(directory, "incomplete-tools"));
    unlinkSync(join(incompleteTools, "codesign"));
    const missingTool = runScript(
      signScript,
      [fixture.app],
      { MUTINY_TEST_TOOL_DIR: incompleteTools },
      directory,
    );
    expect(missingTool.result.status).not.toBe(0);
    expect(missingTool.calls).toHaveLength(0);

    const malformed = join(directory, "Malformed.app");
    mkdirSync(malformed);
    const badStat = runScript(signScript, [malformed], {}, directory);
    expect(badStat.result.status).not.toBe(0);
    expect(badStat.calls).toHaveLength(0);

    const signFailure = runScript(
      signScript,
      [fixture.app],
      { FAKE_MACHOS: JSON.stringify(fixture.macho), FAKE_FAIL_STAGE: "codesign-sign" },
      directory,
    );
    expect(signFailure.result.status).not.toBe(0);
    const firstSign = signFailure.calls.findIndex(
      ({ tool, args }) => tool === "codesign" && args.includes("--sign"),
    );
    expect(firstSign).toBeGreaterThan(0);
    expect(signFailure.calls.slice(0, firstSign).some(({ tool }) => tool === "security")).toBe(true);
    expect(signFailure.calls.slice(0, firstSign).filter(({ tool }) => tool === "file").length).toBeGreaterThan(0);
    expect(signFailure.calls.slice(firstSign + 1).some(({ tool }) => tool === "codesign")).toBe(false);
  });

  it("rejects malformed exact-line metadata with every fixture isolating one invariant", () => {
    const base = validMetadata();
    const metadata = [
      base.replace(`Authority=${AUTHORITY}\n`, ""),
      base.replace(`TeamIdentifier=${TEAM}\n`, ""),
      base.replace(/Timestamp=.*\n/, ""),
      base.replace(/CodeDirectory.*\n/, "CodeDirectory v=20500 flags=0x0\n"),
      validMetadata({ identifier: "com.electron.mutiny.evil" }),
      validMetadata({ authority: `${AUTHORITY} trailing` }),
      base.replace(`Authority=${AUTHORITY}\n`, `Authority=${AUTHORITY}\nAuthority=${AUTHORITY}\n`),
      validMetadata({ timestamp: "none" }),
      validMetadata({ timestamp: "definitely-not-a-date" }),
      base.replace(/Timestamp=.*\n/, "Timestamp=Jul 15, 2026 at 12:00:00 PM\nTimestamp=Jul 16, 2026 at 12:00:00 PM\n"),
      base.replace(`TeamIdentifier=${TEAM}`, `NotTeamIdentifier=${TEAM}`),
    ];
    for (const FAKE_CODESIGN_METADATA of metadata) {
      const { result } = signedFixture({ FAKE_CODESIGN_METADATA }).run();
      expect(result.status).not.toBe(0);
    }
  });
});

describe("macOS notarization orchestration", () => {
  it("submits before stapling and assessment, uses absolute paths, and cleans staging", () => {
    const directory = workspace();
    const { app } = makeApp(directory);
    const { result, calls } = runScript(notaryScript, [app], {}, directory);
    expect(result.status).toBe(0);
    const operations = calls.filter(({ tool }) => ["ditto", "xcrun", "spctl"].includes(tool));
    expect(operations.map(({ tool, args }) => `${tool}:${args.slice(0, 2).join(" ")}`)).toEqual([
      "ditto:-c -k",
      "xcrun:notarytool submit",
      "xcrun:stapler staple",
      "xcrun:stapler validate",
      "spctl:--assess --type",
    ]);
    const archive = operations[0].args.at(-1);
    expect(archive.startsWith("/")).toBe(true);
    expect(existsSync(archive)).toBe(false);
    expect(existsSync(dirname(archive))).toBe(false);
  });

  it("rejects wrong-team, ad-hoc, modified, malformed, and wrong-entitlement apps before archive", () => {
    const invalidCases = [
      { FAKE_CODESIGN_METADATA: validMetadata({ team: "WRONGTEAM1" }) },
      {
        FAKE_CODESIGN_METADATA: validMetadata().replace(
          `Authority=${AUTHORITY}`,
          "Authority=adhoc",
        ),
      },
      { FAKE_FAIL_STAGE: "deep-verify" },
      { FAKE_CODESIGN_METADATA: validMetadata({ timestamp: "none" }) },
      {
        FAKE_EFFECTIVE_ENTITLEMENTS: readFileSync(join(root, "entitlements.mac.helper.plist"), "utf8"),
      },
    ];
    for (const overrides of invalidCases) {
      const directory = workspace();
      const { app } = makeApp(directory);
      const { result, calls } = runScript(notaryScript, [app], overrides, directory);
      expect(result.status).not.toBe(0);
      expect(calls.some(({ tool }) => tool === "ditto")).toBe(false);
      const firstCodesign = calls.find(({ tool }) => tool === "codesign");
      expect(firstCodesign?.args).toContain("--deep");
    }
  });

  it("stops after each failed notarization stage and always cleans staging", () => {
    for (const [stage, forbiddenTool, forbiddenArg] of [
      ["ditto", "xcrun", "notarytool"],
      ["notarytool", "xcrun", "stapler"],
      ["staple", "xcrun", "validate"],
      ["validate", "spctl", "--assess"],
      ["spctl", "spctl", "impossible-later-call"],
    ]) {
      const directory = workspace();
      const { app } = makeApp(directory);
      const { result, calls } = runScript(
        notaryScript,
        [app],
        { FAKE_FAIL_STAGE: stage },
        directory,
      );
      expect(result.status).not.toBe(0);
      if (stage !== "spctl") {
        expect(calls.some(({ tool, args }) => tool === forbiddenTool && args.includes(forbiddenArg))).toBe(
          false,
        );
      }
      const ditto = calls.find(({ tool }) => tool === "ditto");
      expect(ditto).toBeDefined();
      expect(existsSync(ditto.args.at(-1))).toBe(false);
      expect(existsSync(dirname(ditto.args.at(-1)))).toBe(false);
    }
  });

  it("rejects unsafe arguments and profile option injection before creating staging", () => {
    const directory = workspace();
    const { app } = makeApp(directory);
    const link = join(directory, "link.app");
    symlinkSync(app, link);
    for (const [args, overrides] of [
      [[], {}],
      [[app, app], {}],
      [["relative.app"], {}],
      [[link], {}],
      [[app], { MUTINY_NOTARY_KEYCHAIN_PROFILE: "--evil" }],
    ]) {
      const { result, calls } = runScript(notaryScript, args, overrides, directory);
      expect(result.status).not.toBe(0);
      expect(calls).toHaveLength(0);
    }
    expect(lstatSync(app).isDirectory()).toBe(true);
  });
});
