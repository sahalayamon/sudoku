/**
 * Builds the Android app.
 *
 *   npm run android            debug APK    -> dist/Sudoku-debug.apk   (installs on any phone, for testing)
 *   npm run android:release    signed APK   -> dist/Sudoku.apk         (what you share or sideload)
 *   npm run android:bundle     signed AAB   -> dist/Sudoku.aab         (what Google Play wants)
 *   npm run android:open       open the project in Android Studio
 *
 * Add --skip-web to reuse the existing ./out build. The script finds the Android SDK and
 * Android Studio's bundled JDK on its own; set JAVA_HOME / ANDROID_HOME to override.
 */
import { spawnSync, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = join(root, "android");
const distDir = join(root, "dist");
const isWindows = platform() === "win32";

const [command = "debug", ...flags] = process.argv.slice(2);
const skipWeb = flags.includes("--skip-web");

function fail(message) {
  console.error(`\nandroid: ${message}\n`);
  process.exit(1);
}

function firstExisting(paths) {
  return paths.filter(Boolean).find((p) => existsSync(p));
}

function findJavaHome() {
  const candidates = [
    process.env.JAVA_HOME,
    isWindows && "C:\\Program Files\\Android\\Android Studio\\jbr",
    platform() === "darwin" && "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
    platform() === "linux" && join(homedir(), "android-studio", "jbr"),
    platform() === "linux" && "/opt/android-studio/jbr",
  ];
  const java = isWindows ? "java.exe" : "java";
  return candidates.filter(Boolean).find((home) => existsSync(join(home, "bin", java)));
}

function findSdk() {
  return firstExisting([
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    isWindows && process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Android", "Sdk"),
    platform() === "darwin" && join(homedir(), "Library", "Android", "sdk"),
    platform() === "linux" && join(homedir(), "Android", "Sdk"),
  ]);
}

const javaHome = findJavaHome();
const sdk = findSdk();
if (command !== "open") {
  if (!javaHome) fail("Could not find a JDK. Install Android Studio (it bundles one) or set JAVA_HOME to a JDK 21.");
  if (!sdk) fail("Could not find the Android SDK. Install Android Studio or set ANDROID_HOME.");
}

const env = { ...process.env };
if (javaHome) {
  env.JAVA_HOME = javaHome;
  env.PATH = `${join(javaHome, "bin")}${isWindows ? ";" : ":"}${env.PATH}`;
}
if (sdk) {
  env.ANDROID_HOME = sdk;
  env.ANDROID_SDK_ROOT = sdk;
}

function run(cmd, args, options = {}) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, { stdio: "inherit", env, shell: isWindows, ...options });
  if (result.status !== 0) fail(`"${cmd} ${args.join(" ")}" failed.`);
}

// --- version from package.json: 1.2.3 -> code 10203
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const [major = 0, minor = 0, patch = 0] = String(pkg.version)
  .split(".")
  .map((n) => Number.parseInt(n, 10) || 0);
const versionCode = major * 10000 + minor * 100 + patch;
const versionArgs = [`-PappVersionName=${pkg.version}`, `-PappVersionCode=${versionCode}`];

function writeLocalProperties() {
  // Gradle also reads ANDROID_HOME, but local.properties keeps Android Studio happy too.
  writeFileSync(join(androidDir, "local.properties"), `sdk.dir=${sdk.replaceAll("\\", "\\\\")}\n`);
}

function ensureKeystore() {
  const propsFile = join(androidDir, "keystore.properties");
  if (existsSync(propsFile)) return;
  const keytool = join(javaHome, "bin", isWindows ? "keytool.exe" : "keytool");
  const storePassword = randomBytes(18).toString("base64url");
  const keyPassword = storePassword;
  const storeFile = "keystore/sudoku-release.keystore";
  mkdirSync(join(androidDir, "keystore"), { recursive: true });
  console.log("\nCreating a release signing key (one time)...");
  execFileSync(
    keytool,
    [
      "-genkeypair",
      "-v",
      "-keystore",
      join(androidDir, storeFile),
      "-alias",
      "sudoku",
      "-keyalg",
      "RSA",
      "-keysize",
      "2048",
      "-validity",
      "10000",
      "-storepass",
      storePassword,
      "-keypass",
      keyPassword,
      "-dname",
      "CN=Sudoku, OU=Sudoku, O=Sudoku, C=US",
    ],
    { stdio: "ignore" },
  );
  writeFileSync(propsFile, `storeFile=${storeFile}\nstorePassword=${storePassword}\nkeyAlias=sudoku\nkeyPassword=${keyPassword}\n`);
  console.log(
    "\n  Release key created:\n" +
      "    android/keystore/sudoku-release.keystore\n" +
      "    android/keystore.properties\n" +
      "  BACK THESE TWO FILES UP somewhere safe (they are git-ignored). Every future update of the\n" +
      "  app must be signed with this same key, or phones will refuse to install it over the old one.\n",
  );
}

function buildWeb() {
  if (skipWeb) {
    if (!existsSync(join(root, "out", "index.html"))) fail("--skip-web was given but ./out does not exist. Run `npm run build` first.");
    return;
  }
  run("npm", ["run", "build"], { cwd: root });
}

function syncNative() {
  run("npx", ["cap", "sync", "android"], { cwd: root });
}

function gradle(task, extra = []) {
  const wrapper = join(androidDir, isWindows ? "gradlew.bat" : "gradlew");
  run(wrapper, [task, "--console=plain", ...versionArgs, ...extra], { cwd: androidDir });
}

function collect(from, name) {
  const source = join(androidDir, "app", "build", "outputs", from);
  if (!existsSync(source)) fail(`Build finished but ${source} was not produced.`);
  mkdirSync(distDir, { recursive: true });
  const target = join(distDir, name);
  copyFileSync(source, target);
  console.log(`\nDone: ${target}\n`);
}

switch (command) {
  case "open":
    run("npx", ["cap", "open", "android"], { cwd: root });
    break;
  case "sync":
    buildWeb();
    syncNative();
    break;
  case "debug":
    buildWeb();
    syncNative();
    writeLocalProperties();
    gradle("assembleDebug");
    collect(join("apk", "debug", "app-debug.apk"), "Sudoku-debug.apk");
    break;
  case "release":
    buildWeb();
    syncNative();
    writeLocalProperties();
    ensureKeystore();
    gradle("assembleRelease");
    collect(join("apk", "release", "app-release.apk"), "Sudoku.apk");
    break;
  case "bundle":
    buildWeb();
    syncNative();
    writeLocalProperties();
    ensureKeystore();
    gradle("bundleRelease");
    collect(join("bundle", "release", "app-release.aab"), "Sudoku.aab");
    break;
  default:
    fail(`Unknown command "${command}". Use: debug, release, bundle, sync, open.`);
}
