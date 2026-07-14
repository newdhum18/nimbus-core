import test from "node:test";
import assert from "node:assert/strict";
import { discoveryProviderStatus } from "../src/sources/discovery-providers.js";

test("source discovery reports official provider configuration explicitly",()=>{
  const empty=discoveryProviderStatus({});
  assert.equal(empty.brave.configured,false);
  assert.equal(empty.searxng.configured,false);
  const configured=discoveryProviderStatus({BRAVE_SEARCH_API_KEY:"secret",SEARXNG_BASE_URL:"https://search.example.com"});
  assert.equal(configured.brave.configured,true);
  assert.equal(configured.searxng.configured,true);
});
