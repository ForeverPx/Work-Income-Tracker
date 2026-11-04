const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pkg = require(path.join(root, "package.json"));

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env,
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function versionParts(version) {
  const [major = "1", minor = "0", patch = "0"] = version.split(".");
  return {
    app: `${Number(major)}.${Number(minor)}.${Number(patch)}`,
    vi: `${Number(major)}.${Number(minor)}.${Number(patch)}.0`,
  };
}

function findMakensis() {
  const probe = spawnSync("makensis", ["-VERSION"], { encoding: "utf8" });
  if (probe.status === 0) {
    return "makensis";
  }
  return null;
}

function buildWithMakensis() {
  const makensis = findMakensis();
  if (!makensis) {
    console.error("未找到 makensis。在 Debian/Ubuntu 上安装：sudo apt-get install nsis");
    process.exit(1);
  }

  const unpacked = path.join(root, "dist", "win-unpacked");
  const exe = path.join(unpacked, "WorkPrice.exe");
  if (!fs.existsSync(exe)) {
    console.error(`未找到 Windows 应用目录：${exe}`);
    process.exit(1);
  }

  const version = versionParts(pkg.version);
  const outfile = path.join(root, "dist", `WorkPrice-Setup-${version.app}.exe`);
  fs.rmSync(outfile, { force: true });

  run(makensis, [
    "-INPUTCHARSET",
    "UTF8",
    `-DAPP_DIR=${unpacked}`,
    `-DOUT_FILE=${outfile}`,
    `-DICON_FILE=${path.join(root, "build", "icon.ico")}`,
    `-DAPP_VERSION=${version.app}`,
    `-DVI_VERSION=${version.vi}`,
    path.join(root, "build", "installer.nsi"),
  ]);

  const stat = fs.statSync(outfile);
  if (stat.size < 20 * 1024 * 1024) {
    console.error(`安装包异常偏小（${stat.size} 字节）：${outfile}`);
    process.exit(1);
  }
  console.log(`installer: ${outfile} (${stat.size} bytes)`);
}

run(process.execPath, [path.join(__dirname, "compile.js")]);

const env = {
  ...process.env,
  CSC_IDENTITY_AUTO_DISCOVERY: "false",
};
const cli = require.resolve("electron-builder/cli.js");

if (process.platform === "win32") {
  run(process.execPath, [cli, "--win", "nsis", "--x64"], env);
} else {
  // The NSIS stub electron-builder executes is 32-bit. Distro Wine on Linux often
  // cannot start it. Package the app with electron-builder, then compile the
  // installer with native makensis.
  run(process.execPath, [cli, "--win", "dir", "--x64"], env);
  buildWithMakensis();
}
