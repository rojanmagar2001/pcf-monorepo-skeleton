/**
 * Guards the generated client against everything the PCF bundle cannot take.
 *
 * pcf-scripts produces one file with no code splitting, so a dynamic import in
 * generated code is a build-breaking change that would otherwise only surface
 * in a model-driven app. Fail here, at generate time, instead.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../src/generated/', import.meta.url).pathname;

const RULES = [
  { name: 'dynamic import()', re: /\bimport\s*\(/ },
  { name: 'axios import', re: /from\s+['"]axios['"]|require\(\s*['"]axios['"]/ },
  { name: 'process.env access', re: /process\s*\.\s*env/ },
  { name: 'import.meta.env access', re: /import\s*\.\s*meta\s*\.\s*env/ },
  { name: 'React.lazy', re: /\bReact\.lazy\b|\blazy\s*\(\s*\(\)\s*=>\s*import/ },
  { name: 'top-level await', re: /^await\s/m },
  { name: 'node built-in import', re: /from\s+['"]node:/ },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

let files;
try {
  files = walk(ROOT);
} catch {
  console.error(`verify-generated: no generated output at ${ROOT}`);
  process.exit(1);
}

if (files.length === 0) {
  console.error('verify-generated: generated directory is empty');
  process.exit(1);
}

const violations = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const rule of RULES) {
    if (rule.re.test(source)) {
      violations.push(`${file.replace(ROOT, 'src/generated/')}: ${rule.name}`);
    }
  }
}

if (violations.length > 0) {
  console.error('verify-generated: generated client violates PCF bundle constraints:');
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log(
  `verify-generated: ${files.length} generated files OK (no dynamic import, no axios, no env access)`,
);
