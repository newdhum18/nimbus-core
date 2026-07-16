import test from "node:test";
import assert from "node:assert/strict";
import { decodeSearchTarget, extractHttpTargets, pastetodayContentVariants } from "../src/search/target-decoder.js";
import { extractMegaFolders } from "../src/extract/mega.js";
import { parseOfversedropsResults } from "../src/search/adapters/ofversedrops.js";

const destination="https://pastetoday.com/wic5vif7en";
const encoded=Buffer.from(destination).toString("base64url");
const linkvertise=`https://linkvertise.com/471396/test/dynamic?r=${encoded}&o=sharing`;

test("decodes public Linkvertise destination to PasteToday",()=>{
 assert.equal(decodeSearchTarget(linkvertise,"https://ofversedrops.com/post"),destination);
});

test("Ofverse parsing retains PasteToday base and embed targets",()=>{
 const html=`<a href="${linkvertise}">Link 2</a>`;
 const targets=parseOfversedropsResults(html,"https://ofversedrops.com/example");
 assert.ok(targets.includes(destination));
 assert.ok(targets.includes("https://pastetoday.com/embed/wic5vif7en"));
});

test("PasteToday extraction handles HTML and escaped MEGA folder URL",()=>{
 const body=`<pre>https:\/\/mega.nz\/folder\/3MBkUBqS#B8VI_3a7abcdefghijklmnopqrstu</pre>`;
 const links=extractMegaFolders(body);
 assert.equal(links.length,1);
 assert.match(links[0].normalizedUrl,/mega\.nz\/folder/);
});

test("PasteToday variants always include base and embed",()=>{
 assert.deepEqual(pastetodayContentVariants(destination),[destination,"https://pastetoday.com/embed/wic5vif7en"]);
});
