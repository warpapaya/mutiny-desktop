import { execFileSync, spawnSync } from "node:child_process";
import { accessSync, constants, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join } from "node:path";

export const EXPECTED_TEAM = "VF5SMXSV89";
export const TOP_IDENTIFIER = "com.electron.mutiny";
export const HELPER_IDENTIFIER = "com.electron.mutiny.helper";

export const SYSTEM_TOOLS = Object.freeze({
  security: "/usr/bin/security",
  file: "/usr/bin/file",
  codesign: "/usr/bin/codesign",
  ditto: "/usr/bin/ditto",
  xcrun: "/usr/bin/xcrun",
  spctl: "/usr/sbin/spctl",
});

const root = dirname(import.meta.dirname);
export const ENTITLEMENT_PATHS = Object.freeze({
  top: join(root, "entitlements.mac.plist"),
  helper: join(root, "entitlements.mac.helper.plist"),
  renderer: join(root, "entitlements.mac.renderer.plist"),
  gpu: join(root, "entitlements.mac.gpu.plist"),
  plugin: join(root, "entitlements.mac.plugin.plist"),
});

export function resolveMacosTools(names) {
  const injected = process.env.MUTINY_TEST_TOOL_DIR;
  if (injected && process.env.NODE_ENV !== "test") {
    throw new Error("MUTINY_TEST_TOOL_DIR is test-only and is rejected unless NODE_ENV=test");
  }
  if (process.env.NODE_ENV === "test" && !injected) {
    throw new Error("NODE_ENV=test requires an explicit absolute MUTINY_TEST_TOOL_DIR");
  }

  let directory = null;
  if (injected) {
    if (!isAbsolute(injected)) throw new Error("MUTINY_TEST_TOOL_DIR must be absolute");
    const stat = lstatSync(injected);
    if (stat.isSymbolicLink() || !stat.isDirectory() || realpathSync(injected) !== injected) {
      throw new Error("MUTINY_TEST_TOOL_DIR must be a canonical non-symlink directory");
    }
    directory = injected;
  }

  return Object.fromEntries(
    names.map((name) => {
      const tool = directory ? join(directory, name) : SYSTEM_TOOLS[name];
      if (!tool) throw new Error(`no fixed system path configured for tool: ${name}`);
      try {
        accessSync(tool, constants.X_OK);
      } catch (error) {
        throw new Error(`required tool is unavailable or not executable: ${tool} (${error.message})`);
      }
      return [name, tool];
    }),
  );
}

export function requireDirectory(path, description) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch (error) {
    throw new Error(`${description} is unavailable: ${path} (${error.message})`);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`${description} must be a non-symlink directory: ${path}`);
  }
}

export function requireFile(path, description) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch (error) {
    throw new Error(`${description} is unavailable: ${path} (${error.message})`);
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${description} must be a non-symlink file: ${path}`);
  }
}

export function validateAppPath(appPath, description, requireExecutable = true) {
  if (!isAbsolute(appPath)) throw new Error(`${description} path must be absolute: ${appPath}`);
  if (extname(appPath) !== ".app") throw new Error(`${description} path must end in .app: ${appPath}`);
  requireDirectory(appPath, description);
  if (realpathSync(appPath) !== appPath) {
    throw new Error(`${description} path must be its canonical real path without symlink components: ${appPath}`);
  }
  requireFile(join(appPath, "Contents", "Info.plist"), `${description} Info.plist`);
  requireDirectory(join(appPath, "Contents", "MacOS"), `${description} MacOS directory`);
  requireDirectory(join(appPath, "Contents", "Frameworks"), `${description} Frameworks directory`);
  if (requireExecutable) {
    requireFile(join(appPath, "Contents", "MacOS", "mutiny-desktop"), `${description} executable`);
  }
}

export function walkApp(directory) {
  const paths = [];
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    throw new Error(`cannot inspect packaged app directory ${directory}: ${error.message}`);
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      paths.push(path, ...walkApp(path));
    } else if (entry.isFile()) {
      paths.push(path);
    } else {
      throw new Error(`unsupported filesystem entry in packaged app: ${path}`);
    }
  }
  return paths;
}

export function profileForApp(appPath, path) {
  if (path === appPath) return "top";
  const appName = basename(appPath, ".app");
  const profiles = new Map([
    [`${appName} Helper.app`, "helper"],
    [`${appName} Helper (Renderer).app`, "renderer"],
    [`${appName} Helper (GPU).app`, "gpu"],
    [`${appName} Helper (Plugin).app`, "plugin"],
  ]);
  const profile = profiles.get(basename(path));
  if (profile) return profile;
  if (path.endsWith(".app")) throw new Error(`no explicit entitlement profile for nested app: ${path}`);
  return null;
}

function isMachO(fileTool, path) {
  try {
    return execFileSync(fileTool, ["-b", "--", path], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).includes("Mach-O");
  } catch (error) {
    throw new Error(`Mach-O inspection failed for ${path}: ${error.message}`);
  }
}

export function discoverSignablePaths(appPath, fileTool) {
  const discovered = walkApp(appPath);
  const bundlePaths = discovered
    .filter((path) => /\.(app|framework|xpc|appex|bundle|plugin)$/.test(path))
    .filter((path) => lstatSync(path).isDirectory())
    .sort((a, b) => b.split("/").length - a.split("/").length || b.localeCompare(a));
  for (const path of bundlePaths) profileForApp(appPath, path);
  const leaves = discovered
    .filter((path) => lstatSync(path).isFile())
    .filter((path) => isMachO(fileTool, path))
    .sort((a, b) => b.split("/").length - a.split("/").length || b.localeCompare(a));
  return { bundlePaths, leaves, signedPaths: [...leaves, ...bundlePaths, appPath] };
}

function runCodesignDisplay(codesign, args, path, description) {
  const result = spawnSync(codesign, [...args, "--", path], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    throw new Error(`cannot read ${description} for ${path}: ${result.error?.message ?? result.stderr}`);
  }
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function exactLines(metadata, prefix) {
  return metadata.split(/\r?\n/).filter((line) => line.startsWith(prefix));
}

export function parseReleaseMetadata(metadata, path) {
  const identifierLines = exactLines(metadata, "Identifier=");
  if (identifierLines.length !== 1 || !/^Identifier=[A-Za-z0-9._-]+$/.test(identifierLines[0])) {
    throw new Error(`Identifier metadata verification failed for ${path}`);
  }

  const teamLines = exactLines(metadata, "TeamIdentifier=");
  if (teamLines.length !== 1 || teamLines[0] !== `TeamIdentifier=${EXPECTED_TEAM}`) {
    throw new Error(`TeamIdentifier verification failed for ${path}`);
  }

  const leafAuthorities = exactLines(metadata, "Authority=").filter((line) =>
    line.startsWith("Authority=Developer ID Application:"),
  );
  const leafPattern = new RegExp(`^Authority=(Developer ID Application: .+ \\(${EXPECTED_TEAM}\\))$`);
  if (leafAuthorities.length !== 1 || !leafPattern.test(leafAuthorities[0])) {
    throw new Error(`Developer ID leaf authority verification failed for ${path}`);
  }

  const timestampLines = exactLines(metadata, "Timestamp=");
  if (timestampLines.length !== 1) throw new Error(`secure timestamp verification failed for ${path}`);
  const timestamp = timestampLines[0].slice("Timestamp=".length);
  if (!timestamp || /^none$/i.test(timestamp) || Number.isNaN(Date.parse(timestamp.replace(" at ", " ")))) {
    throw new Error(`secure timestamp verification failed for ${path}`);
  }

  const runtimeLines = metadata
    .split(/\r?\n/)
    .filter((line) =>
      /^CodeDirectory .*flags=.*\([^)]*\bruntime\b[^)]*\)(?:\s+.*)?$/.test(line),
    );
  if (runtimeLines.length !== 1) throw new Error(`hardened runtime verification failed for ${path}`);

  return {
    authority: leafAuthorities[0].slice("Authority=".length),
    identifier: identifierLines[0].slice("Identifier=".length),
  };
}

function canonicalBooleanPlist(contents, description) {
  const start = contents.indexOf("<plist");
  if (start < 0) throw new Error(`${description} is not an XML property list`);
  const plist = contents.slice(start);
  const dict = plist.match(/<dict>([\s\S]*?)<\/dict>/);
  if (!dict) throw new Error(`${description} does not contain a dictionary`);
  const entries = [];
  const pattern = /<key>([^<]+)<\/key>\s*<(true|false)\s*\/>/g;
  let match;
  let consumed = "";
  while ((match = pattern.exec(dict[1]))) {
    entries.push([match[1], match[2] === "true"]);
    consumed += match[0];
  }
  const residual = dict[1].replace(pattern, "").replace(/\s+/g, "");
  if (residual || entries.length === 0) throw new Error(`${description} has unsupported or malformed entries`);
  const keys = entries.map(([key]) => key);
  if (new Set(keys).size !== keys.length) throw new Error(`${description} contains duplicate keys`);
  return JSON.stringify(Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))));
}

function verifyEntitlements(codesign, appPath, path, profile) {
  const effective = runCodesignDisplay(
    codesign,
    ["-d", "--entitlements", ":-"],
    path,
    "effective entitlements",
  );
  const actual = canonicalBooleanPlist(effective, `effective entitlements for ${path}`);
  const expected = canonicalBooleanPlist(
    readFileSync(ENTITLEMENT_PATHS[profile], "utf8"),
    `${profile} entitlement profile`,
  );
  if (actual !== expected) throw new Error(`effective ${profile} entitlements verification failed for ${path}`);
  if (profile !== profileForApp(appPath, path)) throw new Error(`entitlement profile classification changed for ${path}`);
}

function verifyOneReleaseObject(codesign, appPath, path, expectedAuthority) {
  execFileSync(codesign, ["--verify", "--strict", "--verbose=2", "--", path], { stdio: "inherit" });
  const metadata = runCodesignDisplay(codesign, ["-d", "--verbose=4"], path, "signature metadata");
  const parsed = parseReleaseMetadata(metadata, path);
  if (expectedAuthority && parsed.authority !== expectedAuthority) {
    throw new Error(`Developer ID leaf authority does not match the top app for ${path}`);
  }
  const profile = profileForApp(appPath, path);
  if (profile) {
    const expectedIdentifier = profile === "top" ? TOP_IDENTIFIER : HELPER_IDENTIFIER;
    if (parsed.identifier !== expectedIdentifier) {
      throw new Error(`Identifier verification failed for ${path}: expected ${expectedIdentifier}`);
    }
    verifyEntitlements(codesign, appPath, path, profile);
  }
  return parsed.authority;
}

export function verifyReleaseApp(appPath, tools, discovered = null, expectedAuthority = null) {
  execFileSync(
    tools.codesign,
    ["--verify", "--deep", "--strict", "--verbose=2", "--", appPath],
    { stdio: "inherit" },
  );
  const paths = discovered ?? discoverSignablePaths(appPath, tools.file);
  const topAuthority = verifyOneReleaseObject(
    tools.codesign,
    appPath,
    appPath,
    expectedAuthority,
  );
  const sharedAuthority = expectedAuthority ?? topAuthority;
  for (const path of paths.signedPaths) {
    if (path !== appPath) verifyOneReleaseObject(tools.codesign, appPath, path, sharedAuthority);
  }
  return { ...paths, authority: sharedAuthority };
}

export function verifyAdHocApp(appPath, tools, discovered) {
  for (const path of discovered.signedPaths) {
    execFileSync(tools.codesign, ["--verify", "--strict", "--verbose=2", "--", path], {
      stdio: "inherit",
    });
  }
  execFileSync(
    tools.codesign,
    ["--verify", "--deep", "--strict", "--verbose=2", "--", appPath],
    { stdio: "inherit" },
  );
}
