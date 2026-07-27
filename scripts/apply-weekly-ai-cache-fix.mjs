import { appendFile, readFile, rm, writeFile } from "node:fs/promises";

const RELEASE_ID = "20260728-weekly-ai-cache-1";
const RELEASE_ENTRY_VERSION = "20260728-1";
const OLD_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const NEW_MODEL = "@cf/google/gemma-4-26b-a4b-it";

async function read(path) {
  return readFile(path, "utf8");
}

async function replaceRequired(path, search, replacement) {
  const current = await read(path);
  if (!current.includes(search)) throw new Error(`${path}: 置換対象が見つかりません: ${search.slice(0, 80)}`);
  await writeFile(path, current.replace(search, replacement));
}

async function replaceAllRequired(path, search, replacement) {
  const current = await read(path);
  if (!current.includes(search)) throw new Error(`${path}: 一括置換対象が見つかりません: ${search}`);
  await writeFile(path, current.split(search).join(replacement));
}

await replaceRequired(
  "index.html",
  'meta name="study-canvas-release" content="20260724-backup-guidance-1"',
  `meta name="study-canvas-release" content="${RELEASE_ID}"`,
);
await replaceRequired(
  "index.html",
  "release-entry.js?v=20260721-4",
  `release-entry.js?v=${RELEASE_ENTRY_VERSION}`,
);

await replaceRequired(
  "tests/e2e/app.spec.js",
  'const EXPECTED_RELEASE = "20260724-backup-guidance-1";',
  `const EXPECTED_RELEASE = "${RELEASE_ID}";\nconst EXPECTED_RELEASE_ENTRY = "release-entry.js?v=${RELEASE_ENTRY_VERSION}";`,
);
await replaceRequired(
  "tests/e2e/app.spec.js",
  '  await expect(page.locator("html")).not.toHaveAttribute("data-note-load-error", "true");',
  `  await expect(page.locator('script[src^="release-entry.js"]')).toHaveAttribute("src", EXPECTED_RELEASE_ENTRY);\n  await page.locator('[data-home-route="weekly"]').click();\n  await expect(page.locator("#weeklyDialog[open]")).toBeVisible();\n  await page.locator("#weeklyRecognitionButton").click();\n  await expect(page.locator("#weeklyRunRecognition")).toBeVisible();\n  await expect(page.locator("#weeklyAddCandidate")).toBeVisible();\n  await expect(page.locator("#weeklySaveCandidates")).toBeAttached();\n  await expect(page.locator(".weekly-recognition-placeholder")).toHaveCount(0);\n  await expect(page.locator("html")).not.toHaveAttribute("data-note-load-error", "true");`,
);

await replaceAllRequired("cloudflare-worker.js", OLD_MODEL, NEW_MODEL);
await replaceAllRequired(".github/workflows/pages.yml", OLD_MODEL, NEW_MODEL);
await replaceAllRequired("scripts/check.mjs", OLD_MODEL, NEW_MODEL);
await replaceRequired(
  "tests/cloudflare-worker.test.js",
  "assert.match(model, /llama-3\\.2-11b-vision/);",
  "assert.match(model, /gemma-4-26b-a4b/);",
);

await replaceAllRequired(
  "scripts/check.mjs",
  "20260724-backup-guidance-1",
  RELEASE_ID,
);
await replaceAllRequired(
  "scripts/check.mjs",
  "release-entry.js?v=20260721-4",
  `release-entry.js?v=${RELEASE_ENTRY_VERSION}`,
);

await replaceRequired(
  "scripts/check.mjs",
  'if (!html.includes("note-ui.js?v=20260721-2")) {',
  `const releaseMetaMatch = html.match(/meta name="study-canvas-release" content="([^"]+)"/);\nconst releaseEntryMatch = html.match(/release-entry\\.js\\?v=([^"']+)/);\nconst releaseMetaDate = releaseMetaMatch?.[1].match(/^(\\d{8})-/)?.[1];\nconst releaseEntryDate = releaseEntryMatch?.[1].match(/^(\\d{8})-/)?.[1];\nif (!releaseMetaDate || !releaseEntryDate || releaseMetaDate !== releaseEntryDate) {\n  console.error("公開識別子とrelease-entry.jsのキャッシュ日付が一致していません");\n  failed = true;\n}\n\nif (!html.includes("note-ui.js?v=20260721-2")) {`,
);

await replaceRequired(
  "scripts/check.mjs",
  'const weeklyRecognitionEntry = await readFile("weekly-recognition-entry.js", "utf8");',
  `const publicEntryDate = Number(releaseEntryMatch?.[1].match(/^(\\d{8})-/)?.[1]);\nconst importedEntryDates = [...releaseEntry.matchAll(/\\?v=(\\d{8})-\\d+/g)].map((match) => Number(match[1]));\nif (!Number.isFinite(publicEntryDate) || importedEntryDates.some((date) => date > publicEntryDate)) {\n  console.error("release-entry.jsより新しい子モジュールがあるのに公開キャッシュ番号が更新されていません");\n  failed = true;\n}\n\nconst weeklyRecognitionEntry = await readFile("weekly-recognition-entry.js", "utf8");`,
);

await replaceRequired(
  "scripts/check.mjs",
  'const worker = await readFile("cloudflare-worker.js", "utf8");',
  `for (const publishedRequirement of [\n  "Verify published release chain",\n  "Verify live Workers AI recognition",\n  "weeklyRunRecognition",\n  "weeklySaveCandidates",\n  "Cache-Control: no-cache",\n]) {\n  if (!pagesWorkflow.includes(publishedRequirement)) {\n    console.error(\`公開版のキャッシュ・AI実動確認に${publishedRequirement}がありません\`);\n    failed = true;\n  }\n}\n\nconst worker = await readFile("cloudflare-worker.js", "utf8");`,
);

await replaceRequired(
  ".github/workflows/pages.yml",
  "      - name: Verify the published app\n",
  `      - name: Verify published release chain\n        env:\n          BASE_URL: https://soutarounaka1016-max.github.io/study-canvas/\n          EXPECTED_RELEASE: ${RELEASE_ID}\n          EXPECTED_ENTRY: release-entry.js?v=${RELEASE_ENTRY_VERSION}\n        shell: bash\n        run: |\n          set -euo pipefail\n          html="$(curl --silent --show-error --fail --max-time 30 -H 'Cache-Control: no-cache' "${'${BASE_URL}'}?release-chain=${'${GITHUB_SHA}'}")"\n          grep -F "meta name=\\"study-canvas-release\\" content=\\"${'${EXPECTED_RELEASE}'}\\"" <<<"${'${html}'}"\n          grep -F "src=\\"${'${EXPECTED_ENTRY}'}\\"" <<<"${'${html}'}"\n          entry="$(curl --silent --show-error --fail --max-time 30 -H 'Cache-Control: no-cache' "${'${BASE_URL}'}${'${EXPECTED_ENTRY}'}")"\n          grep -F 'weekly-recognition-entry.js?v=20260727-1' <<<"${'${entry}'}"\n          weekly="$(curl --silent --show-error --fail --max-time 30 -H 'Cache-Control: no-cache' "${'${BASE_URL}'}weekly-recognition-entry.js?v=20260727-1")"\n          grep -F 'weeklyRunRecognition' <<<"${'${weekly}'}"\n          grep -F 'weeklySaveCandidates' <<<"${'${weekly}'}"\n\n      - name: Verify live Workers AI recognition\n        shell: bash\n        run: |\n          set -euo pipefail\n          node --input-type=module <<'NODE'\n          import { chromium } from "@playwright/test";\n          const browser = await chromium.launch({ headless: true });\n          const context = await browser.newContext({ viewport: { width: 900, height: 360 } });\n          const page = await context.newPage();\n          await page.setContent(\`<!doctype html><style>body{margin:0;background:white;font-family:Arial,sans-serif}.sheet{padding:36px;color:#111}.subject{font-size:48px;font-weight:700}.task{margin-top:34px;font-size:64px;font-weight:700}</style><div class="sheet"><div class="subject">MATH WEEKLY PLAN</div><div class="task">INTEGRAL 3 QUESTIONS</div></div>\`);\n          await page.screenshot({ path: "/tmp/weekly-ai-smoke.png" });\n          await browser.close();\n          NODE\n          image_data="$(base64 -w0 /tmp/weekly-ai-smoke.png)"\n          payload="$(IMAGE_DATA="${'${image_data}'}" node -e 'process.stdout.write(JSON.stringify({mode:"weekly",subject:"数学",weekStart:"2026-07-27",image:{mimeType:"image/png",data:process.env.IMAGE_DATA}}))')"\n          response="$(curl --silent --show-error --fail-with-body --max-time 120 \\\n            -X POST \\\n            -H 'Origin: https://soutarounaka1016-max.github.io' \\\n            -H 'Content-Type: application/json' \\\n            --data-binary "${'${payload}'}" \\\n            'https://study-canvas.soutarou-naka-1016.workers.dev/recognize')"\n          node -e '\n            const value = JSON.parse(process.argv[1]);\n            const valid = value.subject === "数学"\n              && value.weekStart === "2026-07-27"\n              && Array.isArray(value.tasks)\n              && value.tasks.length > 0\n              && value.tasks.every((task) => typeof task.title === "string" && task.title.trim());\n            if (!valid) { console.error(value); process.exit(1); }\n            console.log(`Workers AI live recognition succeeded with ${'${value.tasks.length}'} task(s).`);\n          ' "${'${response}'}"\n\n      - name: Verify the published app\n`,
);

await replaceRequired(
  "AGENTS.md",
  "- 公開コードを変えた場合は参照バージョンを更新する。",
  `- 公開コードを変えた場合は参照バージョンを更新する。\n- 親モジュールが新しい子モジュールを読み込む場合、親モジュール自身のHTML参照キャッシュ番号も必ず更新する。\n- 公開テストはHTMLのリリース識別子だけでなく、公開HTML→公開入口JavaScript→対象機能JavaScriptの取得経路をno-cacheで検証する。\n- 外部AI画像認識を変更した場合は、health確認だけで終えず、合成PNGを本番Workerへ送り複数タスクが返る実動スモークテストを行う。`,
);

const decision = `\n## 2026-07-28 公開キャッシュとAI実動確認\n\n- 公開機能の子モジュールを追加・更新した場合、親のrelease-entry.jsを参照するindex.htmlのキャッシュ番号も更新する。\n- 静的テストで、公開入口のバージョン日付が読み込む子モジュールより古い場合は失敗させる。\n- GitHub Pages公開後に、HTML、公開入口、対象機能モジュールの連鎖をno-cacheで取得して確認する。\n- Workers AIはhealthだけでなく、合成PNGを本番recognizeへ送信し、タスク配列が返ることを確認する。\n- 日本語手書き認識には、Cloudflareが多言語OCR・手書き認識を明示する @cf/google/gemma-4-26b-a4b-it を使用する。\n`;
await appendFile("DECISIONS.md", decision);

try {
  await appendFile("AI_RECOGNITION_STATUS.md", `\n## 2026-07-28 キャッシュ事故修正\n\n- index.htmlのrelease-entry.js参照番号を更新し、iPad Safariが完成版を取得できるようにした。\n- 公開HTML、入口JavaScript、週間認識JavaScriptの連鎖確認を追加した。\n- 本番Workerへ合成PNGを送る実動試験を追加した。\n- 画像認識モデルをGemma 4 26B A4Bへ変更した。\n`);
} catch {
  // 管理ファイルが存在しない場合は他の記録で代替する。
}

await rm("scripts/apply-weekly-ai-cache-fix.mjs");
await rm(".github/workflows/apply-weekly-ai-cache-fix.yml");
