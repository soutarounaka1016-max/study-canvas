const style = document.createElement("style");
style.textContent = `
.taskize-ai-panel{grid-template-columns:auto minmax(0,1fr);align-items:center}
.taskize-ai-panel>p{margin:0;line-height:1.45}
.taskize-ai-panel .taskize-ai-privacy{grid-column:1/-1;color:#475569;line-height:1.5}
.taskize-ai-panel #taskizeAiButton{min-height:44px;border-color:#8b5cf6;background:#f5f3ff;color:#5b21b6;font-weight:800}
.taskize-ai-panel #taskizeAiButton:disabled{cursor:progress;opacity:.72}
.ai-settings-dialog{width:min(700px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto}
.ai-settings-form{display:grid;gap:16px;margin:0}
.ai-settings-form>label{display:grid;gap:7px;color:#334155;font-size:13px;font-weight:800}
.ai-settings-form input[type="url"],.ai-settings-form input[type="password"]{width:100%;min-height:44px;padding:9px 11px;border:1px solid var(--border);border-radius:9px;font:inherit}
.ai-token-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
.ai-token-row button,.ai-settings-actions button{min-height:44px;padding:9px 14px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;font-weight:800}
.ai-consent-row{grid-template-columns:24px minmax(0,1fr)!important;align-items:start}
.ai-consent-row input{width:22px;height:22px;margin:1px 0 0}
.ai-settings-note{margin:0;padding:12px;border-radius:10px;background:#fff8dc;color:#713f12;line-height:1.55}
.ai-settings-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:9px}
@media(max-width:780px){.taskize-ai-panel{grid-template-columns:1fr}.taskize-ai-panel .taskize-ai-privacy,.taskize-ai-panel>p{grid-column:auto}}
@media(max-width:520px){.ai-token-row{grid-template-columns:1fr}.ai-settings-actions{flex-direction:column-reverse}.ai-settings-actions button{width:100%}}
`;
document.head.append(style);
