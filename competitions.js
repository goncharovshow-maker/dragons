// Сектор «Соревнования»: турниры, база соперников, расширенные поля матча.
// Все записи создаёт пользователь вручную и хранит по сезонам (season().tournaments / season().opponents).
// Стартовых турниров и соперников нет. Файл подключается до app.js; к данным приложения обращается только при вызове.
const TOURNAMENT_STATUSES = ["планируется", "заявка открыта", "заявка подана", "идёт", "завершён", "отменён"];
const HOME_AWAY = ["дом", "выезд"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function tournamentsList() { const d = season(); return d.tournaments || (d.tournaments = []); }
function opponentsList() { const d = season(); return d.opponents || (d.opponents = []); }
function tournamentById(id) { return id ? tournamentsList().find(t => t.id === id) : null; }
function matchTournamentName(m) { const t = tournamentById(m.tournamentId); return t ? t.name : (m.tournament || ""); }

// Приведение данных сезона к допустимому виду (при загрузке и импорте).
function normalizeCompetitions(d) {
  const str = v => typeof v === "string" ? v : "";
  d.tournaments = (Array.isArray(d.tournaments) ? d.tournaments : []).filter(t => t && typeof t.name === "string" && t.name.trim()).map(t => ({
    id: cleanId(t.id), name: t.name.trim(), stage: str(t.stage), status: TOURNAMENT_STATUSES.includes(t.status) ? t.status : TOURNAMENT_STATUSES[0],
    applyFrom: DATE_RE.test(t.applyFrom) ? t.applyFrom : "", applyTo: DATE_RE.test(t.applyTo) ? t.applyTo : "", notes: str(t.notes),
    place: Number.isInteger(+t.place) && +t.place > 0 && t.place !== "" ? +t.place : "", table: str(t.table)
  }));
  d.opponents = (Array.isArray(d.opponents) ? d.opponents : []).filter(o => o && typeof o.name === "string" && o.name.trim()).map(o => ({ id: cleanId(o.id), name: o.name.trim(), notes: str(o.notes) }));
  const tids = new Set(d.tournaments.map(t => t.id)), oids = new Set(d.opponents.map(o => o.id));
  (d.matches || []).forEach(m => {
    m.id = cleanId(m.id);
    m.tournamentId = tids.has(m.tournamentId) ? m.tournamentId : ""; m.opponentId = oids.has(m.opponentId) ? m.opponentId : "";
    m.homeAway = HOME_AWAY.includes(m.homeAway) ? m.homeAway : ""; m.team = typeof m.team === "string" ? m.team : ""; m.protocol = str(m.protocol);
  });
}
// Итоговая обработка матча из формы: идентификатор, связь с соперником из базы, проверка турнира.
function finalizeMatch(m) {
  m.id = m.id || newId(); m.opponent = String(m.opponent || "").trim();
  const o = opponentsList().find(x => x.name.toLowerCase() === m.opponent.toLowerCase()); m.opponentId = o ? o.id : ""; if (o) m.opponent = o.name;
  if (!tournamentById(m.tournamentId)) m.tournamentId = "";
  return m;
}

// ---------- дополнительные поля формы матча ----------
function opponentDatalist() { return "<datalist id=\"opp-list\">" + opponentsList().map(o => "<option value=\"" + attr(o.name) + "\"></option>").join("") + "</datalist>"; }
function matchGroupFields(m = {}) {
  return "<label>Группа<select name=\"team\"><option value=\"\">— не указана —</option>" + TEAMS.map(t => "<option" + (t.id === m.team ? " selected" : "") + ">" + t.id + "</option>").join("") + "</select></label>"
    + "<label>Дом / выезд<select name=\"homeAway\"><option value=\"\">— не указано —</option>" + HOME_AWAY.map(x => "<option" + (x === m.homeAway ? " selected" : "") + ">" + x + "</option>").join("") + "</select></label>"
    + "<label class=\"wide\">Турнир из списка<select name=\"tournamentId\"><option value=\"\">— не выбран —</option>" + tournamentsList().map(t => "<option value=\"" + t.id + "\"" + (t.id === m.tournamentId ? " selected" : "") + ">" + esc(t.name) + (t.stage ? " · " + esc(t.stage) : "") + "</option>").join("") + "</select></label>";
}
function matchProtocolField(m = {}) { return "<label class=\"wide\">Протокол матча<textarea name=\"protocol\" rows=\"3\" maxlength=\"2000\" placeholder=\"Составы, ход матча, удаления… Необязательно\">" + esc(m.protocol || "") + "</textarea></label>"; }

// ---------- турниры ----------
function tournamentFields(t = {}) {
  const facts = (sectors.find(s => s.id === "competitions") || { facts: [] }).facts;
  return "<label class=\"wide\">Название<input required maxlength=\"120\" name=\"name\" list=\"tournament-names\" autocomplete=\"off\" placeholder=\"Например, Shushary Cup\" value=\"" + attr(t.name) + "\"><datalist id=\"tournament-names\">" + facts.map(f => "<option value=\"" + attr(f) + "\"></option>").join("") + "</datalist></label>"
    + "<label>Этап<input maxlength=\"80\" name=\"stage\" placeholder=\"Например, групповой этап\" value=\"" + attr(t.stage) + "\"></label>"
    + "<label>Статус<select name=\"status\">" + TOURNAMENT_STATUSES.map(x => "<option" + (x === (t.status || TOURNAMENT_STATUSES[0]) ? " selected" : "") + ">" + x + "</option>").join("") + "</select></label>"
    + "<label>Заявки с<input type=\"date\" name=\"applyFrom\" value=\"" + attr(t.applyFrom) + "\"></label><label>Заявки до<input type=\"date\" name=\"applyTo\" value=\"" + attr(t.applyTo) + "\"></label>"
    + "<label>Место команды<input type=\"number\" min=\"1\" max=\"99\" name=\"place\" placeholder=\"Если известно\" value=\"" + attr(t.place) + "\"></label><span></span>"
    + "<label class=\"wide\">Таблица<textarea name=\"table\" rows=\"3\" maxlength=\"2000\" placeholder=\"Турнирная таблица текстом — только если вы её внесёте\">" + esc(t.table || "") + "</textarea></label>"
    + "<label class=\"wide\">Заметки<input maxlength=\"300\" name=\"notes\" placeholder=\"Необязательно\" value=\"" + attr(t.notes) + "\"></label>";
}
function readTournament(form) {
  const fd = new FormData(form), s = k => String(fd.get(k) || "").trim(), p = +s("place");
  return { name: s("name"), stage: s("stage"), status: s("status"), applyFrom: s("applyFrom"), applyTo: s("applyTo"), place: p > 0 ? Math.round(p) : "", table: s("table"), notes: s("notes") };
}
function applyDeadlinePassed(t) { return !!t.applyTo && t.applyTo < dateStr(new Date()) && ["планируется", "заявка открыта"].includes(t.status); }
function tournamentsMarkup() {
  const all = tournamentsList(), ed = can("matches.edit");
  const cards = all.length ? "<div class=\"player-cards\">" + all.map(t => "<button type=\"button\" class=\"player-card tournament-card\" data-tournament=\"" + t.id + "\"><b>" + (t.place ? "#" + t.place : "★") + "</b><span>" + esc(t.name) + "</span><small>" + esc(t.status) + (t.stage ? " · " + esc(t.stage) : "") + (t.applyTo ? " · заявки до " + date(t.applyTo) : "") + (applyDeadlinePassed(t) ? " ⚠" : "") + "</small></button>").join("") + "</div>" : "<p class=\"empty\">Турниры пока не внесены. " + (ed ? "Добавьте турнир вручную — например, из списка ниже в подсказке названия." : "") + "</p>";
  return "<section class=\"match-section tournaments-section\"><div class=\"section-heading\"><div><p class=\"eyebrow\">ТУРНИРЫ СЕЗОНА</p><h3>Турниры</h3></div>" + (ed ? "<button type=\"button\" class=\"primary-button\" id=\"add-tournament-toggle\">+ ТУРНИР</button>" : "") + "</div>"
    + (ed ? "<form class=\"match-form\" id=\"tournament-form\" hidden>" + tournamentFields() + "<button class=\"primary-button\">СОХРАНИТЬ ТУРНИР</button></form>" : "") + cards + "</section>";
}
function bindTournaments() {
  on("#add-tournament-toggle", "click", () => { const f = document.querySelector("#tournament-form"); f.hidden = !f.hidden; });
  on("#tournament-form", "submit", e => { e.preventDefault(); const t = readTournament(e.currentTarget); if (!t.name) return; t.id = newId(); tournamentsList().push(t); persist(); });
  document.querySelectorAll("[data-tournament]").forEach(b => b.addEventListener("click", () => openTournament(b.dataset.tournament)));
}
function openTournament(id) {
  const t = tournamentById(id); if (!t) return;
  const games = season().matches.filter(m => m.tournamentId === id).sort((a, b) => a.date.localeCompare(b.date));
  const box = document.querySelector("#tournament-dialog-content"), ed = can("matches.edit");
  box.innerHTML = "<p class=\"eyebrow\">КАРТОЧКА ТУРНИРА</p><h2>" + esc(t.name) + "</h2>"
    + "<dl class=\"match-info\"><div><dt>Этап</dt><dd>" + esc(t.stage || "Не указан") + "</dd></div><div><dt>Статус</dt><dd>" + esc(t.status) + "</dd></div>"
    + "<div><dt>Заявки</dt><dd>" + (t.applyFrom || t.applyTo ? esc((t.applyFrom ? date(t.applyFrom) : "…") + " — " + (t.applyTo ? date(t.applyTo) : "…")) : "Сроки не указаны") + (applyDeadlinePassed(t) ? " <span class=\"warn\">⚠ срок прошёл</span>" : "") + "</dd></div>"
    + "<div><dt>Место команды</dt><dd>" + (t.place ? esc(String(t.place)) : "Не указано") + "</dd></div>"
    + (t.table ? "<div class=\"wide-info\"><dt>Таблица</dt><dd class=\"pre\">" + esc(t.table) + "</dd></div>" : "")
    + "<div class=\"wide-info\"><dt>Матчи турнира</dt><dd>" + (games.length ? games.map(m => esc(date(m.date) + " — " + m.opponent + (m.score ? " (" + m.score + ")" : ""))).join("<br>") : "Пока нет — выберите турнир в карточке матча") + "</dd></div>"
    + (ed ? "<div class=\"wide-info\"><dt>Заметки</dt><dd>" + esc(t.notes || "—") + "</dd></div>" : "") + "</dl>" + (ed ? actionsMarkup("ТУРНИР") : "");
  bindAct(box, "edit", "click", () => editTournament(id));
  bindAct(box, "delete", "click", () => { if (!confirm("Удалить турнир «" + t.name + "»? Матчи останутся, связь с турниром будет снята.")) return; season().matches.forEach(m => { if (m.tournamentId === id) { m.tournamentId = ""; if (!m.tournament) m.tournament = t.name; } }); season().tournaments = tournamentsList().filter(x => x.id !== id); document.querySelector("#tournament-dialog").close(); persist(); });
  const d = document.querySelector("#tournament-dialog"); if (!d.open) d.showModal();
}
function editTournament(id) {
  const t = tournamentById(id), box = document.querySelector("#tournament-dialog-content");
  box.innerHTML = "<p class=\"eyebrow\">РЕДАКТИРОВАНИЕ ТУРНИРА</p><h2>" + esc(t.name) + "</h2><form class=\"match-form\" id=\"edit-tournament-form\">" + tournamentFields(t) + "<div class=\"match-actions wide\"><button class=\"primary-button\">СОХРАНИТЬ</button><button type=\"button\" class=\"ghost-button\" id=\"cancel-tournament-edit\">ОТМЕНА</button></div></form>";
  box.querySelector("#cancel-tournament-edit").addEventListener("click", () => openTournament(id));
  box.querySelector("#edit-tournament-form").addEventListener("submit", e => { e.preventDefault(); const n = readTournament(e.currentTarget); if (!n.name) return; Object.assign(t, n); persist(); openTournament(id); });
}

// ---------- база соперников ----------
function opponentsMarkup() {
  if (!can("matches.edit")) return "";
  const all = opponentsList(), games = name => season().matches.filter(m => m.opponent.toLowerCase() === name.toLowerCase()).length;
  return "<section class=\"match-section opponents-section\"><div class=\"section-heading\"><div><p class=\"eyebrow\">БАЗА СОПЕРНИКОВ</p><h3>Соперники</h3></div></div>"
    + "<form class=\"add-task\" id=\"opponent-form\"><input required maxlength=\"120\" name=\"name\" placeholder=\"Название команды\"><input maxlength=\"120\" name=\"notes\" placeholder=\"Заметка (необязательно)\"><button>+ СОПЕРНИК</button></form>"
    + (all.length ? "<ul class=\"opp-list\">" + all.map(o => "<li><span><b>" + esc(o.name) + "</b>" + (o.notes ? "<small>" + esc(o.notes) + "</small>" : "") + "</span><em>матчей: " + games(o.name) + "</em><button type=\"button\" class=\"del-btn\" data-del-opp=\"" + o.id + "\" aria-label=\"Удалить соперника\" title=\"Удалить из базы\">×</button></li>").join("") + "</ul>" : "<p class=\"empty\">База пуста. Соперников можно выбирать из неё при добавлении матча.</p>") + "</section>";
}
function bindOpponents() {
  on("#opponent-form", "submit", e => {
    e.preventDefault(); const fd = new FormData(e.currentTarget), name = String(fd.get("name") || "").trim(); if (!name) return;
    if (opponentsList().some(o => o.name.toLowerCase() === name.toLowerCase())) { alert("Такой соперник уже есть в базе."); return; }
    opponentsList().push({ id: newId(), name, notes: String(fd.get("notes") || "").trim() });
    season().matches.forEach(m => { if (m.opponent.toLowerCase() === name.toLowerCase()) m.opponentId = opponentsList()[opponentsList().length - 1].id; }); persist();
  });
  document.querySelectorAll("[data-del-opp]").forEach(b => b.addEventListener("click", () => { const o = opponentsList().find(x => x.id === b.dataset.delOpp); if (!o || !confirm("Убрать «" + o.name + "» из базы? Матчи останутся.")) return; season().opponents = opponentsList().filter(x => x.id !== o.id); season().matches.forEach(m => { if (m.opponentId === o.id) m.opponentId = ""; }); persist(); }));
}
