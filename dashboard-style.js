const style = document.createElement("style");
style.textContent = `
.study-dashboard{width:min(1180px,calc(100% - 24px));margin:12px auto 0;border:1px solid #d7dde7;border-radius:14px;background:#fff;overflow:hidden}
.study-dashboard-toggle{display:flex;justify-content:space-between;width:100%;padding:12px 14px;border:0;background:#fff;text-align:left}
.study-dashboard-body{display:grid;gap:12px;padding:0 14px 14px}.study-dashboard-body[hidden]{display:none}
.study-dashboard-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.study-dashboard-stats>div{display:grid;padding:10px;border-radius:10px;background:#f4f6f9}
.study-dashboard-actions,.study-dashboard-list{display:flex;flex-wrap:wrap;gap:8px}.study-dashboard-actions button,.study-dashboard-task{min-height:42px;border:1px solid #cbd5e1;border-radius:9px;background:#fff}
.study-dashboard-task{display:grid;grid-template-columns:30px minmax(180px,1fr);align-items:center;padding:8px 10px;text-align:left}.study-dashboard-task>span:last-child{display:grid}
.study-dashboard-check{display:grid;place-items:center;width:25px;height:25px;border:2px solid #94a3b8;border-radius:50%}.study-dashboard-task.is-completed{opacity:.65}.study-dashboard-task.is-completed strong{text-decoration:line-through}.study-dashboard-task.is-completed .study-dashboard-check{background:#16a34a;color:#fff}
@media(max-width:720px){.study-dashboard{width:calc(100% - 12px)}.study-dashboard-stats{grid-template-columns:1fr 1fr}}
`;
document.head.append(style);
