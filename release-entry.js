const releaseMetadata = fetch(new URL("./factory-manifest.json", import.meta.url), { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`Factory Manifestを取得できません (${response.status})`);
    return response.json();
  })
  .then((manifest) => {
    if (!manifest?.releaseId || !manifest?.officialUrl) throw new Error("Factory Manifestが不正です");
    document.documentElement.dataset.release = manifest.releaseId;
    document.documentElement.dataset.releaseSource = manifest.releaseSource;
  })
  .catch((error) => {
    document.documentElement.dataset.releaseError = "true";
    console.error(error);
  });

await Promise.all([
  import("./daily-enhancements.js?v=20260729-3"),
  import("./full-backup-entry.js?v=20260804-1"),
  import("./home-entry.js?v=20260804-1"),
  releaseMetadata,
]);
