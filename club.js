// Настройки клуба для остального кода: значения из club.config.js поверх нейтральных значений по умолчанию.
// Название и данные конкретного клуба живут только в club.config.js и data.js; здесь клуба нет.
// Файл подключается сразу после club.config.js; к DOM обращается только при вызове applyClubIdentity().
const CLUB_NEUTRAL = {
  name: "Хоккейный клуб", nameGenitive: "хоккейного клуба", fullName: "Хоккейный клуб", shortName: "Клуб",
  appTitle: "Хоккейный клуб — Command Center", subtitle: "ПУНКТ УПРАВЛЕНИЯ ХОККЕЙНЫМ КЛУБОМ",
  description: "Командный центр хоккейного клуба: арена, секторы, расписание, календарь.", manifestName: "Хоккейный клуб — Командный центр",
  arenaAlt: "Хоккейная арена с LED-табло восьми секторов",
  storageKey: "hockey-club-command-center-v1", backupApp: "hockey-club-command-center", filePrefix: "club", icsProduct: "Hockey Club", icsDomain: "hockey-club",
  color: "#2f6fdd",
  groups: [{ id: "Основная", name: "Основная группа" }], defaultGroup: "Основная", mainCoaches: null,
  logo: "assets/logo.png",
  arena: { mode: "simple" },
  server: { mode: "local" },
  timezone: { id: "Europe/Moscow", offset: "+0300", abbr: "MSK" },
  phrases: { announceOutro: "Ждём вас на трибунах!" }
};
function buildClub(cfg) {
  const c = cfg && typeof cfg === "object" ? cfg : {}, out = { ...CLUB_NEUTRAL, ...c };
  out.timezone = { ...CLUB_NEUTRAL.timezone, ...(c.timezone || {}) };
  out.phrases = { ...CLUB_NEUTRAL.phrases, ...(c.phrases || {}) };
  out.server = { mode: "local" };   // серверный режим появится позже; сейчас любое значение равно "local"
  out.arena = { mode: c.arena && c.arena.mode === "photo" ? "photo" : "simple" };
  // Группы приводятся к виду { id, name, target|null }; цель — только положительное целое.
  out.groups = (Array.isArray(c.groups) ? c.groups : CLUB_NEUTRAL.groups).filter(g => g && g.id !== undefined && g.id !== "").map(g => ({ id: String(g.id), name: g.name ? String(g.name) : String(g.id), target: Number.isInteger(g.target) && g.target > 0 ? g.target : null }));
  out.defaultGroup = typeof c.defaultGroup === "string" ? c.defaultGroup : CLUB_NEUTRAL.defaultGroup;
  out.mainCoaches = Number.isInteger(c.mainCoaches) && c.mainCoaches > 0 ? c.mainCoaches : null;
  return out;
}
// Проверка файла настроек: список понятных замечаний (пустой — всё в порядке). Используется тестами и скриптом `npm run club`.
function clubProblems(cfg) {
  const c = cfg && typeof cfg === "object" ? cfg : null, p = [];
  if (!c) return ["club.config.js не задаёт CLUB_CONFIG"];
  for (const k of ["name", "nameGenitive", "fullName", "shortName", "appTitle", "subtitle", "description", "manifestName", "arenaAlt", "storageKey", "backupApp", "filePrefix", "icsProduct", "icsDomain", "logo"]) if (typeof c[k] !== "string" || !c[k].trim()) p.push("не задано: " + k);
  if (typeof c.shortName === "string" && c.shortName.length > 20) p.push("shortName длиннее 20 символов: на экране телефона подпись обрежется");
  if (typeof c.storageKey === "string" && !/^[A-Za-z0-9_-]+$/.test(c.storageKey)) p.push("storageKey: только латиница, цифры, «-» и «_»");
  if (typeof c.icsDomain === "string" && !/^[A-Za-z0-9.-]+$/.test(c.icsDomain)) p.push("icsDomain: только латиница, цифры, «-» и «.»");
  if (typeof c.filePrefix === "string" && !/^[A-Za-z0-9_-]+$/.test(c.filePrefix)) p.push("filePrefix: только латиница, цифры, «-» и «_»");
  if (typeof c.logo === "string" && !/\.(png|svg|jpe?g|webp)$/i.test(c.logo)) p.push("logo: нужен файл png, svg, jpg или webp");
  if (typeof c.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(c.color)) p.push("color: нужен цвет в формате #rrggbb");
  else { if (contrast(c.color, "#ffffff") < 3) p.push("color: слишком светлый — текст этого цвета на белом фоне будет плохо виден"); }
  if (!Array.isArray(c.groups) || !c.groups.length) p.push("groups: нужна хотя бы одна группа");
  else {
    const ids = c.groups.map(g => g && g.id);
    if (ids.some(i => typeof i !== "string" || !i.trim() || /[|]/.test(i))) p.push("groups: у каждой группы нужен id (непустой текст без знака «|»)");
    else if (new Set(ids).size !== ids.length) p.push("groups: id групп не должны повторяться");
    if (c.groups.some(g => g && g.target !== undefined && g.target !== null && !(Number.isInteger(g.target) && g.target > 0))) p.push("groups: target — положительное целое число или не указывать");
    if (typeof c.defaultGroup === "string" && c.defaultGroup && !ids.includes(c.defaultGroup)) p.push("defaultGroup: такой группы нет в groups");
  }
  if (c.mainCoaches !== undefined && c.mainCoaches !== null && !(Number.isInteger(c.mainCoaches) && c.mainCoaches > 0)) p.push("mainCoaches: положительное целое число или null");
  const tz = c.timezone || {};
  if (typeof tz.id !== "string" || !tz.id) p.push("не задано: timezone.id");
  if (typeof tz.offset !== "string" || !/^[+-]\d{4}$/.test(tz.offset)) p.push("timezone.offset: формат +0300");
  if (typeof tz.abbr !== "string" || !tz.abbr) p.push("не задано: timezone.abbr");
  if (c.server && c.server.mode !== undefined && c.server.mode !== "local") p.push("server.mode: серверный режим пока не реализован, допустимо только \"local\"");
  if (c.arena && c.arena.mode !== "photo" && c.arena.mode !== "simple") p.push("arena.mode: допустимо \"photo\" или \"simple\"");
  if (!c.phrases || typeof c.phrases.announceOutro !== "string") p.push("не задано: phrases.announceOutro");
  return p;
}
// ---------- фирменный цвет ----------
// В styles.css все оттенки красного заменены переменными. Их значения по умолчанию = цвета клуба из поставки (BRAND_TOKENS).
// Для другого цвета оттенки выводятся из него: сохраняются тон-сдвиг, насыщенность и разница по светлоте относительно основного цвета поставки.
const BRAND_DEFAULT = "#e31d32";
const BRAND_TOKENS = {
  "--red": "#e31d32", "--red-bright": "#ff3b4d", "--red-neon": "#ef2e42", "--red-hot": "#ff3048", "--red-glow": "#f14454", "--red-spark": "#ff2a42", "--red-link": "#ff5566", "--red-light": "#ff6474", "--red-soft": "#ff5a6c",
  "--red-alt1": "#f33347", "--red-alt2": "#e9273b", "--red-alt3": "#ff3a50", "--red-print": "#c81e32", "--red-pale": "#fdeef0", "--red-tint": "#ffd4d9", "--red-deep": "#5d1a23",
  "--red-rgb": "227,29,50", "--red-bright-rgb": "255,59,77", "--red-glow-rgb": "244,27,49", "--red-hot-rgb": "255,40,60", "--red-dark-rgb": "214,38,54", "--red-spark-rgb": "255,42,66"
};
// Роль оттенка: pale — светлая заливка, deep — тёмный текст, остальные — акценты (на тёмном фоне не темнее светлоты 45).
const BRAND_ROLE = { "--red-pale": "pale", "--red-tint": "pale", "--red-deep": "deep", "--red-print": "mid", "--red": "main", "--red-rgb": "main" };
function hexToRgb(h) { h = h.replace("#", ""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
function rgbToHex(r) { return "#" + r.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join(""); }
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2; let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, d ? d / (1 - Math.abs(2 * l - 1)) * 100 : 0, l * 100];
}
function hslToRgb([h, s, l]) {
  s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
function luminance(hex) { return hexToRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); }
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Полный набор оттенков для основного цвета. Для цвета поставки возвращает прежние значения без пересчёта.
function brandTokens(hex) {
  const main = String(hex || "").toLowerCase();
  if (main === BRAND_DEFAULT || !/^#[0-9a-f]{6}$/.test(main)) return { ...BRAND_TOKENS };
  const src = rgbToHsl(hexToRgb(BRAND_DEFAULT)), dst = rgbToHsl(hexToRgb(main)), out = {};
  const sRatio = src[1] ? dst[1] / src[1] : 1;
  for (const [name, val] of Object.entries(BRAND_TOKENS)) {
    const role = BRAND_ROLE[name] || "accent", isRgb = name.endsWith("-rgb");
    if (role === "main") { out[name] = isRgb ? hexToRgb(main).join(",") : main; continue; }
    const [h, s, l] = rgbToHsl(isRgb ? val.split(",").map(Number) : hexToRgb(val));
    const H = (h + dst[0] - src[0] + 360) % 360, S = dst[1] === 0 ? 0 : clampN(s * sRatio, 0, 100);
    let L = role === "pale" || role === "deep" ? l : clampN(l + (dst[2] - src[2]), 6, 96);
    if (role === "accent") L = Math.max(L, 45);
    const rgb = hslToRgb([H, S, L]); out[name] = isRgb ? rgb.map(v => Math.round(v)).join(",") : rgbToHex(rgb);
  }
  return out;
}
// Применяет цвет клуба к странице. У цвета поставки ничего не делает (значения уже в styles.css) — страница остаётся прежней.
function applyClubTheme() {
  if (typeof document === "undefined" || !document.documentElement || String(CLUB.color).toLowerCase() === BRAND_DEFAULT) return;
  for (const [k, v] of Object.entries(brandTokens(CLUB.color))) document.documentElement.style.setProperty(k, v);
}

const CLUB = buildClub(globalThis.CLUB_CONFIG);
applyClubTheme();
if (typeof console !== "undefined") { const problems = clubProblems(globalThis.CLUB_CONFIG); if (problems.length) console.warn("club.config.js: " + problems.join("; ")); }

// Подставляет название и логотип в готовую страницу (в index.html остаются значения для клуба из поставки, поэтому для него страница не меняется).
function applyClubIdentity() {
  const $ = s => document.querySelector(s), setAttr = (s, a, v) => { const e = $(s); if (e) e.setAttribute(a, v); };
  document.title = CLUB.appTitle;
  setAttr("meta[name=apple-mobile-web-app-title]", "content", CLUB.shortName);
  setAttr(".brand", "aria-label", CLUB.name + " — главная");
  const label = $(".brand > span:last-child");
  if (label && label.firstChild && label.firstChild.nodeType === 3) label.firstChild.nodeValue = CLUB.name.toUpperCase() + " ";
  const sub = $(".brand em"); if (sub) sub.textContent = CLUB.subtitle;
  for (const s of [".brand-mark img", ".ice-mark img"]) { setAttr(s, "src", CLUB.logo); }
  setAttr(".brand-mark img", "alt", "Логотип " + CLUB.name);
  setAttr(".arena-bg", "alt", CLUB.arenaAlt);
  const h = $("#login-dialog h2"); if (h) h.textContent = CLUB.name;
  if (CLUB.arena.mode === "simple") applySimpleArena();
}
// Упрощённый режим арены: вместо фотографии — шапка с логотипом, названием и двумя индексами; плитки секторов показываются на любом экране.
function applySimpleArena() {
  const photo = document.querySelector(".arena-photo"); if (!photo || document.querySelector(".simple-hero")) return;
  document.body.dataset.arena = "simple";
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  const kpi = (id, name) => '<div class="sh-kpi" id="' + id + '"><i class="sh-ring"><b>0%</b></i><span>' + name + "</span></div>";
  photo.insertAdjacentHTML("beforebegin", '<section class="simple-hero" aria-label="Итоги сезона"><img src="' + esc(CLUB.logo) + '" alt=""><div class="sh-name"><h1>' + esc(CLUB.name) + '</h1><p id="sh-season"></p></div><div class="sh-kpis">' + kpi("sh-mission", "ВЫПОЛНЕНИЕ МИССИЙ") + kpi("sh-dev", "ИНДЕКС РАЗВИТИЯ") + "</div></section>");
}
function renderSimpleHero(m) {
  const set = (id, v) => { const e = document.querySelector("#" + id + " .sh-ring"); if (e) { e.style.setProperty("--p", v + "%"); e.firstChild.textContent = v + "%"; } };
  set("sh-mission", m.completion); set("sh-dev", m.development);
  const s = document.querySelector("#sh-season"); if (s) s.textContent = "СЕЗОН " + currentSeason.replace("-", "–");
}
