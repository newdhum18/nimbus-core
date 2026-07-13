import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/style.css", import.meta.url), "utf8");

test("operational UI replaces Foundation placeholder", () => {
  assert.doesNotMatch(html, /Search and extraction UI will be added/i);
  assert.doesNotMatch(html, /Clean Foundation/i);
});

test("required application screens are present", () => {
  for (const label of ["Dashboard", "AutoScan", "Keyword Search", "Extract", "Archive", "Results", "Sources", "Diagnostics"]) {
    assert.match(html, new RegExp(label, "i"));
  }
});

test("frontend uses current V36 run routes", () => {
  assert.match(app, /\/api\/runs\/start/);
  assert.match(app, /\/api\/runs\/\$\{encodeURIComponent\(state\.currentRunId\)\}\/\$\{action\}/);
  assert.match(app, /startRun\("autoscan"\)/);
  assert.match(app, /startRun\("keyword"\)/);
  assert.doesNotMatch(app, /\/api\/run\/start/);
  assert.doesNotMatch(app, /mode:\s*"search"/);
});

test("frontend uses current V36 source routes", () => {
  assert.match(app, /\/api\/sources\/summary/);
  assert.match(app, /\/api\/sources\/\$\{encodeURIComponent\(checkbox\.dataset\.sourceId\)\}/);
  assert.doesNotMatch(app, /\/api\/sources\/toggle/);
});

test("frontend is iPhone responsive", () => {
  assert.match(html, /viewport-fit=cover/);
  assert.match(css, /safe-area-inset/);
});


test("legacy V35.3 user workflows are retained through V36 routes", () => {
  assert.match(app, /\/api\/extract/);
  assert.match(html, /id="archive"/);
  assert.match(app, /loadArchive/);
  assert.doesNotMatch(app, /repairDb/);
});


test("Phase 11 primary navigation is consolidated into five mobile areas", () => {
  for (const label of ["Dashboard", "Search", "Results", "Sources", "System"]) {
    assert.match(html, new RegExp(`data-page="[^"]+"[^>]*>.*${label}`, "is"));
  }
  assert.equal((html.match(/class="tab(?: active)?"/g) || []).length, 5);
});

test("Search workspace exposes the four required tools", () => {
  for (const id of ["autoscanPanel", "keywordPanel", "extractPanel", "archivePanel"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test("Result actions and system diagnostics controls are present", () => {
  for (const id of ["exportJson", "exportCsv", "loadDiagnostics", "loadBindings", "toast"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(app, /navigator\.clipboard|clipboard/i);
  assert.match(app, /window\.open|location\.href|open\(/i);
});

test("interactive controls have explicit button types", () => {
  const buttons = [...html.matchAll(/<button\b([^>]*)>/gi)];
  assert.ok(buttons.length > 0);
  for (const [, attrs] of buttons) assert.match(attrs, /\btype="button"/i);
});

test("mobile layout includes touch and overflow protections", () => {
  assert.match(css, /touch-action|minimum|44px|min-height/i);
  assert.match(css, /overflow-x\s*:\s*(auto|hidden)/i);
  assert.match(css, /@media\s*\(/i);
});
