// Генератор файлов клуба: читает club.config.js и обновляет то, что браузер не может подставить сам, —
// манифест приложения, список файлов для работы без сети (sw.js), статичную часть index.html и иконки из логотипа.
//   npm run club                 — обновить файлы
//   npm run club -- --check      — только проверить, что файлы соответствуют настройкам (ничего не меняет; код возврата 1 при расхождении)
//   npm run club -- --dir ПАПКА  — работать с другой папкой проекта (по умолчанию — корень проекта)
// Данные клуба (data.js) и картинки генератор не меняет, кроме папки assets/icons/.
"use strict";
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { makeIcons } = require("./icons");

const args = process.argv.slice(2), CHECK = args.includes("--check"), di = args.indexOf("--dir");
const ROOT = path.resolve(di >= 0 ? args[di + 1] : path.join(__dirname, ".."));
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function loadClub() {
  const ctx = { console: { warn() {}, log() {} } }; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(read("club.config.js"), ctx, { filename: "club.config.js" });
  vm.runInContext(read("club.js") + "\n;this.__r = { CLUB, clubProblems, cfg: globalThis.CLUB_CONFIG };", ctx, { filename: "club.js" });
  return ctx.__r;
}

function manifestText(club, old) {
  // Меняются только три поля; остальное (иконки, цвета, форматирование) остаётся как в файле.
  let t = old;
  for (const [k, v] of [["name", club.manifestName], ["short_name", club.shortName], ["description", club.description]]) {
    const re = new RegExp('^(  "' + k + '": )"[^\\n]*",$', "m");
    if (!re.test(t)) throw new Error("manifest.webmanifest: нет поля " + k);
    t = t.replace(re, (_, p) => p + JSON.stringify(v) + ",");
  }
  return t;
}

function indexText(club, html) {
  const photo = club.arena.mode === "photo", n = esc(club.name);
  const rep = (re, to, what) => { if (!re.test(html)) throw new Error("index.html: не найдено место для подстановки — " + what); html = html.replace(re, (...m) => to.replace(/\$(\d)/g, (_, i) => m[i])); };
  rep(/<title>[^<]*<\/title>/, "<title>" + esc(club.appTitle) + "</title>", "заголовок страницы");
  rep(/(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/, "$1" + esc(club.shortName) + "$2", "название под значком");
  rep(/<a class="brand"[^\n]*<\/a>/, '<a class="brand" href="#" aria-label="' + n + ' — главная"><span class="brand-mark"><img src="' + esc(club.logo) + '" alt="Логотип ' + n + '" /></span><span>' + esc(club.name.toUpperCase()) + " <em>" + esc(club.subtitle) + "</em></span></a>", "шапка с логотипом");
  rep(/(<div class="ice-mark"[^>]*><i class="ice-circle"><\/i><img src=")[^"]*(")/, "$1" + esc(club.logo) + "$2", "логотип на льду");
  rep(/(<h2>)[^<]*(<\/h2><form id="login-form">)/, "$1" + n + "$2", "заголовок окна входа");
  // Фотография арены нужна только в режиме «photo»; в упрощённом режиме файл не требуется.
  rep(/(<div class="arena-photo">\n)(\s*<img class="arena-bg"[^\n]*\n)?/, "$1" + (photo ? '          <img class="arena-bg" src="assets/arena-bg-clean.jpg" alt="' + esc(club.arenaAlt) + '" />\n' : ""), "фотография арены");
  return html;
}

function swText(club, sw, html) {
  const scripts = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]);
  const list = ["./", "index.html", "styles.css", "manifest.webmanifest", ...scripts, club.logo, ...(club.arena.mode === "photo" ? ["assets/arena-bg-clean.jpg"] : []),
    "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-maskable-512.png", "assets/icons/apple-touch-icon.png"];
  const q = a => a.map(x => JSON.stringify(x)).join(", ");
  const body = "const PRECACHE = [\n  " + q(list.slice(0, 4)) + ",\n  " + q(scripts.slice(0, Math.ceil(scripts.length / 2))) + ",\n  " + q(scripts.slice(Math.ceil(scripts.length / 2))) + ",\n  "
    + q(list.slice(4 + scripts.length, 4 + scripts.length + 1 + (club.arena.mode === "photo" ? 1 : 0))) + ",\n  " + q(list.slice(-4)) + "\n];";
  if (!/const PRECACHE = \[[\s\S]*?\n\];/.test(sw)) throw new Error("sw.js: не найден список PRECACHE");
  return sw.replace(/const PRECACHE = \[[\s\S]*?\n\];/, () => body);
}

const { CLUB, clubProblems, cfg } = loadClub(), problems = clubProblems(cfg);
if (problems.length) { console.error("В club.config.js есть замечания:\n - " + problems.join("\n - ")); process.exit(1); }
const need = [CLUB.logo, ...(CLUB.arena.mode === "photo" ? ["assets/arena-bg-clean.jpg"] : [])].filter(f => !fs.existsSync(path.join(ROOT, f)));
if (need.length) { console.error("Нет файлов с картинками: " + need.join(", ")); process.exit(1); }

const html0 = read("index.html"), html = indexText(CLUB, html0);
const out = { "index.html": html, "manifest.webmanifest": manifestText(CLUB, read("manifest.webmanifest")), "sw.js": swText(CLUB, read("sw.js"), html) };
const diff = Object.keys(out).filter(f => out[f] !== read(f));
if (CHECK) {
  const icons = ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"].filter(n => !fs.existsSync(path.join(ROOT, "assets", "icons", n)));
  if (diff.length || icons.length) { console.error("Не соответствуют club.config.js: " + [...diff, ...icons.map(n => "assets/icons/" + n)].join(", ") + ". Выполните: npm run club"); process.exit(1); }
  console.log("Файлы соответствуют club.config.js."); process.exit(0);
}
for (const f of diff) { fs.writeFileSync(path.join(ROOT, f), out[f]); console.log("обновлён " + f); }
const icons = makeIcons(path.join(ROOT, CLUB.logo), path.join(ROOT, "assets", "icons")); console.log("иконки из " + CLUB.logo + ": " + icons.join(", "));
if (!diff.length) console.log("index.html, manifest.webmanifest и sw.js уже соответствуют настройкам.");
