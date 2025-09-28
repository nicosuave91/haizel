#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const generatedDir = path.join(projectRoot, 'prisma', 'generated', 'client');
const installedDir = path.join(projectRoot, 'node_modules', '.prisma', 'client');

if (!fs.existsSync(installedDir)) {
  console.error(`Expected Prisma output at ${installedDir}, but it was not found.`);
  console.error('Run `pnpm --filter core-api exec prisma generate --binary-target=debian-openssl-3.0.x` first.');
  process.exit(1);
}

fs.rmSync(generatedDir, { recursive: true, force: true });
fs.mkdirSync(generatedDir, { recursive: true });
fs.cpSync(installedDir, generatedDir, { recursive: true, force: true, verbatimSymlinks: true });

const preservePermissions = (srcDir, destDir) => {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    const stats = fs.statSync(srcPath);
    fs.chmodSync(destPath, stats.mode);
    if (entry.isDirectory()) {
      preservePermissions(srcPath, destPath);
    }
  }
};

preservePermissions(installedDir, generatedDir);
