import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRecognitionCandidate,
  parseImageDataUrl,
  validateAiSettings,
} from "../src/ai-recognition.js";

test("AI settings require HTTPS, consent, and a long shared token", () => {
  assert.throws(() => validateAiSettings({ endpoint: "http://example.com", accessToken: "x".repeat(24), consented: true }), /https/);
  assert.throws(() => validateAiSettings({ endpoint: "https://example.com", accessToken: "x".repeat(24), consented: false }), /確認/);
  assert.equal(validateAiSettings({ endpoint: "https://example.com/", accessToken: "x".repeat(24), consented: true }).endpoint, "https://example.com");
});

test("AI results are normalized before filling the task form", () => {
  const result = normalizeRecognitionCandidate({ subject: "数学", title: "  微積   2題 ", minutes: 61, confidence: 2, warning: "" });
  assert.deepEqual(result, { subject: "数学", title: "微積 2題", minutes: 60, confidence: 1, warning: "" });
});

test("only PNG or JPEG data URLs within the size limit are accepted", () => {
  assert.equal(parseImageDataUrl("data:image/png;base64,QUJD").mimeType, "image/png");
  assert.throws(() => parseImageDataUrl("data:text/plain;base64,QUJD"), /形式/);
  assert.throws(() => parseImageDataUrl(`data:image/png;base64,${"A".repeat(1_800_000)}`), /大きすぎ/);
});
