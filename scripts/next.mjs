import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const executable = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const next = spawn(process.execPath, [executable, ...process.argv.slice(2)], {
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: "inherit",
});
next.on("exit", code => { process.exitCode = code ?? 1; });
