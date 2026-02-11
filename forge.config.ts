import { MakerAppX } from "@electron-forge/maker-appx";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerFlatpak } from "@electron-forge/maker-flatpak";
import { MakerFlatpakOptionsConfig } from "@electron-forge/maker-flatpak/dist/Config";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { PublisherGithub } from "@electron-forge/publisher-github";
import type { ForgeConfig, ForgeHookFn } from "@electron-forge/shared-types";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

// import { globSync } from "node:fs";

const STRINGS = {
  author: "Mutiny",
  name: "Mutiny",
  execName: "mutiny-desktop",
  description: "Mutiny desktop chat client.",
};

const ASSET_DIR = "assets/desktop";

/**
 * Build targets for the desktop app
 */
const makers: ForgeConfig["makers"] = [
  new MakerSquirrel({
    name: STRINGS.name,
    authors: STRINGS.author,
    // todo: hoist this
    iconUrl: `https://mutinyapp.gg/assets/icon.ico`,
    // todo: loadingGif
    setupIcon: `${ASSET_DIR}/icon.ico`,
    description: STRINGS.description,
    exe: `${STRINGS.execName}.exe`,
    setupExe: `${STRINGS.execName}-setup.exe`,
    copyright: "Copyright (C) 2025 Mutiny",
  }),
  new MakerZIP({}),
];

// skip these makers in CI/CD
if (!process.env.PLATFORM) {
  makers.push(
    // must be manually built (freezes CI process)
    // not much use in being published anyhow
    new MakerAppX({
      certPass: "",
      packageExecutable: `app\\${STRINGS.execName}.exe`,
      publisher: "CN=B040CC7E-0016-4AF5-957F-F8977A6CFA3B",
    }),
    // flatpak publishing should occur through flathub repos.
    // this is just for testing purposes
    new MakerFlatpak({
      options: {
        id: "gg.mutinyapp.mutiny-desktop",
        description: STRINGS.description,
        productName: STRINGS.name,
        productDescription: STRINGS.description,
        runtimeVersion: "21.08",
        icon: `${ASSET_DIR}/icon.png`,
        categories: ["Network"],
        modules: [
          // use the latest zypak -- Electron sandboxing for Flatpak
          {
            name: "zypak",
            sources: [
              {
                type: "git",
                url: "https://github.com/refi64/zypak",
                tag: "v2025.09",
              },
            ],
          },
        ],
        finishArgs: [
          // default arguments found by running
          // DEBUG=electron-installer-flatpak* pnpm make
          "--socket=x11",
          "--share=ipc",
          "--device=dri",
          "--socket=pulseaudio",
          "--filesystem=home",
          "--env=TMPDIR=/var/tmp",
          "--share=network",
          "--talk-name=org.freedesktop.Notifications",
          // add Unity talk name for badges
          "--talk-name=com.canonical.Unity",
        ],
        // files: [
        //   // is this necessary?
        //   // https://stackoverflow.com/q/79745700
        //   ...[16, 32, 64, 128, 256, 512].map(
        //     (size) =>
        //       [
        //         `assets/desktop/hicolor/${size}x${size}.png`,
        //         `/app/share/icons/hicolor/${size}x${size}/apps/chat.stoat.stoat-desktop.png`,
        //       ] as [string, string],
        //   ),
        //   [
        //     `assets/desktop/icon.svg`,
        //     `/app/share/icons/hicolor/scalable/apps/chat.stoat.stoat-desktop.svg`,
        //   ] as [string, string],
        // ],
        files: [],
      } as MakerFlatpakOptionsConfig,
      /* as Omit<
        MakerFlatpakOptionsConfig,
        "files"
      > */
    }),
    // testing purposes
    new MakerDeb({
      options: {
        productName: STRINGS.name,
        productDescription: STRINGS.description,
        categories: ["Network"],
        icon: `${ASSET_DIR}/icon.png`,
      },
    }),
  );
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: STRINGS.name,
    executableName: STRINGS.execName,
    icon: `${ASSET_DIR}/icon`,
    // extraResource: [
    //   // include all the asset files
    //   ...globSync(ASSET_DIR + "/**/*"),
    // ],
    darwinDarkModeSupport: true,
    extendInfo: {
      NSMicrophoneUsageDescription:
        "Mutiny needs microphone access for voice chat.",
      NSCameraUsageDescription:
        "Mutiny needs camera access for video calls.",
      NSScreenCaptureUsageDescription:
        "Mutiny needs screen access for screen sharing.",
      CFBundleURLTypes: [
        {
          CFBundleURLName: "Mutiny Protocol",
          CFBundleURLSchemes: ["mutiny"],
        },
      ],
    },
  },
  hooks: {
    postPackage: async (_config, options) => {
      if (options.platform === "darwin") {
        const appPath = join(options.outputPaths[0], `${STRINGS.name}.app`);
        const entitlements = join(__dirname, "entitlements.mac.plist");
        console.log(`Ad-hoc signing ${appPath} with entitlements...`);
        execSync(
          `codesign --deep --force --sign - --entitlements "${entitlements}" "${appPath}"`,
        );
        console.log("Signed successfully.");
      }
    },
  },
  rebuildConfig: {},
  makers,
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: "warpapaya",
        name: "mutiny-desktop",
      },
    }),
  ],
};

export default config;
