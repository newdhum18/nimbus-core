import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexHtml = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const appJs = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

test('Sources UI contains no retired fixed 300/80 labels', () => {
  const combined = `${indexHtml}\n${appJs}`;
  for (const retired of [
    '300 / 80 MODEL',
    'Select all 300 sources?',
    'Restore the default 80 enabled sources?',
    'Restore 80 defaults',
  ]) {
    assert.equal(combined.includes(retired), false, `retired fixed label remains: ${retired}`);
  }
});

test('Sources UI derives model counts from the live summary response', () => {
  assert.match(indexHtml, /id="sourceModelLabel"/);
  assert.match(appJs, /SOURCE INTELLIGENCE CENTER · \$\{total\} TOTAL · \$\{active\} ACTIVE/);
  assert.match(appJs, /api\("\/api\/sources\/summary"\)/);
});

test('Bulk source confirmations are catalog agnostic', () => {
  assert.match(appJs, /Select all available sources\?/);
  assert.match(appJs, /Unselect all available sources\?/);
  assert.match(appJs, /Restore autonomous source defaults\?/);
});
