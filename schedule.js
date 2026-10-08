// Расписание недели, посещаемость и печать расписания (сектор «Спорт»).
// Файл входит в разбиение бывшего app.js; порядок подключения — в index.html.

// ===== Расписание (сектор «Спорт»): недельная сетка, привязка к группам и тренерам =====
const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const SESSION_KINDS = ["тренировка на льду", "ОФП / зал", "другое"];
function sessionsList() { return state.sessions || (state.sessions = []); }
function toMin(t) { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : NaN; }
function trainerName(id) { const t = trainersList().find(x => x.id === id); return t ? t.name : ""; }
function sessionFields(x = {}) {
  const teams = x.teams || [];
  return "<label>Тип занятия<select name=\"kind\">" + SESSION_KINDS.map(k => "<option" + (k === (x.kind || SESSION_KINDS[0]) ? " selected" : "") + ">" + k + "</option>").join("") + "</select></label>"
    + "<label>День недели<select name=\"day\">" + DAYS.map((d, i) => "<option value=\"" + (i + 1) + "\"" + (+x.day === i + 1 ? " selected" : "") + ">" + d + "</option>").join("") + "</select></label>"
    + "<label>Начало<input required type=\"time\" name=\"start\" value=\"" + attr(x.start) + "\"></label><label>Конец<input required type=\"time\" name=\"end\" value=\"" + attr(x.end) + "\"></label>"
    + "<fieldset class=\"team-checks\"><legend>Группы</legend>" + TEAMS.map(g => "<label class=\"check\"><input type=\"checkbox\" name=\"teams\" value=\"" + g.id + "\"" + (teams.includes(g.id) ? " checked" : "") + "> " + g.id + "</label>").join("") + "</fieldset>"
    + "<label>Тренер<select name=\"trainerId\"><option value=\"\">— не назначен —</option>" + trainersList().map(t => "<option value=\"" + t.id + "\"" + (t.id === x.trainerId ? " selected" : "") + ">" + esc(t.name) + "</option>").join("") + "</select></label>"
    + "<label>Место<input maxlength=\"80\" name=\"place\" placeholder=\"Арена / зал\" value=\"" + attr(x.place) + "\"></label>"
    + "<label class=\"wide\">Заметки<input maxlength=\"200\" name=\"notes\" placeholder=\"Необязательно\" value=\"" + attr(x.notes) + "\"></label>";
}
function readSession(form) { const fd = new FormData(form); return { kind: fd.get("kind"), day: +fd.get("day"), start: fd.get("start"), end: fd.get("end"), teams: fd.getAll("teams"), trainerId: fd.get("trainerId") || "", place: String(fd.get("place") || "").trim(), notes: fd.get("notes") || "" }; }
function sessionProblem(x) { return toMin(x.end) <= toMin(x.start) ? "Время окончания должно быть позже начала." : ""; }
// Пересечения: то же время в тот же день у того же тренера или у общей группы.
function conflictsOf(x) {
  const out = [];
  sessionsList().forEach(o => {
    if (o === x || o.id === x.id || +o.day !== +x.day || !(toMin(x.start) < toMin(o.end) && toMin(o.start) < toMin(x.end))) return;
    const why = []; if (x.trainerId && x.trainerId === o.trainerId) why.push("тренер " + trainerName(x.trainerId));
    const shared = (x.teams || []).filter(g => (o.teams || []).includes(g)); if (shared.length) why.push("группа " + shared.join(", "));
    if (why.length) out.push(o.start + "–" + o.end + " (" + why.join("; ") + ")");
  });
  return out;
}
function sessionLine(x) { return DAYS[x.day - 1] + " " + x.start + "–" + x.end; }
function nextSession() {
  const now = new Date(), today = dateStr(now), list = occurrences(today, addDays(today, 28)).filter(it => it.type === "session" && (it.status === "normal" || it.status === "moved"));
  for (const it of list) { const at = new Date(it.date + "T" + it.start.padStart(5, "0")); if (at >= now) return { at, x: { day: weekdayOf(it.date), start: it.start, teams: it.teams } }; }
  return null;
}
function scheduleMarkup() {
  const all = sessionsList(), today = new Date().getDay() || 7, ice = all.filter(x => x.kind === SESSION_KINDS[0]).length, nx = nextSession();
  const cols = DAYS.map((d, i) => {
    const items = all.filter(x => +x.day === i + 1).sort((a, b) => toMin(a.start) - toMin(b.start));
    return "<div class=\"day-col" + (i + 1 === today ? " today" : "") + "\"><h4>" + d + "</h4>" + (items.length ? items.map(x => { const c = can("schedule.edit") ? conflictsOf(x) : []; return "<button type=\"button\" class=\"session-card" + (c.length ? " conflict" : "") + "\" data-session=\"" + x.id + "\"" + (c.length ? " title=\"Пересечение: " + attr(c.join("; ")) + "\"" : "") + "><b>" + esc(x.start) + "–" + esc(x.end) + (c.length ? " ⚠" : "") + "</b><span>" + esc(x.kind) + "</span><small>" + esc((x.teams || []).join(", ") || "группа не указана") + (trainerName(x.trainerId) ? " · " + esc(trainerName(x.trainerId)) : "") + "</small></button>"; }).join("") : "<span class=\"day-empty\">—</span>") + "</div>";
  }).join("");
  const conflicts = can("schedule.edit") ? all.filter(x => conflictsOf(x).length).length : 0;
  return "<section class=\"players-section schedule-section\"><div class=\"section-heading\"><div><p class=\"eyebrow\">РАСПИСАНИЕ ЛЬДА И ТРЕНИРОВОК</p><h3>Неделя клуба</h3></div>" + (can("schedule.edit") ? "<button type=\"button\" class=\"primary-button\" id=\"add-session-toggle\">+ ЗАНЯТИЕ</button>" : "") + "</div>"
    + "<p class=\"resource-line\">Занятий в неделю: " + all.length + " <i></i> на льду: " + ice + (nx ? " <i></i> ближайшее: <strong>" + (nx.at.toDateString() === new Date().toDateString() ? "сегодня" : DAYS[nx.x.day - 1]) + " " + esc(nx.x.start) + " · " + esc((nx.x.teams || []).join(", ") || "—") + "</strong>" : "") + (conflicts ? " <i></i> <span class=\"warn\">⚠ пересечений: " + conflicts + "</span>" : "") + "</p>" + (can("players.view") ? attendanceSummary() : "") + printTools()
    + (can("schedule.edit") ? "<form class=\"match-form\" id=\"session-form\" hidden>" + sessionFields() + "<button class=\"primary-button\">СОХРАНИТЬ ЗАНЯТИЕ</button></form>" : "")
    + (all.length ? "" : "<p class=\"empty\">" + (can("schedule.edit") ? "Расписание пока пусто. Занятия повторяются каждую неделю — добавьте день, время, группы и тренера." : "Расписание пока не опубликовано.") + "</p>") + "<div class=\"week\">" + cols + "</div></section>";
}
function bindSchedule() {
  on("#add-session-toggle","click", () => { const f = document.querySelector("#session-form"); f.hidden = !f.hidden; });
  on("#session-form","submit", e => { e.preventDefault(); const x = readSession(e.currentTarget), bad = sessionProblem(x); if (bad) { alert(bad); return; } x.id = newId(); sessionsList().push(x); const c = conflictsOf(x); persist(); if (c.length) alert("Внимание: занятие пересекается с другим — " + c[0] + "."); });
  document.querySelectorAll("[data-session]").forEach(b => b.addEventListener("click", () => openSession(b.dataset.session)));
  on("#print-group","change", e => { printGroup = e.target.value; });
  on("#print-schedule","click", printSchedule);
}
function openSession(id) {
  const x = sessionsList().find(q => q.id === id); if (!x) return;
  const c = can("schedule.edit") ? conflictsOf(x) : [], box = document.querySelector("#session-dialog-content");
  box.innerHTML = "<p class=\"eyebrow\">ЗАНЯТИЕ</p><h2>" + esc(sessionLine(x)) + "</h2><dl class=\"match-info\"><div><dt>Тип</dt><dd>" + esc(x.kind) + "</dd></div><div><dt>Группы</dt><dd>" + esc((x.teams || []).join(", ") || "Не указаны") + "</dd></div><div><dt>Тренер</dt><dd>" + esc(trainerName(x.trainerId) || "Не назначен") + "</dd></div><div><dt>Место</dt><dd>" + esc(x.place || "Не указано") + "</dd></div><div class=\"wide-info\"><dt>Заметки</dt><dd>" + esc(x.notes || "—") + "</dd></div></dl>" + (c.length ? "<p class=\"data-status err\">⚠ Пересекается: " + esc(c.join("; ")) + "</p>" : "") + (can("attendance.edit") ? "<div id=\"att-holder\"></div>" : "") + (can("schedule.edit") ? actionsMarkup("ЗАНЯТИЕ") : "");
  bindAct(box, "edit", "click", () => editSession(id));
  bindAct(box, "delete", "click", () => { if (!confirm("Удалить занятие " + sessionLine(x) + "?")) return; state.sessions = sessionsList().filter(q => q.id !== id); dropSessionRefs(id); document.querySelector("#session-dialog").close(); persist(); });
  const d = document.querySelector("#session-dialog"); if (!d.open) d.showModal(); mountAttendance(x);
}
function editSession(id) {
  const x = sessionsList().find(q => q.id === id), box = document.querySelector("#session-dialog-content");
  box.innerHTML = "<p class=\"eyebrow\">РЕДАКТИРОВАНИЕ ЗАНЯТИЯ</p><h2>" + esc(sessionLine(x)) + "</h2><form class=\"match-form\" id=\"edit-session-form\">" + sessionFields(x) + "<div class=\"match-actions wide\"><button class=\"primary-button\">СОХРАНИТЬ</button><button type=\"button\" class=\"ghost-button\" id=\"cancel-session-edit\">ОТМЕНА</button></div></form>";
  box.querySelector("#cancel-session-edit").addEventListener("click", () => openSession(id));
  box.querySelector("#edit-session-form").addEventListener("submit", e => { e.preventDefault(); const n = readSession(e.currentTarget), bad = sessionProblem(n); if (bad) { alert(bad); return; } Object.assign(x, n); persist(); openSession(id); });
}
// ===== Посещаемость занятий =====
// state.attendance = { "ГГГГ-ММ-ДД|<id занятия>": { <id игрока>: true|false } }; нет записи = отметки не было.
function attendanceMap() { return state.attendance || (state.attendance = {}); }
function dropPlayerRefs(id) {
  Object.values(state.seasons).forEach(sd => { sd.assessments = (sd.assessments || []).filter(a => a.playerId !== id); (sd.funnel || []).forEach(f => { if (f.playerId === id) f.playerId = ""; }); });
  Object.values(attendanceMap()).forEach(rec => delete rec[id]);
  Object.keys(attendanceMap()).forEach(k => { if (!Object.keys(attendanceMap()[k]).length) delete attendanceMap()[k]; });
  Object.values(paymentsMap()).forEach(rec => delete rec[id]);
}
function dropSessionRefs(id) { Object.keys(attendanceMap()).forEach(k => { if (k.split("|")[1] === id) delete attendanceMap()[k]; }); state.exceptions = exceptionsList().filter(e => e.sessionId !== id); }
function attStats(pid, days) {
  const cutoff = days ? dateStr(new Date(Date.now() - days * 864e5)) : ""; let present = 0, total = 0;
  Object.entries(attendanceMap()).forEach(([k, rec]) => { if (k.split("|")[0] < cutoff || typeof rec[pid] !== "boolean") return; total++; if (rec[pid]) present++; });
  return { present, total, pct: total ? Math.round(present / total * 100) : null };
}
function groupRates(days) {
  return TEAMS.map(t => { const s = playersList().filter(p => p.team === t.id).map(p => attStats(p.id, days)); const total = s.reduce((n, x) => n + x.total, 0), present = s.reduce((n, x) => n + x.present, 0); return { team: t.id, total, pct: total ? Math.round(present / total * 100) : null }; }).filter(r => r.total);
}
function lowAttendance() { return playersList().map(p => ({ p, s: attStats(p.id) })).filter(x => x.s.total >= 3 && x.s.pct < 50).sort((a, b) => a.s.pct - b.s.pct); }
function mountAttendance(x, date = lastHeldDate(x)) {
  const holder = document.querySelector("#att-holder"); if (!holder) return;
  const list = playersList().filter(p => (x.teams || []).includes(p.team)), rec = attendanceMap()[date + "|" + x.id];
  const occ = sessionOccurrence(x, date), okDay = occ.status === "normal" || occ.status === "moved";
  holder.innerHTML = "<div class=\"attendance\"><p class=\"eyebrow\">ПОСЕЩАЕМОСТЬ</p><label class=\"att-date\">Дата занятия<input type=\"date\" id=\"att-date\" value=\"" + attr(date) + "\" max=\"" + dateStr(new Date()) + "\"></label>"
    + (okDay ? "" : "<p class=\"data-status err\">" + (occ.status === "cancelled" ? "В этот день занятие отменено (" + esc(occ.reason) + ")." : occ.status === "movedAway" ? "Это занятие перенесено на " + ruDate(occ.to) + "." : "Эта дата — " + DAYS[weekdayOf(date) - 1] + ", а занятие проходит в " + DAYS[x.day - 1] + " (учтите переносы в календаре).") + "</p>")
    + (!list.length ? "<p class=\"empty\">В группах этого занятия пока нет игроков.</p>" : okDay ? "<div class=\"att-list\">" + list.map(p => "<label class=\"check\"><input type=\"checkbox\" data-att=\"" + p.id + "\"" + (rec && rec[p.id] ? " checked" : "") + "> " + esc(p.name) + " <small>" + esc(p.team) + "</small></label>").join("") + "</div><div class=\"match-actions\"><button type=\"button\" class=\"primary-button\" id=\"att-save\">СОХРАНИТЬ ОТМЕТКУ</button><button type=\"button\" class=\"ghost-button\" id=\"att-all\">ВСЕ БЫЛИ</button><span class=\"att-note\">" + (rec ? "Отметка сохранена ранее" : "Отметка для этой даты ещё не сохранялась") + "</span></div>" : "") + "</div>";
  holder.querySelector("#att-date").addEventListener("change", e => { if (e.target.value) mountAttendance(x, e.target.value); });
  const all = holder.querySelector("#att-all"); if (all) all.addEventListener("click", () => holder.querySelectorAll("[data-att]").forEach(c => { c.checked = true; }));
  const save = holder.querySelector("#att-save"); if (save) save.addEventListener("click", () => {
    const r = {}; holder.querySelectorAll("[data-att]").forEach(c => { r[c.dataset.att] = c.checked; });
    attendanceMap()[date + "|" + x.id] = { ...(attendanceMap()[date + "|" + x.id] || {}), ...r }; persist(); openSession(x.id); mountAttendance(x, date);
    const n = document.querySelector("#att-holder .att-note"); if (n) n.textContent = "Сохранено";
  });
}

// ===== Печать расписания (PDF через «Печать → Сохранить как PDF») =====
const FULL_DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
let printGroup = "all";
function printHtml(group) {
  const items = sessionsList().filter(x => group === "all" || (x.teams || []).includes(group)).sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start));
  const rows = items.map(x => "<tr><td>" + FULL_DAYS[x.day - 1] + "</td><td class=\"t\">" + esc(x.start) + "–" + esc(x.end) + "</td><td>" + esc(x.kind) + "</td><td>" + esc((x.teams || []).join(", ") || "—") + "</td><td>" + esc(trainerName(x.trainerId) || "—") + "</td><td>" + esc(x.place || "—") + "</td></tr>").join("");
  return "<div class=\"print-head\"><img src=\"" + esc(CLUB.logo) + "\" alt=\"\"><div><h1>" + esc(CLUB.fullName) + "</h1><h2>Расписание занятий" + (group === "all" ? "" : " — группа " + esc(group)) + "</h2></div></div>"
    + (items.length ? "<table><thead><tr><th>День</th><th>Время</th><th>Занятие</th><th>Группы</th><th>Тренер</th><th>Место</th></tr></thead><tbody>" + rows + "</tbody></table>" : "<p>Занятий нет.</p>")
    + "<p class=\"print-foot\">Сформировано " + new Date().toLocaleDateString("ru-RU") + ". Расписание может меняться — уточняйте у тренера.</p>";
}
// Печать произвольного документа: содержимое кладётся в #print-area, остальной интерфейс на время печати скрыт (см. @media print).
function printSchedule() { printDocument(printHtml(printGroup)); }
function printDocument(html) {
  document.querySelector("#print-area").innerHTML = html;
  document.body.classList.add("print-schedule");
  const off = () => document.body.classList.remove("print-schedule");
  window.addEventListener("afterprint", off, { once: true });
  const img = document.querySelector("#print-area img"); const go = () => { window.print(); off(); };
  img && !img.complete ? img.addEventListener("load", go, { once: true }) : go();
}
function attText(p) { const a = attStats(p.id), m = attStats(p.id, 30); return a.total ? a.present + " из " + a.total + " (" + a.pct + "%)" + (m.total && m.total !== a.total ? " · за 30 дн.: " + m.pct + "%" : "") : "Нет отметок"; }
function attendanceSummary() {
  const rates = groupRates(30), low = lowAttendance(); if (!rates.length) return "";
  return "<p class=\"resource-line\">Посещаемость за 30 дней: " + rates.map(r => "<strong>" + esc(r.team) + " — " + r.pct + "%</strong>").join(" <i></i> ") + (low.length ? " <i></i> <span class=\"warn\">реже половины занятий: " + low.map(x => esc(x.p.name) + " (" + x.s.pct + "%)").join(", ") + "</span>" : "") + "</p>";
}
function printTools() {
  return "<div class=\"print-tools\"><label>Печать для группы<select id=\"print-group\"><option value=\"all\">Все группы</option>" + TEAMS.map(t => "<option" + (t.id === printGroup ? " selected" : "") + ">" + t.id + "</option>").join("") + "</select></label><button type=\"button\" class=\"ghost-button\" id=\"print-schedule\">ПЕЧАТЬ / PDF</button></div>";
}
