import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

interface ArchitectureCheck {
  name: string;
  passed: boolean;
  evidence: string;
}

const architecture = await readFile(
  new URL('../docs/authorities/architecture.md', import.meta.url),
  'utf8',
);
const domain = await readFile(
  new URL('../docs/authorities/domain-model.md', import.meta.url),
  'utf8',
);
const roadmap = await readFile(
  new URL('../docs/authorities/implementation-roadmap.md', import.meta.url),
  'utf8',
);

const checks: ArchitectureCheck[] = [
  {
    name: 'exactly-four-components',
    passed:
      architecture.includes('The Platform has exactly **four implementation components**') &&
      ['Workspace Service', 'Execution Service', 'Evidence Service', 'Interface Host'].every(
        (name) => architecture.includes(name),
      ),
    evidence: 'Architecture §3',
  },
  {
    name: 'exactly-fourteen-entities',
    passed: domain.includes('The Platform has exactly **14 entities**.'),
    evidence: 'Domain Model §5',
  },
  {
    name: 'separate-repository-boundary',
    passed: roadmap.includes('separate `operatoros-platform` repository/package boundary'),
    evidence: 'Roadmap §2',
  },
  {
    name: 'local-profile-canonical',
    passed:
      architecture.includes('Local-first canonical') &&
      architecture.includes('The local profile has no required network authority or telemetry'),
    evidence: 'Architecture §2 and §12',
  },
  {
    name: 'runtime-owns-no-durable-authority',
    passed: architecture.includes('Runtime owns nothing durable'),
    evidence: 'Architecture §2',
  },
];

const failed = checks.filter((check) => !check.passed);
const report = {
  schema_version: 1,
  architecture_sha256: createHash('sha256').update(architecture).digest('hex'),
  checks,
  passed: failed.length === 0,
};

console.log(JSON.stringify(report, null, 2));
if (failed.length > 0) {
  process.exitCode = 1;
}
