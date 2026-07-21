import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const packageRoot = join(repositoryRoot, 'packages', 'contracts');
const generatedRoot = join(packageRoot, 'generated');
const implementation = await import(pathToFileURL(join(packageRoot, 'dist', 'index.js')).href);

mkdirSync(generatedRoot, { recursive: true });
const contracts = {};

const bundleContracts = implementation.toJsonSchemas();

for (const [identifier, jsonSchema] of Object.entries(bundleContracts.contracts)) {
  const relativePath = `${identifier.replaceAll('.', '/')}.schema.json`;
  const outputPath = join(generatedRoot, relativePath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(jsonSchema, null, 2) + '\n');
  contracts[identifier] = { path: relativePath };
}

writeFileSync(
  join(generatedRoot, 'compatibility.json'),
  JSON.stringify(implementation.compatibilityMetadata, null, 2) + '\n',
);
writeFileSync(
  join(generatedRoot, 'index.json'),
  JSON.stringify(
    {
      schema_version: 1,
      current_version: implementation.publicContractVersion,
      compatibility: 'compatibility.json',
      contracts,
    },
    null,
    2,
  ) + '\n',
);
execFileSync(join(repositoryRoot, 'node_modules', '.bin', 'prettier'), ['--write', generatedRoot], {
  stdio: 'inherit',
});
console.log(`Generated ${Object.keys(contracts).length} contracts in ${generatedRoot}`);
