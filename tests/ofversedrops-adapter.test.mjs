import test from "node:test";
import assert from "node:assert/strict";
import { parseOfversedropsResults, createOfversedropsAdapter } from "../src/search/adapters/ofversedrops.js";

test("OfverseDrops adapter keeps internal article pages and decoded public note targets", () => {
  const target = "https://pastetoday.com/wic5vif7en";
  const encoded = Buffer.from(target).toString("base64url");
  const html = `
    <a href="https://ofversedrops.com/sample-post/">post</a>
    <a href="https://linkvertise.com/471396/x/dynamic?r=${encoded}&o=sharing">Link 2</a>
    <img src="https://ofversedrops.com/image.jpg">`;
  const results = parseOfversedropsResults(html, "https://ofversedrops.com/?s=test");
  assert.ok(results.includes("https://ofversedrops.com/sample-post/"));
  assert.ok(results.includes(target));
  assert.ok(results.includes("https://pastetoday.com/embed/wic5vif7en"));
  assert.equal(results.some((v) => v.endsWith("image.jpg")), false);
});

test("OfverseDrops adapter is executable", () => {
  const adapter = createOfversedropsAdapter();
  const result = adapter.parse({
    input: { source_id:"ofversedrops_search", mode:"keyword", round:0, query:"demo", template_url:"https://ofversedrops.com/?s={q}" },
    body:'<a href="https://ofversedrops.com/demo-post/">demo</a>'
  });
  assert.equal(result.adapter, "ofversedrops-public-v1");
  assert.ok(result.targets.includes("https://ofversedrops.com/demo-post/"));
});
