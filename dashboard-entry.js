if (!document.querySelector('link[data-dashboard-style="true"]')) {
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "dashboard-layout.css?v=20260720-11";
  style.dataset.dashboardStyle = "true";
  document.head.append(style);
}

await import("./dashboard-ui.js?v=20260720-11");
