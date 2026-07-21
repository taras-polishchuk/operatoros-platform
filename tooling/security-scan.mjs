import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const roots = ['packages', 'apps', 'tooling', 'docs', '.github'];
const allowedExtensions = new Set([
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.yaml',
  '.yml',
  '.md',
  '.sh',
]);
const secretPatterns = [
  /\bsk-[A-Za-z0-9]{20,}\b/u,
  /\bghp_[A-Za-z0-9]{30,}\b/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\b(?:api[_-]?key|password|passwd|secret|token)\s*[:=]\s*['"][^'"]{8,}['"]/iu,
];
const dangerousPatterns = [/\beval\s*\(/u, /\bnew\s+Function\s*\(/u, /\bexecSync\s*\([^)]*\$\{/u];
const findings = [];

function scan(path) {
  const entry = statSync(path);
  if (entry.isDirectory()) {
    if (['node_modules', 'dist', 'artifacts'].includes(path.split('/').at(-1))) return;
    for (const child of readdirSync(path)) scan(join(path, child));
    return;
  }
  if (!allowedExtensions.has(extname(path))) return;
  const content = readFileSync(path, 'utf8');
  for (const pattern of [...secretPatterns, ...dangerousPatterns]) {
    if (pattern.test(content)) findings.push({ path, pattern: pattern.source });
  }
}

for (const root of roots) {
  try {
    scan(root);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

console.log(JSON.stringify({ passed: findings.length === 0, findings }, null, 2));
if (findings.length > 0) process.exitCode = 1;
