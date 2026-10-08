// Сектор «Медиа»: контент-план. Записи создаёт пользователь вручную, хранятся по сезонам (season().content).
// Ничего не публикуется и ни с чем не интегрируется: «черновик анонса» — это только запись в плане.
// Файл подключается до app.js; к данным приложения обращается только при вызове.
const CHANNELS = ["Instagram", "ВКонтакте", "Telegram"];
const CHANNEL_LABEL = { Instagram: "Instagram", "ВКонтакте": "ВКонтакте", Telegram: "Telegram (планируется)" };
const CONTENT_STATUSES = ["идея", "готово", "опубликовано"];
const POSTS_PER_WEEK = 2; // ориентир из ТЗ: около 2 публикаций в неделю
let mediaWeek = "";        // понедельник выбранной недели, ГГГГ-ММ-ДД

function contentList() { const d = season(); return d.content || (d.content = []); }
function mondayOf(s) { const d = new Date(s + "T00:00"); d.setDate(d.getDate() - ((d.getDay() || 7) - 1)); return dateStr(d); }
function shortDate(s) { return new Date(s + "T00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" }); }
function normalizeMedia(d) {
  const ids = new Set((d.matches || []).map(m => m.id)), str = v => typeof v === "string" ? v : "";
  d.content = (Array.isArray(d.content) ? d.content : []).filter(c => c && typeof c.title === "string" && c.title.trim() && DATE_RE.test(c.date)).map(c => ({
    id: cleanId(c.id), date: c.date, channel: CHANNELS.includes(c.channel) ? c.channel : CHANNELS[0], title: c.title.trim(), status: CONTENT_STATUSES.includes(c.status) ? c.status : CONTENT_STATUSES[0], notes: str(c.notes), matchId: ids.has(c.matchId) ? c.matchId : ""
  }));
}
function dropMatchRefs(m) { if (m && m.id) contentList().forEach(c => { if (c.matchId === m.id) c.matchId = ""; }); }
function matchLabel(m) { return date(m.date) + " · " + m.opponent; }

// ---------- черновик анонса ----------
function announceText(m) {
  const t = matchTournamentName(m), lines = ["Анонс матча", CLUB.name + ((m.team || CLUB.defaultGroup) ? " (" + (m.team || CLUB.defaultGroup) + ")" : "") + " — " + m.opponent + (m.homeAway ? " (" + m.homeAway + ")" : "")];
  lines.push("Дата: " + new Date(m.date + "T00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) + (m.time ? ", " + m.time : ""));
  if (m.venue) lines.push("Место: " + m.venue); if (t) lines.push("Турнир: " + t);
  lines.push("", CLUB.phrases.announceOutro);
  return lines.join("\n");
}
function announceFor(m) { return m.id && contentList().find(c => c.matchId === m.id && /^Анонс матча/.test(c.title)); }
function createAnnounceDraft(mi) {
  const m = season().matches[mi]; if (!m || !can("content.edit")) return;
  m.id = m.id || newId();
  if (announceFor(m)) { alert("Черновик анонса для этого матча уже есть в контент-плане (сектор «Медиа»)."); return; }
  const today = dateStr(new Date()); let d = addDays(m.date, -1); if (d < today && m.date >= today) d = today;
  contentList().push({ id: newId(), date: d, channel: CHANNELS[0], title: "Анонс матча: " + CLUB.name + " — " + m.opponent + ", " + ruDate(m.date), status: "идея", notes: announceText(m), matchId: m.id });
  mediaWeek = mondayOf(d); persist();
  const dlg = document.querySelector("#match-dialog"); if (dlg.open) dlg.close();
  selectSector("media");
}

// ---------- контент-план ----------
function contentFields(c = {}) {
  const weekDefault = mediaWeek <= dateStr(new Date()) && dateStr(new Date()) <= addDays(mediaWeek, 6) ? dateStr(new Date()) : mediaWeek;
  return "<label>Дата<input required type=\"date\" name=\"date\" value=\"" + attr(c.date || weekDefault) + "\"></label>"
    + "<label>Канал<select name=\"channel\">" + CHANNELS.map(x => "<option value=\"" + x + "\"" + (x === (c.channel || CHANNELS[0]) ? " selected" : "") + ">" + CHANNEL_LABEL[x] + "</option>").join("") + "</select></label>"
    + "<label class=\"wide\">Тема / заголовок<input required maxlength=\"140\" name=\"title\" placeholder=\"О чём публикация\" value=\"" + attr(c.title) + "\"></label>"
    + "<label>Статус<select name=\"status\">" + CONTENT_STATUSES.map(x => "<option" + (x === (c.status || CONTENT_STATUSES[0]) ? " selected" : "") + ">" + x + "</option>").join("") + "</select></label>"
    + "<label>Связанный матч (необязательно)<select name=\"matchId\"><option value=\"\">— нет —</option>" + season().matches.map(m => "<option value=\"" + m.id + "\"" + (m.id === c.matchId ? " selected" : "") + ">" + esc(matchLabel(m)) + "</option>").join("") + "</select></label>"
    + "<label class=\"wide\">Заметки / текст публикации<textarea name=\"notes\" rows=\"4\" maxlength=\"3000\" placeholder=\"Необязательно\">" + esc(c.notes || "") + "</textarea></label>";
}
function readContent(form) { const fd = new FormData(form), s = k => String(fd.get(k) || ""); return { date: s("date"), channel: s("channel"), title: s("title").trim(), status: s("status"), matchId: s("matchId"), notes: s("notes") }; }
function weekItems() { return contentList().filter(c => c.date >= mediaWeek && c.date <= addDays(mediaWeek, 6)).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "ru")); }
// Счёт недели: в публикации входят «готово» и «опубликовано»; идеи не считаются.
function weekStats() { const items = weekItems(), pub = items.filter(c => c.status !== "идея"); return { items, pub: pub.length, done: items.filter(c => c.status === "опубликовано").length, ideas: items.length - pub.length }; }
function contentItemMarkup(c) {
  const m = c.matchId && season().matches.find(x => x.id === c.matchId);
  return "<li class=\"content-item st-" + CONTENT_STATUSES.indexOf(c.status) + "\"><div class=\"ci-main\"><p><span class=\"ch-chip\">" + esc(CHANNEL_LABEL[c.channel]) + "</span> <b>" + esc(c.title) + "</b></p>"
    + (m ? "<small>матч: " + esc(matchLabel(m)) + "</small>" : "") + (c.notes ? "<small class=\"ci-notes\">" + esc(c.notes.length > 140 ? c.notes.slice(0, 140) + "…" : c.notes) + "</small>" : "") + "</div>"
    + "<div class=\"ci-side\"><select data-content-status=\"" + c.id + "\" aria-label=\"Статус публикации\">" + CONTENT_STATUSES.map(x => "<option" + (x === c.status ? " selected" : "") + ">" + x + "</option>").join("") + "</select>"
    + "<button type=\"button\" class=\"ghost-button\" data-content-copy=\"" + c.id + "\">КОПИРОВАТЬ</button><button type=\"button\" class=\"ghost-button\" data-content-edit=\"" + c.id + "\">ИЗМЕНИТЬ</button><button type=\"button\" class=\"del-btn\" data-content-del=\"" + c.id + "\" aria-label=\"Удалить публикацию\" title=\"Удалить\">×</button></div></li>";
}
function contentMarkup() {
  if (!mediaWeek) mediaWeek = mondayOf(dateStr(new Date()));
  const ws = weekStats(), items = ws.items, pub = { length: ws.pub }, done = ws.done, ideas = ws.ideas;
  const pct = Math.min(100, Math.round(pub.length / POSTS_PER_WEEK * 100)), today = dateStr(new Date());
  const days = eachDate(mediaWeek, addDays(mediaWeek, 6)).map((d, i) => { const list = items.filter(c => c.date === d); return "<div class=\"content-day" + (d === today ? " today" : "") + "\"><h4>" + DAYS[i] + " <small>" + shortDate(d) + "</small></h4>" + (list.length ? "<ul>" + list.map(contentItemMarkup).join("") + "</ul>" : "<span class=\"day-empty\">—</span>") + "</div>"; }).join("");
  const noAnn = season().matches.filter(m => m.date >= today && m.status === "запланирован" && !announceFor(m));
  const ann = noAnn.length ? "<div class=\"announce-block\"><p class=\"eyebrow\">МАТЧИ БЕЗ АНОНСА</p><ul>" + noAnn.map(m => "<li><span>" + esc(matchLabel(m)) + (m.time ? " · " + esc(m.time) : "") + "</span><button type=\"button\" class=\"ghost-button\" data-announce=\"" + season().matches.indexOf(m) + "\">СОЗДАТЬ ЧЕРНОВИК АНОНСА</button></li>").join("") + "</ul></div>" : "";
  return "<section class=\"players-section media-section\"><div class=\"section-heading\"><div><p class=\"eyebrow\">КОНТЕНТ-ПЛАН</p><h3>Публикации</h3></div><button type=\"button\" class=\"primary-button\" id=\"add-content-toggle\">+ ПУБЛИКАЦИЯ</button></div>"
    + "<div class=\"week-nav\"><button type=\"button\" class=\"ghost-button\" data-week=\"-1\" aria-label=\"Предыдущая неделя\">‹</button><b>" + shortDate(mediaWeek) + " — " + shortDate(addDays(mediaWeek, 6)) + " " + mediaWeek.slice(0, 4) + "</b><button type=\"button\" class=\"ghost-button\" data-week=\"1\" aria-label=\"Следующая неделя\">›</button><button type=\"button\" class=\"ghost-button\" data-week=\"0\">ЭТА НЕДЕЛЯ</button></div>"
    + "<p class=\"resource-line\">Публикаций на неделе: <strong>" + pub.length + "</strong> (опубликовано: " + done + ") <i></i> идей: " + ideas + " <i></i> ориентир: около " + POSTS_PER_WEEK + " в неделю</p><i class=\"hud-bar pay-bar\"><em style=\"width:" + pct + "%\"></em></i>"
    + "<p class=\"hint\">В счёт публикаций входят записи со статусом «готово» и «опубликовано»; идеи не считаются. Всего записей в плане сезона: " + contentList().length + ".</p>"
    + "<form class=\"match-form\" id=\"content-form\" hidden>" + contentFields() + "<button class=\"primary-button\">СОХРАНИТЬ</button></form><div class=\"content-week\">" + days + "</div>" + ann + "</section>";
}
function copyText(text) {
  const fallback = () => { const t = Object.assign(document.createElement("textarea"), { value: text }); document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch {} t.remove(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(fallback); else fallback();
}
function bindContent() {
  document.querySelectorAll("[data-week]").forEach(b => b.addEventListener("click", () => { const n = +b.dataset.week; mediaWeek = n ? addDays(mediaWeek, 7 * n) : mondayOf(dateStr(new Date())); render(); }));
  on("#add-content-toggle", "click", () => { const f = document.querySelector("#content-form"); f.hidden = !f.hidden; });
  on("#content-form", "submit", e => { e.preventDefault(); if (!can("content.edit")) return; const c = readContent(e.currentTarget); if (!c.title) return; c.id = newId(); contentList().push(c); mediaWeek = mondayOf(c.date); persist(); });
  document.querySelectorAll("[data-content-status]").forEach(s => s.addEventListener("change", e => { const c = contentList().find(x => x.id === s.dataset.contentStatus); if (c) { c.status = e.target.value; persist(); } }));
  document.querySelectorAll("[data-content-del]").forEach(b => b.addEventListener("click", () => { const c = contentList().find(x => x.id === b.dataset.contentDel); if (!c || !confirm("Удалить «" + c.title + "» из контент-плана?")) return; season().content = contentList().filter(x => x.id !== c.id); persist(); }));
  document.querySelectorAll("[data-content-copy]").forEach(b => b.addEventListener("click", () => { const c = contentList().find(x => x.id === b.dataset.contentCopy); if (c) { copyText(c.notes || c.title); b.textContent = "СКОПИРОВАНО"; setTimeout(() => { b.textContent = "КОПИРОВАТЬ"; }, 1500); } }));
  document.querySelectorAll("[data-content-edit]").forEach(b => b.addEventListener("click", () => editContent(b.dataset.contentEdit)));
  document.querySelectorAll("[data-announce]").forEach(b => b.addEventListener("click", () => createAnnounceDraft(+b.dataset.announce)));
}
function editContent(id) {
  const c = contentList().find(x => x.id === id); if (!c) return; const box = document.querySelector("#content-dialog-content");
  box.innerHTML = "<p class=\"eyebrow\">РЕДАКТИРОВАНИЕ ПУБЛИКАЦИИ</p><h2>" + esc(c.title) + "</h2><form class=\"match-form\" id=\"edit-content-form\">" + contentFields(c) + "<div class=\"match-actions wide\"><button class=\"primary-button\">СОХРАНИТЬ</button><button type=\"button\" class=\"ghost-button\" id=\"cancel-content-edit\">ОТМЕНА</button></div></form>";
  box.querySelector("#cancel-content-edit").addEventListener("click", () => document.querySelector("#content-dialog").close());
  box.querySelector("#edit-content-form").addEventListener("submit", e => { e.preventDefault(); if (!can("content.edit")) return; const n = readContent(e.currentTarget); if (!n.title) return; Object.assign(c, n); mediaWeek = mondayOf(c.date); document.querySelector("#content-dialog").close(); persist(); });
  document.querySelector("#content-dialog").showModal();
}
