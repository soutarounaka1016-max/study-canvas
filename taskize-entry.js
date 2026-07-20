const existingStyle = document.querySelector('link[data-taskize-style="true"]');
if (!existingStyle) {
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "taskize.css?v=20260720-10";
  style.dataset.taskizeStyle = "true";
  document.head.append(style);
}

await import("./taskize-ui.js?v=20260720-10");
await import("./dashboard-entry.js?v=20260720-14");
