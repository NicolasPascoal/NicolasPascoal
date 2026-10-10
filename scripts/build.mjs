// Builds the SVGs for the profile README. Look: night sky, black and graphite, one signal-yellow accent.
//   assets/hero.svg       spotlight projecting the "NP" monogram + name
//   assets/dashboard.svg  career, repositories, Gabaro roadmap, activity and stack (live GitHub data)
//
// Usage: GITHUB_TOKEN=... node scripts/build.mjs
// Deterministic output: if the data did not change, the files do not change (the Action only commits diffs).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const USER = "NicolasPascoal";
const TZ = "America/Sao_Paulo";
const ROADMAP = { repo: "Expense-Management-Project", file: "STATUS.md" };

// Timeline. `to: null` = ongoing. `plan` = expected end date (drawn dotted).
const CAREER = [
  { org: "VÉRTICE", role: "junior software developer · oneclick", from: "2026-09", to: null, live: true },
  { org: "ARIKI", role: "it support analyst", from: "2026-07", to: "2026-09" },
  { org: "PRODESAN", role: "it infrastructure + full stack dev intern", from: "2024-07", to: "2026-07" },
  { org: "UNISANTA", role: "b.sc. information systems", from: "2024-02", to: null, plan: "2027-12" },
  { org: "SENAC SANTOS", role: "technical diploma, business admin", from: "2021-02", to: "2023-12" },
];

// ---------------------------------------------------------------- palette

const C = {
  void: "#000000", card: "#050506", line: "#161618", grid: "#101012",
  text: "#EDEDED", silver: "#9A9AA0", steel: "#5C5C63", dim: "#2E2E33", off: "#17171A",
  signal: "#F5C842",
};
const GREYS = ["#EDEDED", "#B4B4BA", "#86868C", "#606066", "#45454B", "#2C2C31"];

// ---------------------------------------------------------------- utilities

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const b64 = (file) => readFileSync(join(ROOT, "assets/fonts", file)).toString("base64");
const face = (family, weight, file) =>
  `@font-face{font-family:${family};font-weight:${weight};src:url(data:font/woff2;base64,${b64(file)}) format("woff2")}`;
const FONTS = face("Wide", 700, "syncopate-700.woff2") + face("Mono", 400, "geist-mono-400.woff2") + face("Mono", 600, "geist-mono-600.woff2");
const f1 = (n) => n.toFixed(1);

function write(rel, content) {
  const path = join(ROOT, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`${rel}  ${(content.length / 1024).toFixed(1)} KB`);
}

const MESES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function parts(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { d: p.day, mm: p.month, m: MESES[Number(p.month) - 1], y: p.year };
}
// Today at noon in São Paulo: output changes at most once a day.
function today() {
  const { d, mm, y } = parts(new Date());
  return new Date(`${y}-${mm}-${d}T12:00:00-03:00`);
}
const ym = (s) => new Date(`${s}-01T12:00:00-03:00`);

const BASE_CSS = `
.lbl{font:600 10.5px Mono;fill:${C.steel};letter-spacing:3px}
.sm{font:400 11px Mono;fill:${C.steel}}
.pulse{animation:pulse 2.4s ease-in-out infinite}
@keyframes pulse{50%{opacity:.3}}
@keyframes in{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

// ---------------------------------------------------------------- data

async function gh(path, { raw = false, body } = {}) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const res = await fetch(`https://api.github.com/${path}`, {
    method: body ? "POST" : "GET",
    body: body && JSON.stringify(body),
    headers: {
      Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      "User-Agent": `${USER}-profile`,
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} em ${path}`);
  return raw ? res.text() : res.json();
}

async function loadData() {
  const repos = (await gh(`users/${USER}/repos?per_page=100&type=owner&sort=pushed`))
    .filter((r) => !r.fork && !r.private && r.name !== USER);

  const totals = {};
  for (const r of repos) {
    for (const [lang, bytes] of Object.entries(await gh(`repos/${USER}/${r.name}/languages`))) {
      totals[lang] = (totals[lang] || 0) + bytes;
    }
  }

  const cal = await gh("graphql", {
    body: { query: `{user(login:"${USER}"){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}` },
  });
  const days = cal.data.user.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays).map((d) => ({ date: d.date, n: d.contributionCount }));

  let roadmap = null;
  try {
    const md = await gh(`repos/${USER}/${ROADMAP.repo}/contents/${ROADMAP.file}`, { raw: true });
    roadmap = md.split("\n")
      .filter((l) => /^\|\s*\d+\.\d+/.test(l))
      .map((l) => (l.match(/\|\s*\[([ x~!])\]\s*\|/) || [, " "])[1]);
  } catch (e) {
    console.warn(`roadmap unavailable: ${e.message}`);
  }

  return { repos: repos.slice(0, 6), count: repos.length, totals, days, roadmap };
}

// ---------------------------------------------------------------- hero

function renderHero() {
  const W = 1000, H = 450;
  // spotlight: source below the bottom-right corner, disc of light in the sky
  const S = [960, 480], E = [688, 128], RX = 116, RY = 64, TILT = -14;
  const beam = `M935 480L612 190L764 66L985 480Z`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Nicolas Pascoal, junior software developer. A spotlight projects the NP monogram onto the night sky.">
<style>
${FONTS}
${BASE_CSS}
.name{font:700 50px Wide;fill:${C.text};letter-spacing:12px}
.role{font:400 13.5px Mono;fill:${C.silver};letter-spacing:.4px}
.mono{font:700 60px Wide;fill:#070707;letter-spacing:6px}
.signal{animation:power 1.8s linear .3s both}
@keyframes power{0%{opacity:0}8%{opacity:.7}12%{opacity:.05}20%{opacity:.9}26%{opacity:.25}38%{opacity:1}100%{opacity:1}}
.sway{transform-box:view-box;transform-origin:${S[0]}px ${S[1]}px;animation:sway 11s ease-in-out 2.2s infinite alternate}
@keyframes sway{from{transform:rotate(0deg)}to{transform:rotate(-2.2deg)}}
.drift{animation:drift 40s ease-in-out infinite alternate}
@keyframes drift{to{transform:translateX(-60px)}}
.rise{animation:rise 1.1s cubic-bezier(.2,.8,.2,1) both}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
</style>
<defs>
  <radialGradient id="sky" cx="68%" cy="20%" r="75%"><stop offset="0" stop-color="#0E0E10"/><stop offset=".55" stop-color="#050506"/><stop offset="1" stop-color="${C.void}"/></radialGradient>
  <linearGradient id="beam" gradientUnits="userSpaceOnUse" x1="${S[0]}" y1="${S[1]}" x2="${E[0]}" y2="${E[1]}">
    <stop offset="0" stop-color="${C.signal}" stop-opacity=".26"/><stop offset=".7" stop-color="${C.signal}" stop-opacity=".07"/><stop offset="1" stop-color="${C.signal}" stop-opacity=".12"/>
  </linearGradient>
  <radialGradient id="disc"><stop offset="0" stop-color="#FFE48A"/><stop offset=".62" stop-color="${C.signal}"/><stop offset=".9" stop-color="#C79B22"/><stop offset="1" stop-color="#C79B22" stop-opacity="0"/></radialGradient>
  <radialGradient id="halo"><stop offset="0" stop-color="${C.signal}" stop-opacity=".22"/><stop offset="1" stop-color="${C.signal}" stop-opacity="0"/></radialGradient>
  <filter id="clouds" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".0045 .011" numOctaves="4" seed="7"/>
    <feColorMatrix values="0 0 0 0 .96  0 0 0 0 .78  0 0 0 0 .26  0 0 0 1.5 -.62"/>
  </filter>
  <radialGradient id="maskfade"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".55" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <filter id="blur"><feGaussianBlur stdDeviation="6"/></filter>
  <mask id="lit"><path d="${beam}" fill="#fff" filter="url(#blur)"/><ellipse cx="${E[0]}" cy="${E[1]}" rx="${RX * 1.9}" ry="${RY * 2.2}" transform="rotate(${TILT} ${E[0]} ${E[1]})" fill="url(#maskfade)"/></mask>
</defs>
<rect width="${W}" height="${H}" rx="16" fill="url(#sky)"/>

<g class="signal"><g class="sway">
  <path d="${beam}" fill="url(#beam)"/>
  <g mask="url(#lit)"><rect x="0" y="0" width="${W + 80}" height="${H}" filter="url(#clouds)" class="drift" opacity=".55"/></g>
  <ellipse cx="${E[0]}" cy="${E[1]}" rx="${RX * 2}" ry="${RY * 2.3}" transform="rotate(${TILT} ${E[0]} ${E[1]})" fill="url(#halo)"/>
  <ellipse cx="${E[0]}" cy="${E[1]}" rx="${RX}" ry="${RY}" transform="rotate(${TILT} ${E[0]} ${E[1]})" fill="url(#disc)"/>
  <text x="${E[0] + 4}" y="${E[1] + 21}" class="mono" text-anchor="middle" transform="rotate(${TILT} ${E[0]} ${E[1]})">NP</text>
</g></g>

<text x="44" y="52" class="lbl">SANTOS · BRAZIL</text>
<g class="rise" style="animation-delay:.9s">
  <text x="40" y="318" class="name">NICOLAS</text>
  <text x="40" y="376" class="name">PASCOAL</text>
</g>
<text x="44" y="414" class="role rise" style="animation-delay:1.2s">junior software developer  —  c# / .net  ·  python  ·  sql</text>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" fill="none" stroke="${C.line}"/>
</svg>
`;
}

// ---------------------------------------------------------------- dashboard

function ago(iso, now) {
  const days = Math.max(0, Math.floor((now - new Date(iso)) / 864e5));
  if (days === 0) return "today";
  if (days < 60) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

function repoStatus(iso, now) {
  const days = (now - new Date(iso)) / 864e5;
  if (days <= 3) return { text: "active", color: C.signal, pulse: true };
  if (days <= 30) return { text: "stable", color: C.silver };
  return { text: "idle", color: C.steel };
}

function renderDashboard({ repos, count, totals, days, roadmap }, now) {
  const W = 1000, X0 = 40, X1 = W - 40;
  const out = [];
  const section = (y, title, right = "") =>
    `<text x="${X0}" y="${y}" class="lbl">${esc(title)}</text>` +
    (right ? `<text x="${X1}" y="${y}" class="sm" text-anchor="end">${esc(right)}</text>` : "");
  const rule = (y) => `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${C.line}"/>`;

  // --- career
  {
    const top = 0, { d, m, y } = parts(now);
    out.push(section(top + 50, "CAREER", `${d} ${m} ${y}`));
    const t0 = ym("2021-01"), t1 = ym("2028-01");
    const sx = (t) => X0 + ((t - t0) / (t1 - t0)) * (X1 - X0);
    const axisY = top + 262;
    for (let yr = 2021; yr <= 2027; yr++) {
      const gx = sx(ym(`${yr}-01`));
      out.push(`<line x1="${f1(gx)}" y1="${top + 74}" x2="${f1(gx)}" y2="${axisY - 14}" stroke="${C.grid}"/>`);
      out.push(`<text x="${f1(gx)}" y="${axisY}" class="sm" style="fill:${C.dim}">${yr}</text>`);
    }
    CAREER.forEach((job, i) => {
      const ry = top + 92 + i * 32;
      const a = sx(ym(job.from)), b = sx(job.to ? ym(job.to) : now);
      const color = job.live ? C.signal : job.plan ? C.steel : C.silver;
      const delay = (0.3 + i * 0.12).toFixed(2);
      out.push(`<rect x="${f1(a)}" y="${ry + 10}" width="${f1(Math.max(3, b - a))}" height="3" rx="1.5" fill="${color}" class="bar" style="animation-delay:${delay}s"/>`);
      if (job.plan) {
        out.push(`<line x1="${f1(b + 6)}" y1="${ry + 11.5}" x2="${f1(sx(ym(job.plan)))}" y2="${ry + 11.5}" stroke="${C.dim}" stroke-dasharray="1 6" stroke-linecap="round" stroke-width="2" class="job" style="animation-delay:${delay}s"/>`);
      }
      if (job.live) out.push(`<circle cx="${f1(b)}" cy="${ry + 11.5}" r="4" fill="${C.signal}"/><circle cx="${f1(b)}" cy="${ry + 11.5}" r="10" fill="${C.signal}" opacity=".18" class="pulse"/>`);
      const late = a > X0 + (X1 - X0) * 0.55;
      out.push(`<text x="${f1(late ? b - (job.live ? 16 : 0) : a)}" y="${ry + 2}" text-anchor="${late ? "end" : "start"}" class="job" style="animation-delay:${delay}s"><tspan class="org" style="fill:${job.live ? C.signal : C.text}">${esc(job.org)}</tspan>   ${esc(job.role)}</text>`);
    });
    const nx = sx(now);
    out.push(`<line x1="${f1(nx)}" y1="${top + 74}" x2="${f1(nx)}" y2="${axisY - 14}" stroke="${C.signal}" stroke-dasharray="2 4" opacity=".45"/>`);
  }
  out.push(rule(292));

  // --- repositories | gabaro
  const y2 = 292, h2 = 280, MID = W / 2;
  out.push(`<line x1="${MID}" y1="${y2}" x2="${MID}" y2="${y2 + h2}" stroke="${C.line}"/>`);
  {
    const R = MID - 40;
    out.push(`<text x="${X0}" y="${y2 + 50}" class="lbl">REPOSITORIES</text><text x="${R}" y="${y2 + 50}" class="sm" text-anchor="end">${count} public</text>`);
    repos.forEach((r, i) => {
      const ry = y2 + 96 + i * 30;
      const st = repoStatus(r.pushed_at, now);
      const name = r.name.length > 28 ? `${r.name.slice(0, 27)}…` : r.name;
      out.push(`<g class="row" style="animation-delay:${(0.6 + i * 0.08).toFixed(2)}s">
<circle cx="${X0 + 3}" cy="${ry - 4}" r="3" fill="${st.color}"${st.pulse ? ' class="pulse"' : ""}/>
<text x="${X0 + 16}" y="${ry}" class="cell" style="fill:${st.color}">${st.text}</text>
<text x="${X0 + 92}" y="${ry}" class="cell strong">${esc(name)}</text>
<text x="${R}" y="${ry}" class="cell" text-anchor="end">${ago(r.pushed_at, now)}</text>
</g>`);
    });
  }
  {
    const L = MID + 40, R = X1;
    out.push(`<text x="${L}" y="${y2 + 50}" class="lbl">GABARO · SAAS ROADMAP</text><text x="${R}" y="${y2 + 50}" class="sm" text-anchor="end">STATUS.md</text>`);
    if (roadmap?.length) {
      const done = roadmap.filter((s) => s === "x").length;
      out.push(`<text x="${L - 2}" y="${y2 + 118}" class="big">${done}<tspan class="big-dim">/${roadmap.length}</tspan></text>`);
      out.push(`<text x="${L}" y="${y2 + 144}" class="sm">roadmap tasks shipped toward multi-tenant saas</text>`);
      const per = 17, bw = (R - L - (per - 1) * 4) / per;
      roadmap.forEach((s, i) => {
        const bx = L + (i % per) * (bw + 4), by = y2 + 166 + Math.floor(i / per) * 18;
        const style = {
          x: `fill="${C.text}"`,
          "~": `fill="none" stroke="${C.signal}" stroke-width="1.2"`,
          "!": `fill="none" stroke="${C.steel}" stroke-dasharray="2 2"`,
          " ": `fill="${C.off}"`,
        }[s];
        out.push(`<rect x="${f1(bx)}" y="${by}" width="${f1(bw)}" height="11" rx="1.5" ${style} class="${s === "~" ? "blk pulse" : "blk"}" style="animation-delay:${(0.8 + i * 0.025).toFixed(3)}s"/>`);
      });
      let kx = L;
      const ky = y2 + 226;
      for (const [style, label] of [[`fill="${C.text}"`, "done"], [`fill="none" stroke="${C.signal}"`, "in progress"], [`fill="none" stroke="${C.steel}" stroke-dasharray="2 2"`, "blocked"], [`fill="${C.off}"`, "queued"]]) {
        out.push(`<rect x="${kx}" y="${ky - 8}" width="9" height="9" rx="1" ${style}/><text x="${kx + 15}" y="${ky}" class="sm">${label}</text>`);
        kx += 15 + label.length * 6.7 + 16;
      }
      out.push(`<text x="${L}" y="${y2 + h2 - 26}" class="sm" style="fill:${C.silver}">live in production with a real client · 50 tests · ci/cd</text>`);
    }
  }
  out.push(rule(y2 + h2));

  // --- activity: commit heartbeat line
  const y3 = y2 + h2, h3 = 170;
  {
    out.push(section(y3 + 50, "ACTIVITY · 12 MONTHS", "each spike is a day with commits"));
    const BASE = y3 + 124;
    const max = Math.max(1, ...days.map((x) => x.n));
    const step = (X1 - X0) / (days.length - 1);
    let path = `M${X0} ${BASE}`;
    days.forEach((day, i) => {
      if (!day.n) return;
      const x = X0 + i * step, a = 10 + 40 * Math.sqrt(day.n / max);
      path += `L${f1(x - 3)} ${BASE}L${f1(x - 1.5)} ${f1(BASE + a * 0.16)}L${f1(x)} ${f1(BASE - a)}L${f1(x + 1.6)} ${f1(BASE + a * 0.3)}L${f1(x + 3.2)} ${BASE}`;
    });
    path += `L${X1} ${BASE}`;
    out.push(`<path d="${path}" pathLength="1" class="ecg" fill="none" stroke="#fff" stroke-width="4" opacity=".08" filter="url(#soft)"/>`);
    out.push(`<path d="${path}" pathLength="1" class="ecg" fill="none" stroke="url(#fade)" stroke-width="1.3" stroke-linejoin="round"/>`);
    out.push(`<circle r="3" fill="${C.signal}" class="scan" filter="url(#glow)"/>`);
    out.push(`<style>.scan{offset-path:path("${path}");offset-rotate:0deg;opacity:0;animation:scan 8s linear 3.6s infinite}</style>`);
    days.forEach((day, i) => {
      if (day.date.endsWith("-01")) out.push(`<text x="${f1(X0 + i * step)}" y="${BASE + 30}" class="sm" style="fill:${C.dim}">${MESES[Number(day.date.slice(5, 7)) - 1]}</text>`);
    });
  }
  out.push(rule(y3 + h3));

  // --- stack
  const y4 = y3 + h3, h4 = 120;
  {
    out.push(section(y4 + 50, "STACK ACROSS PUBLIC REPOS", "by bytes of code"));
    const sum = Object.values(totals).reduce((a, b) => a + b, 0);
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const shown = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((a, [, b]) => a + b, 0);
    if (rest) shown.push(["other", rest]);
    let bx = X0, lx = X0;
    const span = X1 - X0 - (shown.length - 1) * 2;
    shown.forEach(([lang, bytes], i) => {
      const bw = (bytes / sum) * span;
      out.push(`<rect x="${f1(bx)}" y="${y4 + 68}" width="${f1(bw)}" height="4" fill="${GREYS[i]}" class="bar" style="animation-delay:${(1.2 + i * 0.08).toFixed(2)}s"/>`);
      bx += bw + 2;
      const label = `${lang.toLowerCase()} ${Math.round((bytes / sum) * 100)}%`;
      out.push(`<rect x="${f1(lx)}" y="${y4 + 89}" width="7" height="7" fill="${GREYS[i]}"/><text x="${f1(lx + 14)}" y="${y4 + 96}" class="sm" style="fill:${C.silver}">${esc(label)}</text>`);
      lx += 14 + label.length * 6.7 + 26;
    });
  }

  const H = y4 + h4;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Live dashboard: career timeline, most recently pushed repositories, Gabaro roadmap progress, GitHub activity and most used languages.">
<style>
${FONTS}
${BASE_CSS}
.job{font:400 12px Mono;fill:${C.steel};animation:in .6s ease both}
.org{font-weight:600}
.cell{font:400 13px Mono;fill:${C.steel}}
.strong{fill:${C.text}}
.big{font:700 44px Wide;fill:${C.text};letter-spacing:2px}
.big-dim{fill:${C.dim}}
.bar{transform-box:fill-box;transform-origin:0 50%;animation:grow 1s cubic-bezier(.2,.8,.2,1) both}
@keyframes grow{from{transform:scaleX(0)}to{transform:none}}
.row{animation:in .5s ease both}
.blk{animation:in .3s ease both}
.blk.pulse{animation:in .3s ease both,pulse 2.4s ease-in-out 1.5s infinite}
.ecg{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 2.6s cubic-bezier(.4,0,.2,1) 1s forwards}
@keyframes draw{to{stroke-dashoffset:0}}
@keyframes scan{0%{offset-distance:0%;opacity:0}3%{opacity:1}97%{opacity:1}100%{offset-distance:100%;opacity:0}}
@media (prefers-reduced-motion:reduce){.ecg{stroke-dashoffset:0}}
</style>
<defs>
  <filter id="glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="soft" x="-5%" y="-50%" width="110%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
  <linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="${C.text}" stop-opacity=".15"/><stop offset=".7" stop-color="${C.text}" stop-opacity=".6"/><stop offset="1" stop-color="${C.text}"/></linearGradient>
</defs>
<rect width="${W}" height="${H}" rx="16" fill="${C.card}"/>
${out.join("\n")}
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" fill="none" stroke="${C.line}"/>
</svg>
`;
}

// ---------------------------------------------------------------- main

const now = today();
const data = await loadData();
write("assets/hero.svg", renderHero());
write("assets/dashboard.svg", renderDashboard(data, now));
