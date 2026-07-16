import test from "node:test";
import assert from "node:assert/strict";
import { classifyMegaFolder, extractMegaFolders } from "../src/extract/mega.js";
import { unwrapCommonRedirect } from "../src/extract/redirects.js";

const modern = "https://mega.nz/folder/AbCdEf12#AbCdEfGhIjKlMnOpQrStUv";
const legacy = "https://mega.nz/#F!AbCdEf12!AbCdEfGhIjKlMnOpQrStUv";

test("accepts modern folder", () => {
  assert.equal(classifyMegaFolder(modern).valid, true);
});

test("accepts legacy when enabled", () => {
  assert.equal(classifyMegaFolder(legacy).valid, true);
});

test("rejects legacy when disabled", () => {
  assert.equal(classifyMegaFolder(legacy, { allowLegacy: false }).valid, false);
});

test("rejects file link", () => {
  const result = classifyMegaFolder("https://mega.nz/file/AbCdEf12#AbCdEfGhIjKlMnOpQrStUv");
  assert.equal(result.valid, false);
  assert.equal(result.type, "file");
});

test("rejects missing key", () => {
  assert.equal(classifyMegaFolder("https://mega.nz/folder/AbCdEf12").valid, false);
});

test("deduplicates", () => {
  assert.equal(extractMegaFolders(`${modern} ${modern}`).length, 1);
});

test("extracts escaped slash URL", () => {
  const escaped = modern.replaceAll("/", "\\/");
  assert.equal(extractMegaFolders(escaped).length, 1);
});

test("extracts HTML entity hash", () => {
  const encoded = modern.replace("#", "&#35;");
  assert.equal(extractMegaFolders(encoded).length, 1);
});

test("extracts percent encoded URL", () => {
  assert.equal(extractMegaFolders(encodeURIComponent(modern)).length, 1);
});

test("redirect unwrap is safe", () => {
  assert.equal(
    unwrapCommonRedirect(`https://example.com/?url=${encodeURIComponent(modern)}`),
    modern
  );
  assert.equal(unwrapCommonRedirect("not-a-url"), "not-a-url");
});


test("extracts folder link embedded in JSON and comment text", () => {
  const input = JSON.stringify({ comments: [{ body: "public mirror https:\/\/mega.nz\/folder\/AbCdEf12#abcdefghijklmnopqrstuvwxyzABCDE" }] });
  const links = extractMegaFolders(input);
  assert.equal(links.length, 1);
  assert.match(links[0].normalizedUrl, /^https:\/\/mega\.nz\/folder\//);
});


test("extracts JavaScript hex escaped and base64 embedded folder links", () => {
  const hexEscaped = modern.replaceAll("/", "\\x2f").replace("#", "\\x23").replace(":", "\\x3a");
  assert.equal(extractMegaFolders(hexEscaped).length, 1);
  const encoded = Buffer.from(`prefix ${modern} suffix`).toString("base64");
  assert.equal(extractMegaFolders(encoded).length, 1);
});

test("extracts mildly whitespace-obfuscated folder URL", () => {
  const obfuscated = modern.replace("https://", "https : / /").replace("mega.nz", "mega . nz").replace("/folder/", "/ folder /");
  assert.equal(extractMegaFolders(obfuscated).length, 1);
});


test("extracts a MEGA folder split by harmless note markup",()=>{
  const html='https://mega.nz/<span>folder</span>/3MBkUBqS#B8VI_3a7abcdefghijklmnopqrstuv';
  const links=extractMegaFolders(html);
  assert.equal(links.length,1);
  assert.equal(links[0].type,"folder");
});
