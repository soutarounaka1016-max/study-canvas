const style = document.createElement("style");
style.textContent = `
.study-dashboard{width:min(1180px,calc(100% - 24px));margin:12px auto 0;border:1px solid #d7dde7;border-radius:14px;background:#fff;overflow:hidden}
.study-dashboard-toggle{display:flex;justify-content:space-between;width:100%;min-height:48px;padding:12px 14px;border:0;background:#fff;text-align:left}
.study-dashboard-toggle>span:first-child{display:grid;gap:3px}.study-dashboard-toggle small{color:#64748b}
.study-dashboard-body{display:grid;gap:14px;padding:0 14px 14px}.study-dashboard-body[hidden]{display:none}
.study-dashboard-summary-section{display:grid;gap:9px}.study-dashboard-section-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px}.study-dashboard-section-heading h3,.study-dashboard-subject-heading h4{margin:0;font-size:15px}.study-dashboard-section-heading small,.study-dashboard-subject-heading small{color:#64748b}
.study-dashboard-week-section{padding-top:13px;border-top:1px solid #e2e8f0}
.study-dashboard-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.study-dashboard-stats>div{display:grid;gap:3px;padding:10px;border-radius:10px;background:#f4f6f9}.study-dashboard-stats small{color:#64748b}.study-dashboard-stats strong{font-size:18px;font-variant-numeric:tabular-nums}
.study-dashboard-subjects{display:grid;gap:8px}.study-dashboard-subject-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px}.study-dashboard-subject-list{display:grid;gap:9px}.study-dashboard-subject-row{display:grid;gap:5px}.study-dashboard-subject-row>div:first-child{display:flex;justify-content:space-between;gap:12px;font-size:13px}.study-dashboard-subject-row>div:first-child span{color:#475569;font-variant-numeric:tabular-nums}.study-dashboard-subject-track{height:10px;border-radius:999px;background:#e2e8f0;overflow:hidden}.study-dashboard-subject-track>span{display:block;height:100%;border-radius:inherit;background:#2563eb;transition:width .18s ease}.study-dashboard-subject-empty{margin:0;color:#64748b}
.study-dashboard-definition{margin:0;padding:9px 10px;border-radius:9px;background:#fff8dc;color:#713f12;font-size:12px;line-height:1.5}
.study-dashboard-actions,.study-dashboard-list{display:flex;flex-wrap:wrap;gap:8px}.study-dashboard-actions button,.study-dashboard-task{min-height:44px;border:1px solid #cbd5e1;border-radius:9px;background:#fff}
.study-dashboard-actions button{padding:9px 13px;font-weight:700}.study-dashboard-empty{margin:0;color:#64748b}
.study-dashboard-task{display:grid;grid-template-columns:30px minmax(180px,1fr);align-items:center;padding:8px 10px;text-align:left}.study-dashboard-task>span:last-child{display:grid}
.study-dashboard-check{display:grid;place-items:center;width:25px;height:25px;border:2px solid #94a3b8;border-radius:50%}.study-dashboard-task.is-completed{opacity:.65}.study-dashboard-task.is-completed strong{text-decoration:line-through}.study-dashboard-task.is-completed .study-dashboard-check{background:#16a34a;color:#fff}
@media(max-width:720px){.study-dashboard{width:calc(100% - 12px)}.study-dashboard-stats{grid-template-columns:1fr 1fr}.study-dashboard-stats strong{font-size:16px}}
@media(max-width:420px){.study-dashboard-section-heading,.study-dashboard-subject-heading{align-items:flex-start;flex-direction:column;gap:2px}.study-dashboard-actions button{width:100%}}
`;
document.head.append(style);
