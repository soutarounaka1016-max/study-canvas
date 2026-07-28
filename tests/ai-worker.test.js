import assert from "node:assert/strict";
import test from "node:test";
import { createSingleRequest, normalizeSingleCandidate, parseAiJson } from "../cloudflare-worker.js";

test("AI service uses the Moondream OCR query payload", () => {
  const payload = createSingleRequest({ mimeType: "image/png", data: "QUJD" });
  assert.equal(payload.task, "query");
  assert.equal(payload.image, "data:image/png;base64,QUJD");
  assert.match(payload.question, /Copy every visible line/);
  assert.equal(payload.reasoning, false);
  assert.equal(payload.stream, false);
  assert.equal(payload.max_tokens, 400);
  assert.equal(payload.temperature, 0);
});

test("AI service validates the structured candidate", () => {
  const candidate = normalizeSingleCandidate(parseAiJson({ answer: JSON.stringify({
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
  assert.throws(() => parseAiJson({ answer: "" }), /JSON/);
});
