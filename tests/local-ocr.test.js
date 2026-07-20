import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeLocalOcrText,
  parseLocalOcrCandidate,
} from "../src/local-ocr.js";

test("local OCR normalizes full-width text and separators", () => {
  assert.equal(normalizeLocalOcrText(" 英語｜長文２題｜４５分 "), "英語 長文2題 45分");
});

test("local OCR extracts explicit subject, title, and duration", () => {
  const result = parseLocalOcrCandidate("数学 微積 60分", 90);
  assert.equal(result.subject, "数学");
  assert.equal(result.title, "微積");
  assert.equal(result.minutes, 60);
  assert.ok(result.confidence > 0.7);
});

test("local OCR infers a subject from study keywords", () => {
  const result = parseLocalOcrCandidate("コンデンサー 50", 70);
  assert.equal(result.subject, "物理");
  assert.equal(result.title, "コンデンサー");
  assert.equal(result.minutes, 50);
});

test("local OCR uses a safe default when duration is missing", () => {
  const result = parseLocalOcrCandidate("化学 有機化学復習", 60);
  assert.equal(result.subject, "化学");
  assert.equal(result.title, "有機化学復習");
  assert.equal(result.minutes, 30);
  assert.match(result.warning, /30分/);
});

test("local OCR rejects empty recognition text", () => {
  assert.throws(() => parseLocalOcrCandidate("   "), /読み取れません/);
});
