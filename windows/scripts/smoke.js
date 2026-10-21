const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const electron = require("electron");
const output = path.join(root, "out", "smoke-result.json");

const result = spawnSync(electron, ["."], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    WORKPRICE_SMOKE: "1",
    WORKPRICE_SMOKE_OUT: output,
  },
});

process.exit(result.status ?? 1);
