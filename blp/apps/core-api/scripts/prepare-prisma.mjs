#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const vendoredDir = path.join(projectRoot, 'prisma', 'generated', 'client');
const nodeModulesDir = path.join(projectRoot, 'node_modules', '.prisma');
const targetDir = path.join(nodeModulesDir, 'client');

if (!fs.existsSync(vendoredDir)) {
  console.error(`Vendored Prisma client not found at ${vendoredDir}.`);
  console.error('Run the refresh procedure to update the generated client before invoking Prisma.');
  process.exit(1);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(nodeModulesDir, { recursive: true });

const copyRecursive = (src, dest) => {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
    fs.chmodSync(dest, stats.mode);
  }
};

copyRecursive(vendoredDir, targetDir);
