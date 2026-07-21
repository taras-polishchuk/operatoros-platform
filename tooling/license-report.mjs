import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const reportDirectory = 'artifacts/reports/licenses';
mkdirSync(reportDirectory, { recursive: true });

const output = execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});
const parsed = JSON.parse(output);
writeFileSync(
  `${reportDirectory}/production-dependency-licenses.json`,
  `${JSON.stringify(parsed, null, 2)}\n`,
);
console.log(`Wrote ${reportDirectory}/production-dependency-licenses.json`);
