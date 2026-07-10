import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const instrumented = source + '\nexport { normalizeLink, extractMegaLinks, megaParts, b64UrlDecodeMaybe, redirectParamCandidates, rawPageVariants, catalogSources, defaultSourceEnabled, parseSearchTargets };\n';
const url = 'data:text/javascript;base64,' + Buffer.from(instrumented).toString('base64');
const core = await import(url);

const good = 'https://mega.nz/folder/AbCdEf12#1234567890abcdef';
assert.equal(core.normalizeLink(good), good);
assert.equal(core.normalizeLink('https://mega.nz/file/AbCdEf12#1234567890abcdef'), '');
assert.equal(core.normalizeLink('https://mega.nz/folder/AbCdEf12'), '');
assert.deepEqual(core.megaParts(good).handle, 'AbCdEf12');
assert.deepEqual(core.extractMegaLinks(`x ${good} y`), [good]);
assert.deepEqual(core.extractMegaLinks('https://example.com/?url=' + encodeURIComponent(good)), [good]);
assert.ok(core.rawPageVariants('https://pastebin.com/AbCd1234').includes('https://pastebin.com/raw/AbCd1234'));
assert.ok(core.rawPageVariants('https://rentry.co/demo123').includes('https://rentry.co/demo123/raw'));
const ddg = 'https://duckduckgo.com/l/?uddg=' + encodeURIComponent('https://example.com/page');
assert.ok(core.redirectParamCandidates(ddg, ddg).includes('https://example.com/page'));
const targets = core.parseSearchTargets(`<a href="${ddg}">result</a>`, {name:'DDG'}, 'https://duckduckgo.com/');
assert.ok(targets.includes('https://example.com/page'));
const catalog = core.catalogSources();
assert.equal(catalog.length, 1000);
const enabled = catalog.filter(core.defaultSourceEnabled).length;
assert.ok(enabled > 0 && enabled < 200);
console.log(JSON.stringify({ok:true, tests:12, catalog:catalog.length, default_enabled:enabled, version:'34.0-resilient-orchestrator'}, null, 2));
