import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["--test", "--test-reporter=spec"], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
