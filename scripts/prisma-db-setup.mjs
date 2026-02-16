import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parse } from "dotenv";

const currentFilePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFilePath), "..");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return parse(raw);
}

function buildEnv() {
  const envFromDotEnv = readEnvFile(path.join(projectRoot, ".env"));
  const envFromDotEnvLocal = readEnvFile(path.join(projectRoot, ".env.local"));
  return {
    ...process.env,
    ...envFromDotEnv,
    ...envFromDotEnvLocal,
  };
}

function runPrisma(args, env) {
  const command = `npx prisma ${args.join(" ")}`;
  const result = spawnSync(command, {
    cwd: projectRoot,
    stdio: "inherit",
    env,
    shell: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`prisma ${args.join(" ")} failed`);
  }
}

function main() {
  const env = buildEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in .env or .env.local");
  }

  runPrisma(["generate"], env);
  runPrisma(["db", "push"], env);
}

main();
