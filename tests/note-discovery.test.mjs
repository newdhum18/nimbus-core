import test from "node:test";
import assert from "node:assert/strict";
import { decodeSearchTarget, extractHttpTargets, contentVariants } from "../src/search/target-decoder.js";

test("decodes Linkvertise-style base64 redirect targets",()=>{
  const target="https://pastetoday.com/pvajidjqxq";
  const encoded=Buffer.from(target).toString("base64url");
  const wrapped=`https://linkvertise.com/471396/x/dynamic?r=${encoded}&o=sharing`;
  assert.equal(decodeSearchTarget(wrapped,wrapped),target);
});

test("extracts nested note target from redirect link",()=>{
  const target="https://pastetoday.com/pvajidjqxq";
  const encoded=Buffer.from(target).toString("base64url");
  const html=`<a href="https://linkvertise.com/471396/x/dynamic?r=${encoded}">open</a>`;
  assert.ok(extractHttpTargets(html,"https://ofversedrops.com/post").includes(target));
});

test("adds raw variant for paste.ee notes",()=>{
  assert.ok(contentVariants("https://paste.ee/p/AbCd1").includes("https://paste.ee/r/AbCd1"));
});

test("extracts redirect targets from data attributes and meta refresh",()=>{
  const target="https://rentry.co/example";
  const encoded=Buffer.from(target).toString("base64url");
  const html=`<meta http-equiv="refresh" content="0; url=https://linkvertise.com/x/dynamic?r=${encoded}"><button data-url="https://paste.ee/p/AbCd1">open</button>`;
  const found=extractHttpTargets(html,"https://ofversedrops.com/post");
  assert.ok(found.includes(target));
  assert.ok(found.includes("https://paste.ee/r/AbCd1"));
});

test("extracts URLs embedded in escaped scripts and base64 blobs",()=>{
  const target="https://pastetoday.com/hidden-note";
  const encoded=Buffer.from(target).toString("base64url");
  const html=`<script>window.payload={next:\"https:\\/\\/linkvertise.com\\/x?o=${encoded}\", raw:\"https:\\/\\/rentry.co\\/abc\"}</script>`;
  const found=extractHttpTargets(html,"https://ofversedrops.com/post");
  assert.ok(found.includes(target));
  assert.ok(found.includes("https://rentry.co/raw/abc"));
});

test("prioritizes note and redirect targets above analytics assets",()=>{
  const html=`<a href="https://www.googletagmanager.com/a.js">x</a><a href="https://pastetoday.com/note1">note</a><a href="https://linkvertise.com/x?r=aHR0cHM6Ly9yZW50cnkuY28vYWJj">redirect</a>`;
  const found=extractHttpTargets(html,"https://ofversedrops.com/post");
  assert.match(found[0],/(rentry|pastetoday)/);
});
