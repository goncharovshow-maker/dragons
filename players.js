// Игроки (сектор «Спорт»), голы и статистика авторов шайб.
// Файл входит в разбиение бывшего app.js; порядок подключения — в index.html.

// ===== Игроки (сектор «Спорт»). Состав хранится на уровне клуба: state.players, не по сезонам. =====
const TEAMS = CLUB.groups;   // группы клуба из club.config.js
const POSITIONS = ["вратарь", "защитник", "нападающий"];
let playerFilter = "all";
function playersList() { return state.players || (state.players = []); }
function playerFields(p = {}) {
  const v = k => " value=\"" + attr(p[k]) + "\"";
  return "<label class=\"wide\">Имя и фамилия<input required maxlength=\"80\" name=\"name\" placeholder=\"Например, Иван Петров\"" + v("name") + "></label>"
    + "<label>Группа<select name=\"team\">" + TEAMS.map(t => "<option" + (t.id === (p.team || (playerFilter !== "all" ? playerFilter : CLUB.defaultGroup || TEAMS[0].id)) ? " selected" : "") + ">" + t.id + "</option>").join("") + "</select></label>"
    + "<label>Амплуа<select name=\"position\">" + POSITIONS.map(x => "<option" + (x === (p.position || "нападающий") ? " selected" : "") + ">" + x + "</option>").join("") + "</select></label>"
    + "<label>Номер<input type=\"number\" min=\"0\" max=\"99\" name=\"number\" placeholder=\"—\"" + v("number") + "></label>"
    + "<label class=\"wide\">Заметки<input maxlength=\"200\" name=\"notes\" placeholder=\"Необязательно\"" + v("notes") + "></label>";
}
function playersMarkup() {
  const all = playersList(), goalies = all.filter(p => p.position === "вратарь").length;
  const chips = TEAMS.map(t => { const n = all.filter(p => p.team === t.id).length; return "<button type=\"button\" class=\"team-chip" + (playerFilter === t.id ? " active" : "") + "\" data-team=\"" + t.id + "\"><span>" + t.name + "</span><b>" + n + (t.target ? "<small> / " + t.target + "</small>" : "") + "</b>" + (t.target ? "<i class=\"hud-bar\"><em style=\"width:" + Math.min(100, Math.round(n / t.target * 100)) + "%\"></em></i>" : "") + "</button>"; }).join("");
  const shown = all.filter(p => playerFilter === "all" || p.team === playerFilter).sort((a, b) => TEAMS.findIndex(t => t.id === a.team) - TEAMS.findIndex(t => t.id === b.team) || (a.number === "" || a.number == null ? 1e3 : +a.number) - (b.number === "" || b.number == null ? 1e3 : +b.number) || a.name.localeCompare(b.name, "ru"));
  const cards = shown.length ? "<div class=\"player-cards\">" + shown.map(p => "<button type=\"button\" class=\"player-card\" data-player=\"" + p.id + "\"><b>" + (p.number !== "" && p.number != null ? "#" + esc(String(p.number)) : "—") + "</b><span>" + esc(p.name) + "</span><small>" + esc(p.team) + " · " + esc(p.position) + "</small></button>").join("") + "</div>" : "<p class=\"empty\">" + (all.length ? "В этой группе игроков пока нет." : "Состав пока пуст. Добавьте первого игрока.") + "</p>";
  return "<section class=\"players-section\"><div class=\"section-heading\"><div><p class=\"eyebrow\">СОСТАВ КЛУБА</p><h3>Игроки</h3></div><button type=\"button\" class=\"primary-button\" id=\"add-player-toggle\">+ ИГРОК</button></div>"
    + "<div class=\"team-chips\">" + chips + "</div><p class=\"resource-line\">В системе: " + all.length + " " + plural(all.length, "игрок", "игрока", "игроков") + " <i></i> вратарей: " + goalies + " (по ТЗ — 4 детских вратаря)" + (playerFilter !== "all" ? " <i></i> <a href=\"#\" id=\"reset-team\">показать все группы</a>" : "") + "</p>"
    + "<form class=\"match-form\" id=\"player-form\" hidden>" + playerFields() + "<button class=\"primary-button\">СОХРАНИТЬ ИГРОКА</button></form>" + cards + goalsMarkup() + "</section>";
}
function bindPlayers() {
  on("#add-player-toggle","click", () => { const f = document.querySelector("#player-form"); f.hidden = !f.hidden; });
  on("#player-form","submit", e => { e.preventDefault(); const p = Object.fromEntries(new FormData(e.currentTarget)); p.name = p.name.trim(); if (!p.name) return; p.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); playersList().push(p); persist(); });
  document.querySelectorAll("[data-team]").forEach(b => b.addEventListener("click", () => { playerFilter = playerFilter === b.dataset.team ? "all" : b.dataset.team; render(); }));
  const r = document.querySelector("#reset-team"); if (r) r.addEventListener("click", e => { e.preventDefault(); playerFilter = "all"; render(); });
  document.querySelectorAll("[data-player]").forEach(b => b.addEventListener("click", () => openPlayer(b.dataset.player)));
}
function openPlayer(id) {
  const p = playersList().find(x => x.id === id); if (!p) return;
  document.querySelector("#player-dialog-content").innerHTML = "<p class=\"eyebrow\">КАРТОЧКА ИГРОКА</p><h2>" + esc(p.name) + "</h2><div class=\"match-score-large\">" + (p.number !== "" && p.number != null ? "#" + esc(String(p.number)) : "—") + "</div>"
    + "<dl class=\"match-info\"><div><dt>Группа</dt><dd>" + esc(p.team) + "</dd></div><div><dt>Амплуа</dt><dd>" + esc(p.position) + "</dd></div>"+(can("assess.view")?"<div><dt>Оценка развития</dt><dd>"+esc(assessLine(p))+"</dd></div><div class=\"wide-info\"><dt>Динамика по критериям</dt><dd>"+assessChart(p.id)+"</dd></div>":"")+"<div><dt>Посещаемость</dt><dd>" + esc(attText(p)) + "</dd></div><div><dt>Родители</dt><dd>" + esc(parentsOf(p.id).map(x => x.name).join(", ") || "Не указаны") + "</dd></div><div><dt>Голы (сезон " + esc(currentSeason) + ")</dt><dd>" + goalsOf(p) + "</dd></div><div class=\"wide-info\"><dt>Заметки</dt><dd>" + esc(p.notes || "—") + "</dd></div></dl>"
    + (can("players.edit") ? "<div class=\"match-actions\"><button type=\"button\" class=\"primary-button\" id=\"edit-player\">РЕДАКТИРОВАТЬ</button><button type=\"button\" class=\"danger-button\" id=\"delete-player\">УДАЛИТЬ ИГРОКА</button></div>" : "");
  on("#edit-player","click", () => editPlayer(id));
  on("#delete-player","click", () => { if (!confirm("Удалить игрока «" + p.name + "»?")) return; state.players = playersList().filter(x => x.id !== id); parentsList().forEach(x => { x.children = (x.children || []).filter(c => c !== id); }); dropPlayerRefs(id); document.querySelector("#player-dialog").close(); persist(); });
  const d = document.querySelector("#player-dialog"); if (!d.open) d.showModal();
}
function editPlayer(id) {
  const p = playersList().find(x => x.id === id), box = document.querySelector("#player-dialog-content");
  box.innerHTML = "<p class=\"eyebrow\">РЕДАКТИРОВАНИЕ ИГРОКА</p><h2>" + esc(p.name) + "</h2><form class=\"match-form\" id=\"edit-player-form\">" + playerFields(p) + "<div class=\"match-actions wide\"><button class=\"primary-button\">СОХРАНИТЬ</button><button type=\"button\" class=\"ghost-button\" id=\"cancel-player-edit\">ОТМЕНА</button></div></form>";
  box.querySelector("#cancel-player-edit").addEventListener("click", () => openPlayer(id));
  box.querySelector("#edit-player-form").addEventListener("submit", e => { e.preventDefault(); const n = Object.fromEntries(new FormData(e.currentTarget)); n.name = n.name.trim(); if (!n.name) return; Object.assign(p, n); persist(); openPlayer(id); });
}

// ===== Голы: разбор поля «Авторы шайб» и статистика сезона =====
// Формат: «Иван Петров, Соколов ×2, Ким (3)». Игрок находится по полному имени или по уникальной фамилии.
function parseScorers(str) {
  return String(str || "").split(/[,;]/).map(t => t.trim()).filter(Boolean).map(t => {
    const m = t.match(/^(.*?)\s*(?:[×xхX*]\s*(\d{1,2})|\((\d{1,2})\))$/);
    return m && m[1] ? { name: m[1].trim(), goals: +(m[2] || m[3]) || 1 } : { name: t, goals: 1 };
  });
}
function findPlayer(name) {
  const q = name.toLowerCase(), all = playersList(), exact = all.filter(p => p.name.toLowerCase() === q);
  if (exact.length === 1) return exact[0];
  const bySurname = all.filter(p => p.name.trim().split(/\s+/).pop().toLowerCase() === q);
  return bySurname.length === 1 ? bySurname[0] : null;
}
function scorerStats() {
  const rows = new Map(); let total = 0, matchesWith = 0;
  season().matches.forEach(m => {
    const list = parseScorers(m.scorers); if (!list.length) return; matchesWith++;
    list.forEach(({ name, goals }) => { const p = findPlayer(name), key = p ? "p:" + p.id : "n:" + name.toLowerCase(); const r = rows.get(key) || { player: p, name: p ? p.name : name, goals: 0 }; r.goals += goals; total += goals; rows.set(key, r); });
  });
  return { rows: [...rows.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, "ru")), total, matchesWith };
}
function goalsOf(p) { const r = scorerStats().rows.find(x => x.player && x.player.id === p.id); return r ? r.goals : 0; }
function goalsMarkup() {
  const st = scorerStats();
  const head = "<div class=\"goals-block\"><p class=\"eyebrow\">ГОЛЫ СЕЗОНА " + esc(currentSeason) + "</p>";
  if (!st.rows.length) return head + "<p class=\"empty\">Пока нет данных. Укажите «Авторы шайб» в карточке матча (сектор «Соревнования») — например: Петров, Ким ×2.</p></div>";
  return head + "<ol class=\"goals-list\">" + st.rows.slice(0, 10).map((r, i) => "<li><span class=\"rank\">" + (i + 1) + "</span><span class=\"who\">" + esc(r.name) + (r.player ? "<small>" + esc(r.player.team) + "</small>" : "<small class=\"muted\">нет в составе</small>") + "</span><b>" + r.goals + "</b></li>").join("") + "</ol><p class=\"resource-line\">Всего голов с указанными авторами: " + st.total + " <i></i> матчей с данными: " + st.matchesWith + "</p></div>";
}
// Подсказки имён под полем «Авторы шайб»
function scorerChips() {
  const all = playersList(); if (!all.length) return "";
  return "<span class=\"suggest\">" + all.map(p => "<button type=\"button\" data-suggest=\"" + attr(p.name) + "\">" + esc(p.name) + "</button>").join("") + "</span>";
}
function lastToken(input) { return input.value.split(/[,;]/).pop().trim(); }
