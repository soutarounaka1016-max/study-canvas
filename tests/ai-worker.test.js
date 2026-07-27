import assert from "node:assert/strict";
import test from "node:test";
import { createSingleRequest, normalizeSingleCandidate, parseAiJson } from "../cloudflare-worker.js";

test("AI service uses the Workers AI vision and JSON payload", () => {
  const payload = createSingleRequest({ mimeType: "image/png", data: "QUJD" });
  assert.equal(payload.image, "QUJD");
  assert.doesNotMatch(payload.image, /^data:/);
  assert.equal(payload.messages[0].role, "system");
  assert.equal(payload.messages[1].role, "user");
  assert.equal(payload.response_format.type, "json_schema");
  assert.equal(payload.response_format.json_schema.additionalProperties, false);
  assert.equal(payload.temperature, 0.1);
});

test("AI service validates the structured candidate", () => {
  const candidate = normalizeSingleCandidate(parseAiJson({ response: JSON.stringify({
    subject: "化学",
    title: "有機化学 例題",
    minutes: 34,
    confidence: 0.8,
    warning: "",
  }) }));
  assert.deepEqual(candidate, {
    subject: "化学",
    title: "有機化学 例題",
    minutes: 35,
    confidence: 0.8,
    warning: "",
  });
  assert.throws(() => parseAiJson({ response: "" }), /JSON/);
});
