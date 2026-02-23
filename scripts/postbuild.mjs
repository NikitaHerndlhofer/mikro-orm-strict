import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const REF = '/// <reference path="./drivers.d.ts" />\n';

copyFileSync('src/drivers.d.ts', 'dist/drivers.d.ts');

for (const file of ['dist/index.d.ts', 'dist/index.d.cts']) {
  const content = readFileSync(file, 'utf8');
  writeFileSync(file, REF + content);
}
