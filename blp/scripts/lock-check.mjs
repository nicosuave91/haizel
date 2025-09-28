// Verifies that every workspace package.json has a corresponding importer with specifiers in pnpm-lock.yaml
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

const root = process.cwd();
const lockPath = path.join(root, "pnpm-lock.yaml");
const wsFile = path.join(root, "pnpm-workspace.yaml");

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (!fs.existsSync(lockPath)) die("pnpm-lock.yaml not found");
if (!fs.existsSync(wsFile)) die("pnpm-workspace.yaml not found");

const lock = yaml.parse(fs.readFileSync(lockPath, "utf8"));
const importers = lock?.importers || {};

function listWorkspaceDirs() {
  const ws = yaml.parse(fs.readFileSync(wsFile, "utf8"));
  const globs = ws.packages || [];
  const out = new Set();

  for (const g of globs) {
    if (!g.includes("*")) {
      const dir = path.join(root, g);
      if (fs.existsSync(path.join(dir, "package.json"))) {
        out.add(path.relative(root, dir));
      }
      continue;
    }

    const base = g.replace(/\/\*.*$/, "");
    const baseDir = path.join(root, base);
    if (!fs.existsSync(baseDir)) continue;

    for (const name of fs.readdirSync(baseDir)) {
      const dir = path.join(baseDir, name);
      if (!fs.statSync(dir).isDirectory()) continue;
      const pj = path.join(dir, "package.json");
      if (fs.existsSync(pj)) out.add(path.relative(root, dir));
    }
  }

  return [...out];
}

function collectSpecifiers(importer = {}) {
  if (importer.specifiers && typeof importer.specifiers === "object") {
    return importer.specifiers;
  }

  const sections = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies"
  ];
  const specs = {};

  for (const section of sections) {
    const records = importer[section] || {};
    for (const [name, meta] of Object.entries(records)) {
      if (meta && typeof meta === "object" && "specifier" in meta) {
        specs[name] = meta.specifier;
      }
    }
  }

  return specs;
}

const dirs = listWorkspaceDirs();
const offenders = [];

for (const dir of dirs) {
  const pjPath = path.join(root, dir, "package.json");
  const pj = JSON.parse(fs.readFileSync(pjPath, "utf8"));
  const importer = importers[dir];
  if (!importer) {
    offenders.push(`- Missing importer for "${dir}"`);
    continue;
  }
  const specs = collectSpecifiers(importer);
  const declared = {
    ...(pj.dependencies || {}),
    ...(pj.devDependencies || {}),
    ...(pj.optionalDependencies || {}),
    ...(pj.peerDependencies || {})
  };
  const missing = Object.keys(declared).filter((k) => !(k in specs));
  if (missing.length) {
    offenders.push(`- Importer "${dir}" missing specifiers for: ${missing.join(", ")}`);
  }
}

if (offenders.length) {
  die(
    [
      "Lockfile is out of date with workspace manifests:",
      ...offenders,
      "",
      "➡ Run: pnpm run lock:regen && commit pnpm-lock.yaml"
    ].join("\n")
  );
}

console.log("Lockfile OK ✅");
