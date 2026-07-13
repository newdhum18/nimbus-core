import test from "node:test";
import assert from "node:assert/strict";
import { extractDiscoveryContexts } from "../src/search/crawler.js";
import { extractLearnableTerms } from "../src/search/keyword-intelligence.js";

test("discovery context captures title and text surrounding a MEGA folder",()=>{
  const html=`<html><head><title>Retro Games Preservation Library</title><meta name="description" content="Curated ROM archive"></head><body><article><h2>Portable Console Collection</h2><p>Verified preservation set with emulators and manuals.</p><a href="https://mega.nz/folder/AbCdEf12#abcdefghijklmnopqrstuvwxyzABCDEFGH">Open folder</a></article></body></html>`;
  const contexts=extractDiscoveryContexts(html);
  const joined=contexts.join(" ");
  assert.match(joined,/Retro Games Preservation Library/i);
  assert.match(joined,/Portable Console Collection/i);
  const terms=extractLearnableTerms(joined);
  assert.ok(terms.some(term=>/Retro Games/i.test(term)));
});

test("discovery context excludes unrelated distant page boilerplate",()=>{
  const html=`<title>Useful Dataset Index</title><div>${"navigation ".repeat(500)}</div><section>Machine Learning Corpus 2026 https://mega.nz/folder/AbCdEf12#abcdefghijklmnopqrstuvwxyzABCDEFGH research benchmark</section>`;
  const contexts=extractDiscoveryContexts(html,{radius:120});
  assert.ok(contexts.some(value=>/Machine Learning Corpus 2026/i.test(value)));
  assert.ok(contexts.every(value=>value.length<=500));
});
