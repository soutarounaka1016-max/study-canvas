import { readFile, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const originalPath = "scripts/apply-weekly-ai-cache-fix.mjs";
const temporaryPath = "/tmp/apply-weekly-ai-cache-fix.mjs";
let source = await readFile(originalPath, "utf8");

source = source.replace("${publishedRequirement}", "\\${publishedRequirement}");
source = source.replace(
  /console\.log\(`Workers AI live recognition succeeded with .*?task\(s\)\.`\);/,
  'console.log("Workers AI live recognition succeeded with " + value.tasks.length + " task(s).");',
);

await writeFile(temporaryPath, source);
await import(pathToFileURL(temporaryPath).href);
await rm("scripts/apply-weekly-ai-cache-fix-wrapper.mjs");
