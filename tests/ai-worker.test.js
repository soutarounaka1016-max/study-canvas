import assert from "node:assert/strict";
import test from "node:test";
import { createGeminiPayload, parseGeminiCandidate } from "../cloudflare-worker.js";

test("AI service uses the fixed free-tier model payload", () => {
  const payload = createGeminiPayload({ mimeType: "image/png", data: "QUJD" });
  assert.equal(payload.contents.length, 1);
  assert.equal(payload.contents[0].parts.length, 2);
  assert.equal(payload.contents[0].parts[1].inlineData.data, "QUJD");
  assert.equal(payload.generationConfig.responseMimeType, "application/json");
  assert.equal(payload.generationConfig.responseJsonSchema.additionalProperties, false);
});

test("AI service validates the structured candidate", () => {
  const candidate = parseGeminiCandidate({
    candidates: [{ content: { parts: [{ text: JSON.stringify({
      subject: "化学",
      title: "有機化学 例題",
      minutes: 34,
      confidence: 0.8,
      warning: "",
    }) }] } }],
  });
  assert.deepEqual(candidate, {
    subject: "化学",
    title: "有機化学 例題",
    minutes: 35,
    confidence: 0.8,
    warning: "",
  });
  assert.throws(() => parseGeminiCandidate({ candidates: [] }), /候補/);
});
