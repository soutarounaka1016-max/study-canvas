const style=document.createElement("style");
style.textContent=`
.full-restore-dialog{width:min(760px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto}
.full-restore-header{display:flex;justify-content:space-between;gap:18px}.full-restore-header h2,.full-restore-header p{margin:0}.full-restore-header p{margin-top:6px;color:#64748b}
.full-restore-summary{display:grid;grid-template-columns:max-content 1fr;gap:8px 14px}.full-restore-summary dt{font-weight:800}.full-restore-summary dd{margin:0}
.full-restore-sections{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0;padding:14px;border:1px solid #d7dde7;border-radius:12px}.full-restore-sections label{display:flex;align-items:center;gap:8px;min-height:42px}.full-restore-sections input{width:22px;height:22px}.full-restore-sections .is-unavailable{opacity:.45}
.full-restore-note,.full-restore-warning{padding:11px 12px;border-radius:10px;background:#fff8dc}.full-restore-message{min-height:24px;color:#166534;font-weight:800}.full-restore-message.is-error{color:#b91c1c}.full-restore-actions{display:flex;justify-content:flex-end;gap:10px}.full-restore-actions button{min-height:44px;padding:9px 16px}
@media(max-width:560px){.full-restore-sections{grid-template-columns:1fr}.full-restore-actions{flex-direction:column-reverse}}
`;
document.head.append(style);
