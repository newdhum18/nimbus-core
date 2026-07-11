import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin } from "../src/api/cors.js";

test("allows production Pages origin", () => {
  assert.equal(isAllowedOrigin("https://nimbus-core-v36-web.pages.dev"), true);
});

test("allows only project preview origins", () => {
  assert.equal(isAllowedOrigin("https://abc.nimbus-core-v36-web.pages.dev"), true);
  assert.equal(isAllowedOrigin("https://evil.pages.dev"), false);
});

test("rejects non-https and invalid origins", () => {
  assert.equal(isAllowedOrigin("http://nimbus-core-v36-web.pages.dev"), false);
  assert.equal(isAllowedOrigin("invalid"), false);
});

import { corsHeaders } from "../src/api/cors.js";

test("does not reflect an unapproved origin", () => {
  const headers = corsHeaders(new Request("https://worker.test", {
    headers: { origin: "https://evil.example" }
  }));
  assert.equal(headers["access-control-allow-origin"], undefined);
});
