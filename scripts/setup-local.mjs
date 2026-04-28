#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFilePath), "..");
const envExamplePath = path.join(projectRoot, ".env.example");
const envLocalPath = path.join(projectRoot, ".env.local");

function logStep(message) {
  console.log(`\n==> ${message}`);
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function assertNodeVersion() {
  const majorVersion = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  if (majorVersion < 20) {
    throw new Error(`Node 20+ is required. current=${process.version}`);
  }
}

function createHexSecret(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString("hex");
}

function ensureEnvLocal() {
  if (!fs.existsSync(envExamplePath)) {
    throw new Error(".env.example is missing");
  }

  if (!fs.existsSync(envLocalPath)) {
    fs.copyFileSync(envExamplePath, envLocalPath);
    console.log("Created .env.local from .env.example");
  }

  const current = fs.readFileSync(envLocalPath, "utf8");
  let next = current;

  if (next.includes('NEXTAUTH_SECRET="replace-with-long-random-secret"')) {
    const secret = createHexSecret();
    next = next.replace(
      'NEXTAUTH_SECRET="replace-with-long-random-secret"',
      `NEXTAUTH_SECRET="${secret}"`,
    );
    console.log("Generated NEXTAUTH_SECRET in .env.local");
  }

  if (next.includes('# MINECRAFT_VERIFY_SECRET="replace-with-minecraft-verify-secret"')) {
    const secret = createHexSecret();
    next = next.replace(
      '# MINECRAFT_VERIFY_SECRET="replace-with-minecraft-verify-secret"',
      `MINECRAFT_VERIFY_SECRET="${secret}"`,
    );
    console.log("Generated MINECRAFT_VERIFY_SECRET in .env.local");
  }

  if (next.includes('MINECRAFT_VERIFY_SECRET="replace-with-minecraft-verify-secret"')) {
    const secret = createHexSecret();
    next = next.replace(
      'MINECRAFT_VERIFY_SECRET="replace-with-minecraft-verify-secret"',
      `MINECRAFT_VERIFY_SECRET="${secret}"`,
    );
    console.log("Generated MINECRAFT_VERIFY_SECRET in .env.local");
  }

  if (next.includes('DATABASE_URL="file:./prisma/dev.db"')) {
    next = next.replace('DATABASE_URL="file:./prisma/dev.db"', 'DATABASE_URL="file:./dev.db"');
    console.log("Normalized DATABASE_URL to file:./dev.db");
  }

  if (next !== current) {
    fs.writeFileSync(envLocalPath, next, "utf8");
  }
}

function parseArgs(argv) {
  const args = {
    skipPlaywright: false,
  };

  for (const current of argv) {
    if (current === "--skip-playwright") {
      args.skipPlaywright = true;
      continue;
    }
    if (current === "--help" || current === "-h") {
      console.log([
        "Usage: node scripts/setup-local.mjs [options]",
        "",
        "Options:",
        "  --skip-playwright   Skip Playwright Chromium install",
      ].join("\n"));
      process.exit(0);
    }
    throw new Error(`UNKNOWN_OPTION:${current}`);
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  logStep("Checking Node runtime");
  assertNodeVersion();
  runCommand("npm", ["--version"]);
  runCommand("npx", ["--version"]);

  logStep("Installing dependencies");
  runCommand("npm", ["install"]);

  logStep("Preparing environment file");
  ensureEnvLocal();

  logStep("Running Prisma setup");
  runCommand("npm", ["run", "db:setup"]);

  if (!args.skipPlaywright) {
    logStep("Installing Playwright Chromium");
    runCommand("npx", ["playwright", "install", "chromium"]);
  }

  logStep("Running local doctor");
  runCommand("npm", ["run", "doctor"]);

  console.log("\nLocal setup completed");
  console.log("Recommended next steps: npm run lint -> npm test -> npm run dev");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`setup-local failed: ${message}`);
  process.exit(1);
}
