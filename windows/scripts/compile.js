const fs = require("fs");
const path = require("path");
const { build } = require("esbuild");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "out");

async function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  await build({
    entryPoints: [path.join(root, "src/main/main.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: path.join(outDir, "main.js"),
    external: ["electron"],
    sourcemap: true,
    target: "node20",
  });
  await build({
    entryPoints: [path.join(root, "src/main/preload.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: path.join(outDir, "preload.js"),
    external: ["electron"],
    sourcemap: true,
    target: "node20",
  });
  await build({
    entryPoints: [
      path.join(root, "src/renderer/dashboard.ts"),
      path.join(root, "src/renderer/settings.ts"),
    ],
    bundle: true,
    platform: "browser",
    format: "iife",
    outdir: path.join(outDir, "renderer"),
    sourcemap: true,
    target: ["chrome120"],
  });

  const rendererOut = path.join(outDir, "renderer");
  for (const file of ["dashboard.html", "settings.html", "app.css"]) {
    fs.copyFileSync(path.join(root, "src/renderer", file), path.join(rendererOut, file));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
