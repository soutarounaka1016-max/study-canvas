const style = document.createElement("style");
style.textContent = `
.home-screen{min-height:100dvh;padding:max(20px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(28px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));background:#f4f5f7;color:#172033}
.home-shell{width:min(1120px,100%);margin:0 auto;display:grid;gap:18px}
.home-heading{display:flex;align-items:end;justify-content:space-between;gap:16px}
.home-heading h1{margin:0;font-size:clamp(1.7rem,3vw,2.4rem)}
.home-heading p{margin:5px 0 0;color:#5b6475}
.home-date{font-size:.95rem;color:#5b6475;white-space:nowrap}
.home-today-card{display:grid;gap:16px;padding:20px;border:1px solid #d7dde7;border-radius:18px;background:#fff;box-shadow:0 8px 24px rgba(40,55,85,.08)}
.home-today-heading{display:flex;align-items:center;justify-content:space-between;gap:14px}
.home-today-heading h2{margin:0;font-size:1.25rem}.home-today-heading small{color:#64748b}
.home-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.home-summary-grid>div{display:grid;gap:4px;padding:13px;border-radius:12px;background:#f4f6f9}
.home-summary-grid small{color:#64748b}.home-summary-grid strong{font-size:1.25rem}
.home-primary-button,.home-menu-card{min-height:52px;border:1px solid #c8d2e2;border-radius:12px;background:#fff;color:#172033;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.home-primary-button{justify-self:start;padding:0 20px;border-color:#2558e6;background:#2558e6;color:#fff;font-weight:700}
.home-primary-button:active,.home-menu-card:active,.home-nav-button:active{transform:translateY(1px)}
.home-section-title{margin:2px 0 -4px;font-size:1.05rem}
.home-menu-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.home-menu-card{display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:10px;min-height:92px;padding:14px;text-align:left}
.home-menu-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:#eef2ff;font-size:1.35rem}
.home-menu-text{display:grid;gap:4px}.home-menu-text strong{font-size:1rem}.home-menu-text small{color:#64748b;line-height:1.4}
.home-menu-arrow{font-size:1.3rem;color:#94a3b8}
.home-definition{margin:0;color:#64748b;font-size:.88rem;line-height:1.5}
.home-nav-button{order:-1;min-width:58px}
body.is-home-route .app-header,
body.is-home-route .pen-options,
body.is-home-route .orientation-note,
body.is-home-route .study-dashboard,
body.is-home-route .workspace{display:none!important}
body:not(.is-home-route) .home-screen{display:none}
@media(max-width:820px){.home-menu-grid{grid-template-columns:1fr 1fr}.home-summary-grid{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.home-screen{padding-left:10px;padding-right:10px}.home-heading{align-items:start;flex-direction:column}.home-menu-grid{grid-template-columns:1fr}.home-menu-card{min-height:78px}.home-today-card{padding:14px}}
`;
document.head.append(style);
