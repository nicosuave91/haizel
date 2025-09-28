#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const lockfilePath = path.resolve(__dirname, '..', 'pnpm-lock.yaml');
let lockfileContents;
try {
  lockfileContents = fs.readFileSync(lockfilePath, 'utf8');
} catch (err) {
  console.error(`Unable to read lockfile at ${lockfilePath}:`, err.message);
  process.exit(1);
}

function tryParseWithYamlModule(source) {
  try {
    const yaml = require('yaml');
    yaml.parse(source);
    console.log('pnpm-lock.yaml parsed successfully using the installed "yaml" module.');
    return true;
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND') {
      return false;
    }
    console.error('pnpm-lock.yaml failed to parse using the installed "yaml" module:');
    console.error(err.message || err);
    process.exit(1);
  }
}

function stripQuotes(key) {
  if (!key) return key;
  const first = key[0];
  const last = key[key.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return key.slice(1, -1);
  }
  return key;
}

function scanForDuplicateKeys(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const contexts = [];

  const leadingSpaces = /^\s*/;
  const keyPattern = /^((?:['"][^'"]*['"])|(?:[^:]+)):(?:\s|$)/;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    let indent = rawLine.match(leadingSpaces)[0].length;
    let content = trimmed;
    let fromSequence = false;

    if (content.startsWith('-')) {
      const sequenceMatch = content.match(/^-(\s*)(.*)$/);
      if (!sequenceMatch) {
        continue;
      }
      const afterDash = sequenceMatch[2];
      if (!afterDash) {
        // sequence item without inline mapping
        continue;
      }
      content = afterDash.trimStart();
      indent = indent + 2;
      fromSequence = true;
    }

    const keyMatch = content.match(keyPattern);
    if (!keyMatch) {
      continue;
    }

    const key = stripQuotes(keyMatch[1].trim());

    if (fromSequence) {
      while (contexts.length && contexts[contexts.length - 1].indent >= indent) {
        contexts.pop();
      }
    } else {
      while (contexts.length && contexts[contexts.length - 1].indent > indent) {
        contexts.pop();
      }
    }

    let current = contexts[contexts.length - 1];
    if (!current || current.indent !== indent) {
      current = { indent, keys: new Map() };
      contexts.push(current);
    }

    if (current.keys.has(key)) {
      const previousLine = current.keys.get(key);
      throw new Error(`Duplicate key "${key}" detected at line ${index + 1} (previous occurrence at line ${previousLine}).`);
    }

    current.keys.set(key, index + 1);
  }
}

if (tryParseWithYamlModule(lockfileContents)) {
  process.exit(0);
}

try {
  scanForDuplicateKeys(lockfileContents);
  console.log('pnpm-lock.yaml passed duplicate-key scan without relying on the "yaml" module.');
  process.exit(0);
} catch (err) {
  console.error('pnpm-lock.yaml failed duplicate-key scan:');
  console.error(err.message || err);
  process.exit(1);
}
