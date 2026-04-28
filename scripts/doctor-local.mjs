import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFilePath), "..");
const envLocalPath = path.join(projectRoot, ".env.local");
const envExamplePath = path.join(projectRoot, ".env.example");

function parseEnvFile(raw) {
  const result = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function readEnvLocal() {
  if (!fs.existsSync(envLocalPath)) {
    return {};
  }

  const content = fs.readFileSync(envLocalPath, "utf8");
  return parseEnvFile(content);
}

function getEnvValue(key, localEnv) {
  const runtime = process.env[key]?.trim();
  if (runtime) {
    return runtime;
  }

  return localEnv[key]?.trim() ?? "";
}

function isTursoUrl(databaseUrl) {
  const normalized = databaseUrl.toLowerCase();
  return normalized.startsWith("libsql://") || normalized.startsWith("turso://");
}

function check(name, ok, detail) {
  return { name, ok, detail };
}

const checks = [];
const localEnv = readEnvLocal();
const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
const envExampleExists = fs.existsSync(envExamplePath);
const envLocalExists = fs.existsSync(envLocalPath);

checks.push(check("Using Node 20+", nodeMajor >= 20, `current=${process.version}`));
checks.push(check(".env.example exists", envExampleExists, envExampleExists ? "found" : "missing"));
checks.push(check(".env.local exists", envLocalExists, envLocalExists ? "found" : "missing"));

const databaseUrl = getEnvValue("DATABASE_URL", localEnv);
checks.push(
  check(
    "DATABASE_URL configured",
    databaseUrl.length > 0,
    databaseUrl ? "configured" : "missing"
  )
);

const nextAuthSecret = getEnvValue("NEXTAUTH_SECRET", localEnv);
checks.push(
  check(
    "NEXTAUTH_SECRET configured",
    nextAuthSecret.length >= 32 && nextAuthSecret !== "replace-with-long-random-secret",
    nextAuthSecret ? "configured" : "missing"
  )
);

const minecraftVerifySecret = getEnvValue("MINECRAFT_VERIFY_SECRET", localEnv);
checks.push(
  check(
    "MINECRAFT_VERIFY_SECRET configured",
    minecraftVerifySecret.length >= 32 &&
      minecraftVerifySecret !== "replace-with-minecraft-verify-secret" &&
      minecraftVerifySecret !== "test-secret-key-for-local-tests",
    minecraftVerifySecret ? "configured" : "missing"
  )
);

const minecraftVerifyAllowedIps = getEnvValue("MINECRAFT_VERIFY_ALLOWED_IPS", localEnv);
checks.push(
  check(
    "MINECRAFT_VERIFY_ALLOWED_IPS configured",
    minecraftVerifyAllowedIps.length > 0,
    minecraftVerifyAllowedIps ? "configured" : "missing"
  )
);

if (isTursoUrl(databaseUrl)) {
  const tursoAuthToken = getEnvValue("TURSO_AUTH_TOKEN", localEnv);
  checks.push(
    check(
      "TURSO_AUTH_TOKEN configured",
      tursoAuthToken.length > 0,
      tursoAuthToken ? "configured" : "missing"
    )
  );
}

let hasFailure = false;
for (const item of checks) {
  const status = item.ok ? "[PASS]" : "[FAIL]";
  const detail = item.detail ? ` (${item.detail})` : "";
  console.log(`${status} ${item.name}${detail}`);
  if (!item.ok) {
    hasFailure = true;
  }
}

if (hasFailure) {
  console.error("\nLocal environment doctor failed");
  process.exit(1);
}

console.log("\nLocal environment doctor passed");
