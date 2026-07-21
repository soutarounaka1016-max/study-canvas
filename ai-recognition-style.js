const style = document.createElement("style");
style.textContent = `
.taskize-ai-panel.taskize-assist-panel{display:grid;grid-template-columns:1fr;gap:12px;align-items:start}
.taskize-assist-panel>p{margin:0;line-height:1.55;color:#475569}
.taskize-quick-groups{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.taskize-quick-group{display:grid;gap:8px;min-width:0}
.taskize-quick-label{font-size:13px;color:#334155}
.taskize-quick-buttons{display:flex;flex-wrap:wrap;gap:8px}
.taskize-quick-button{min-width:58px;min-height:44px;padding:8px 12px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#334155;font:inherit;font-weight:800;touch-action:manipulation}
.taskize-quick-button.is-selected{border-color:#2558e6;background:#eef4ff;color:#1745bd;box-shadow:0 0 0 2px rgba(37,88,230,.12)}
.taskize-quick-button:focus-visible{outline:3px solid rgba(37,88,230,.28);outline-offset:2px}
.taskize-assist-note{color:#475569;line-height:1.5}
@media(max-width:760px){.taskize-quick-groups{grid-template-columns:1fr}}
`;
document.head.append(style);
