// Shared marketing visual system — void/ash/paper/detonation palette,
// Bebas Neue display + Inter body. Every marketing page mounts this exact
// stylesheet; no page may introduce its own colour or type treatment.

export const MARKETING_CSS = `
.bg-home{--void:#0A0908;--ash:#1C1A18;--ash2:#252220;--paper:#EDE8E0;--smoke:#8B8680;
  --detonation:#C81E1E;--detonation-dim:rgba(200,30,30,0.1);--detonation-line:rgba(200,30,30,0.35);
  background:var(--void);color:var(--paper);font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh}
.bg-home *,.bg-home *::before,.bg-home *::after{box-sizing:border-box}
.bg-home .display{font-family:'Bebas Neue',sans-serif;letter-spacing:.01em}
.bg-home .wrap{max-width:1080px;margin:0 auto;padding:0 48px}
@media (max-width:720px){.bg-home .wrap{padding:0 22px}}

.bg-home nav{position:sticky;top:0;z-index:50;background:rgba(10,9,8,0.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--ash)}
.bg-home .nav-inner{max-width:1080px;margin:0 auto;padding:16px 48px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}
@media (max-width:720px){.bg-home .nav-inner{padding:14px 22px}}
.bg-home .nav-logo{display:flex;align-items:center;gap:10px;flex-shrink:0}
.bg-home .nav-mark{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:.04em}
.bg-home .nav-signin{color:var(--smoke);font-size:13px;font-weight:500;text-decoration:none;flex-shrink:0;transition:color .2s}
.bg-home .nav-signin:hover{color:var(--paper)}
.bg-home .nav-cta{background:var(--detonation);color:var(--paper);font-size:13px;font-weight:600;padding:9px 18px;border-radius:3px;text-decoration:none;border:none;cursor:pointer;font-family:inherit;white-space:nowrap}
.bg-home .nav-rooms{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.bg-home .nav-rooms a{color:var(--smoke);text-decoration:none;font-size:11px;font-weight:600;letter-spacing:.02em;white-space:nowrap;transition:color .2s}
.bg-home .nav-rooms a:hover{color:var(--paper)}
.bg-home .nav-arrow{color:var(--ash2);font-size:11px}
.bg-home .nav-group{display:flex;align-items:baseline;gap:8px}
.bg-home .nav-group .g-label{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--ash2)}

.bg-home .hero{padding:100px 0 80px}
@media (max-width:720px){.bg-home .hero{padding:56px 0 48px}}
.bg-home .pin-row{display:flex;align-items:center;gap:24px;margin-bottom:48px}
.bg-home .pin{width:12px;height:12px;border-radius:50%;background:var(--paper);opacity:.2;flex-shrink:0;transition:background .4s,opacity .4s,box-shadow .4s}
.bg-home .pin.armed{background:var(--detonation);opacity:1;box-shadow:0 0 0 5px var(--detonation-dim)}
.bg-home .pin-line{flex:1;height:1px;background:var(--ash2)}
.bg-home .pin-label{font-size:10px;color:var(--smoke);letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
@media (max-width:720px){.bg-home .pin-label{display:none}}
.bg-home h1.hero-title{font-family:'Bebas Neue',sans-serif;font-size:clamp(48px,6.5vw,80px);line-height:.96;margin-bottom:24px;max-width:20ch;font-weight:400}
.bg-home h1.hero-title em{font-style:normal;color:var(--detonation)}
.bg-home .hero-sub{font-size:17px;color:var(--smoke);max-width:56ch;line-height:1.65;margin-bottom:28px}
.bg-home .hero-weight{font-size:17px;font-weight:600;color:var(--paper);margin-bottom:36px}
.bg-home .hero-weight span{color:var(--detonation)}
.bg-home .hero-ctas{display:flex;gap:16px;flex-wrap:wrap}
.bg-home .btn-primary{background:var(--detonation);color:var(--paper);font-size:14px;font-weight:600;padding:14px 26px;border-radius:3px;text-decoration:none;border:none;cursor:pointer;font-family:inherit}
.bg-home .btn-ghost{border:1px solid var(--ash2);color:var(--paper);font-size:14px;font-weight:500;padding:13px 26px;border-radius:3px;text-decoration:none;background:none;cursor:pointer;font-family:inherit}
.bg-home .hero-stats{margin-top:64px}
.bg-home .stat-row-label{font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--smoke);margin-bottom:8px}
.bg-home .stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--ash);border:1px solid var(--ash);margin-bottom:24px}
@media (max-width:720px){.bg-home .stat-row{grid-template-columns:1fr}}
.bg-home .hstat{background:var(--void);padding:24px 20px}
.bg-home .hstat .n{font-family:'Bebas Neue',sans-serif;font-size:34px;color:var(--paper)}
.bg-home .hstat .n span{color:var(--detonation)}
.bg-home .hstat .l{font-size:13px;color:var(--smoke);margin-top:6px;line-height:1.5}

.bg-home .section{padding:80px 0;border-top:1px solid var(--ash)}
@media (max-width:720px){.bg-home .section{padding:56px 0}}
.bg-home .section-eyebrow{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--smoke);margin-bottom:16px}
.bg-home .section h2{font-size:34px;max-width:26ch;margin-bottom:28px;font-weight:600;font-family:'Inter',sans-serif;line-height:1.2}
.bg-home .section h3{font-size:20px;font-weight:600;margin:0 0 10px;line-height:1.3}
.bg-home .section p.body{font-size:15px;color:var(--smoke);line-height:1.75;max-width:64ch;margin-bottom:18px}
.bg-home .callout{background:var(--ash);border:1px solid var(--detonation-line);border-radius:6px;padding:26px;max-width:70ch;margin-top:34px}
.bg-home .callout .c-title{font-size:16px;font-weight:600;color:var(--paper);margin-bottom:10px}
.bg-home .callout .c-body{font-size:15px;color:var(--smoke);line-height:1.7}

/* chain — the connected architecture strip */
.bg-home .chain{display:flex;align-items:stretch;gap:1px;background:var(--ash);border:1px solid var(--ash);margin:8px 0 34px;flex-wrap:wrap}
.bg-home .chain-node{background:var(--void);padding:20px 18px;flex:1 1 150px;min-width:150px}
.bg-home .chain-node .cn-num{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.12em;color:var(--detonation);margin-bottom:8px}
.bg-home .chain-node .cn-name{font-size:14px;font-weight:600;margin-bottom:6px}
.bg-home .chain-node .cn-desc{font-size:12px;color:var(--smoke);line-height:1.55}

/* gov-grid — evenly weighted card grid */
.bg-home .gov-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--ash);border:1px solid var(--ash)}
.bg-home .gov-grid.cols-3{grid-template-columns:repeat(3,1fr)}
.bg-home .gov-grid.cols-2{grid-template-columns:repeat(2,1fr)}
@media (max-width:900px){.bg-home .gov-grid,.bg-home .gov-grid.cols-3{grid-template-columns:1fr 1fr}}
@media (max-width:560px){.bg-home .gov-grid,.bg-home .gov-grid.cols-3,.bg-home .gov-grid.cols-2{grid-template-columns:1fr}}
.bg-home .gov-card{background:var(--void);padding:24px 20px;text-decoration:none;color:inherit;display:block;transition:background .2s}
a.bg-gov-hover:hover,.bg-home a.gov-card:hover{background:var(--ash)}
.bg-home .gov-card .g-kicker{font-family:'Bebas Neue',sans-serif;font-size:13px;color:var(--detonation);letter-spacing:.1em;margin-bottom:8px;display:block}
.bg-home .gov-card .g-title{font-size:15px;font-weight:600;margin-bottom:8px}
.bg-home .gov-card .g-desc{font-size:13px;color:var(--smoke);line-height:1.6}

/* compare2 — old model vs Brand Grenade */
.bg-home .compare2{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--ash);border:1px solid var(--ash);margin-top:8px}
@media (max-width:720px){.bg-home .compare2{grid-template-columns:1fr}}
.bg-home .compare2 .col{background:var(--void);padding:26px 22px}
.bg-home .compare2 .col.hot{border-top:2px solid var(--detonation)}
.bg-home .compare2 .col-label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--smoke);margin-bottom:14px}
.bg-home .compare2 ul{list-style:none;margin:0;padding:0}
.bg-home .compare2 li{font-size:14px;color:var(--smoke);line-height:1.6;padding:9px 0;border-bottom:1px solid var(--ash)}
.bg-home .compare2 li:last-child{border-bottom:none}
.bg-home .compare2 .col.hot li{color:var(--paper)}

/* chain-row stats */
.bg-home .chain-row{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--ash);border:1px solid var(--ash);margin-top:8px}
@media (max-width:720px){.bg-home .chain-row{grid-template-columns:1fr}}
.bg-home .chain-stat{background:var(--void);padding:24px 20px}
.bg-home .chain-stat .n{font-family:'Bebas Neue',sans-serif;font-size:34px}
.bg-home .chain-stat .n span{color:var(--detonation)}
.bg-home .chain-stat .l{font-size:13px;color:var(--smoke);margin-top:6px;line-height:1.5}

.bg-home .quicknav{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--ash);border:1px solid var(--ash)}
@media (max-width:900px){.bg-home .quicknav{grid-template-columns:1fr 1fr}}
@media (max-width:560px){.bg-home .quicknav{grid-template-columns:1fr}}
.bg-home .qcard{background:var(--void);padding:24px 20px;text-decoration:none;color:inherit;display:block;transition:background .2s}
.bg-home .qcard:hover{background:var(--ash)}
.bg-home .qcard .q-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.bg-home .qcard .q-num{font-family:'Bebas Neue',sans-serif;font-size:13px;color:var(--detonation);letter-spacing:.1em}
.bg-home .qcard .q-arrow{color:var(--ash2);font-size:14px}
.bg-home .qcard .q-desc{font-size:13px;color:var(--smoke);line-height:1.55}

.bg-home .room{padding:56px 0;border-top:1px solid var(--ash);display:grid;grid-template-columns:64px 1fr 1fr;gap:32px}
@media (max-width:820px){.bg-home .room{grid-template-columns:28px 1fr;gap:20px}.bg-home .room-proof{grid-column:2}}
.bg-home .room-pin-col{display:flex;flex-direction:column;align-items:center;padding-top:4px}
.bg-home .room-pin{width:16px;height:16px;border-radius:50%;background:var(--detonation);box-shadow:0 0 0 5px var(--detonation-dim);flex-shrink:0}
.bg-home .room-pin-line{width:1px;flex:1;background:var(--ash2);margin-top:12px}
.bg-home .room-num{font-family:'Bebas Neue',sans-serif;font-size:13px;color:var(--detonation);letter-spacing:.1em;margin-bottom:8px}
.bg-home .room-name{font-size:26px;font-weight:600;margin-bottom:14px;font-family:'Inter',sans-serif}
.bg-home .room-desc{font-size:14px;color:var(--smoke);line-height:1.65;margin-bottom:16px}
.bg-home .room-facts{display:flex;flex-wrap:wrap;gap:8px}
.bg-home .room-fact{font-size:11px;color:var(--paper);background:var(--ash);border:1px solid var(--ash2);padding:5px 10px;border-radius:3px}
.bg-home .room-proof{background:var(--ash);border:1px solid var(--ash2);border-radius:6px;padding:22px 24px;align-self:start}
.bg-home .room-proof-label{font-size:10px;color:var(--smoke);letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px}
.bg-home .room-proof-body{font-size:13px;color:var(--paper);line-height:1.7;font-family:monospace}
.bg-home .redacted{background:var(--smoke);color:var(--smoke);border-radius:2px;padding:0 2px}

.bg-home .rhythm{display:flex;flex-direction:column;gap:1px;background:var(--ash);border:1px solid var(--ash);margin:36px 0;max-width:52ch}
.bg-home .rhythm-row{background:var(--void);padding:16px 22px;display:flex;align-items:center;gap:16px}
.bg-home .rhythm-row .who{font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;width:88px;flex-shrink:0}
.bg-home .rhythm-row .who.machine{color:var(--detonation)}
.bg-home .rhythm-row .who.human{color:var(--smoke)}
.bg-home .rhythm-row .what{font-size:14px;color:var(--paper)}

.bg-home .closing{padding:88px 0;border-top:1px solid var(--ash)}
.bg-home .closing h2{font-family:'Bebas Neue',sans-serif;font-size:clamp(34px,4.6vw,52px);font-weight:400;margin-bottom:24px}
.bg-home .seq{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:28px}
.bg-home .seq b{font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--paper)}
.bg-home .seq i{font-style:normal;color:var(--detonation);font-size:13px}
.bg-home .closing p{font-size:16px;color:var(--smoke);line-height:1.75;max-width:64ch}

.bg-home .finalcta{padding:100px 0;border-top:1px solid var(--ash);text-align:center}
.bg-home .finalcta h2{font-size:clamp(36px,5vw,56px);margin-bottom:20px;font-family:'Bebas Neue',sans-serif;font-weight:400}
.bg-home .finalcta p{color:var(--smoke);font-size:15px;margin-bottom:32px;max-width:56ch;margin-left:auto;margin-right:auto;line-height:1.7}
.bg-home .finalcta .cta-pair{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.bg-home .footer-byline{font-size:12px;color:var(--smoke);margin-top:16px;line-height:1.6;text-align:center;width:100%;max-width:640px;margin-left:auto;margin-right:auto}
.bg-home .footer-byline + .footer-byline{margin-top:8px}
.bg-home footer{border-top:1px solid var(--ash);padding:32px 0;text-align:center;font-size:13px;color:var(--smoke)}
.bg-home .governing{font-size:13px;color:var(--smoke);line-height:1.7;max-width:72ch;margin:0 auto;padding:0 24px}

/* ---------- Mobile ---------- */
@media (max-width:720px){
  .bg-home{overflow-x:hidden}
  .bg-home .nav-inner{gap:12px;flex-wrap:nowrap}
  .bg-home .nav-rooms{display:none}
  .bg-home .nav-mark{font-size:16px}
  .bg-home .nav-cta{padding:10px 14px;font-size:13px}
  .bg-home .nav-signin{font-size:13px}
  .bg-home .pin-row{gap:14px;margin-bottom:32px}
  .bg-home h1.hero-title{font-size:clamp(40px,11vw,58px);max-width:none;margin-bottom:20px}
  .bg-home .hero-sub,.bg-home .hero-weight{font-size:16px}
  .bg-home .hero-ctas{flex-direction:column;align-items:stretch;gap:12px}
  .bg-home .hero-ctas .btn-primary,.bg-home .hero-ctas .btn-ghost{
    display:block;width:100%;text-align:center;padding:16px 20px;font-size:15px}
  .bg-home .hero-stats{margin-top:44px}
  .bg-home .section h2{font-size:26px;max-width:none}
  .bg-home .closing{padding:64px 0}
  .bg-home .finalcta{padding:64px 0}
  .bg-home .room{padding:44px 0;grid-template-columns:1fr;gap:16px}
  .bg-home .room-pin-col{flex-direction:row;align-items:center;gap:12px;padding-top:0}
  .bg-home .room-pin-line{width:100%;height:1px;flex:1;margin-top:0}
  .bg-home .room-proof{grid-column:auto;padding:18px}
  .bg-home .room-proof-body{font-size:13px;word-break:break-word}
  .bg-home .room-name{font-size:22px}
  .bg-home .rhythm{max-width:none}
  .bg-home .rhythm-row{padding:14px 16px;gap:12px}
  .bg-home .rhythm-row .who{width:72px;font-size:12px}
  .bg-home .callout{padding:20px}
}

/* ---------- Demo request sheet ---------- */
.bg-demo-overlay{position:fixed;inset:0;z-index:100;display:flex;align-items:center;
  justify-content:center;background:rgba(10,9,8,0.86);padding:24px;overflow-y:auto;
  -webkit-overflow-scrolling:touch}
.bg-demo-panel{width:100%;max-width:460px;background:#1C1A18;border:1px solid #252220;
  border-radius:6px;padding:32px;color:#EDE8E0;font-family:'Inter',sans-serif}
.bg-demo-field{width:100%;background:#0A0908;border:1px solid #252220;border-radius:3px;
  color:#EDE8E0;padding:12px 12px;font-size:16px;font-family:inherit;-webkit-appearance:none}
.bg-demo-field:focus{outline:none;border-color:#C81E1E}
.bg-demo-panel .btn-primary{background:#C81E1E;color:#EDE8E0;font-size:14px;font-weight:600;
  padding:14px 26px;border-radius:3px;border:none;cursor:pointer;font-family:inherit}
@media (max-width:720px){
  .bg-demo-overlay{padding:0;align-items:stretch;justify-content:stretch}
  .bg-demo-panel{max-width:none;border:none;border-radius:0;min-height:100dvh;
    padding:24px 20px calc(32px + env(safe-area-inset-bottom));display:flex;flex-direction:column}
  .bg-demo-field{padding:14px 12px}
  .bg-demo-panel .btn-primary{width:100%;padding:16px 20px;font-size:16px}
}
`;
