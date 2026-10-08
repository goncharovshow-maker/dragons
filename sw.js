// Сервис-воркер: приложение открывается без сети. Данные клуба хранятся в браузере (localStorage), воркер их не трогает.
// Стратегия: «сначала сеть, при ошибке — кэш», поэтому при наличии интернета всегда подгружается свежая версия файлов.
// Список PRECACHE проверяется автотестом: в нём должны быть все файлы из index.html.
const VERSION = "1";
const CACHE = "rt-command-center-" + VERSION;
const PRECACHE = [
  "./", "index.html", "styles.css", "manifest.webmanifest",
  "club.config.js", "club.js", "data.js", "core.js", "access.js", "calendar.js", "dashboard.js", "competitions.js", "media.js", "funnel.js", "assess.js", "partners.js", "program.js",
  "report.js", "ui.js", "players.js", "trainers.js", "parents.js", "schedule.js", "payments.js", "matches.js", "mobile.js", "pwa.js", "backup.js", "main.js", "demo.js",
  "assets/logo.png", "assets/arena-bg-clean.jpg",
  "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-maskable-512.png", "assets/icons/apple-touch-icon.png"
];
const FONT_HOST = /(^|\.)(googleapis|gstatic)\.com$/;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("rt-command-center-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url), same = url.origin === self.location.origin, font = FONT_HOST.test(url.hostname);
  if (!same && !font) return;
  if (font) {   // шрифты: из кэша сразу, в фоне обновляем
    e.respondWith(caches.open(CACHE).then(cache => cache.match(req).then(hit => { const net = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; }).catch(() => hit); return hit || net; })));
    return;
  }
  e.respondWith(fetch(req, { cache: "no-cache" }).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
    .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === "navigate" ? caches.match("index.html", { ignoreSearch: true }) : Response.error()))));
});
