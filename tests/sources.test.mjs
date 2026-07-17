import test from "node:test";
import assert from "node:assert/strict";
import { sourceCatalog } from "../src/sources/catalog.js";

test("autonomous catalog contains only distinct real discovery surfaces",()=>{
 const c=sourceCatalog(); assert.equal(c.length,37);
 assert.equal(new Set(c.map(x=>x.id)).size,c.length);
 assert.equal(new Set(c.map(x=>x.templateUrl)).size,c.length);
});
test("autonomous catalog enables 31 proven/exploration sources",()=>{assert.equal(sourceCatalog().filter(x=>x.enabled).length,31)});
test("catalog excludes GitHub and YouTube",()=>{assert.equal(sourceCatalog().some(x=>/github|youtube/i.test(`${x.name} ${x.templateUrl}`)),false)});
test("Bing remains disabled reserve",()=>{const b=sourceCatalog().filter(x=>/bing/i.test(x.name));assert.ok(b.length>0);assert.ok(b.every(x=>!x.defaultEnabled&&!x.enabled));});
test("catalog includes direct indexes, comments, archives and paste discovery",()=>{const ids=new Set(sourceCatalog().map(x=>x.id));for(const id of ["meawfy_api","meawfy_search","ofversedrops_search","reddit_search_json","reddit_comments_json","wayback_cdx_rentry","ddg_rentry"])assert.ok(ids.has(id),id)});
