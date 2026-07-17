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

test("approved note variants stay within approved domains", () => {
  assert.ok(contentVariants("https://rentry.co/AbCd1").includes("https://rentry.co/raw/AbCd1"));
  assert.deepEqual(contentVariants("https://pastemode.com/AbCd1"), ["https://pastemode.com/AbCd1"]);
});

test("recursively decodes nested redirect chains",()=>{
  const final="https://pastetoday.com/note123";
  const inner=`https://linkvertise.com/471396/x/dynamic?r=${Buffer.from(final).toString("base64url")}`;
  const outer=`https://speedy-links.com/s?url=${encodeURIComponent(inner)}`;
  assert.equal(decodeSearchTarget(outer,outer),final);
});

test("prioritizes note and redirect surfaces over tracking assets",()=>{
  const html=`
    <script src="https://www.googletagmanager.com/gtm.js"></script>
    <a href="https://example.com/image.png">image</a>
    <a href="https://pastetoday.com/note123">note</a>
    <a href="https://linkvertise.com/1/x/dynamic?r=${Buffer.from("https://rentry.co/demo").toString("base64url")}">wrapped</a>`;
  const targets=extractHttpTargets(html,"https://ofversedrops.com/post");
  assert.equal(targets[0],"https://rentry.co/raw/demo");
  assert.ok(targets.includes("https://pastetoday.com/note123"));
  assert.ok(!targets.some((value)=>value.includes("googletagmanager")));
});


test("extracts a bare base64url Pastetoday target from inline JSON",()=>{
  const target="https://pastetoday.com/wic5vif7en";
  const encoded=Buffer.from(target).toString("base64url");
  const html=`<script>window.__payload={destination:"${encoded}"}</script>`;
  assert.ok(extractHttpTargets(html,"https://linkvertise.com/471396/demo").includes(target));
});
