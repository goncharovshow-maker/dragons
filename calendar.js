// Календарь клуба: недельное расписание + исключения (отмена/перенос конкретной даты) + события (каникулы, сборы) + матчи.
// Экспорт в .ics. Файл подключается до app.js; обращения к данным приложения происходят только при вызове функций.
const CAL_KINDS = ["каникулы", "сборы", "событие"];
const ICS_TZ = CLUB.timezone.id;
let calMonth = "";       // "ГГГГ-ММ"
let calSelected = "";    // "ГГГГ-ММ-ДД"
let calGroup = "all";
let calIcsPartners = false; // включать шаги по партнёрам в файл .ics (только администратор)
let calAction = null;    // { kind: "cancel"|"move"|"event", ... } — какая встроенная форма открыта

function exceptionsList() { return state.exceptions || (state.exceptions = []); }
function eventsList() { return state.events || (state.events = []); }
function addDays(s, n) { const d = new Date(s + "T00:00"); d.setDate(d.getDate() + n); return dateStr(d); }
function eachDate(from, to) { const out = []; for (let d = from; d <= to && out.length < 800; d = addDays(d, 1)) out.push(d); return out; }
function ruDate(s) { return new Date(s + "T00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" }); }
function eventCancels(ev, date, teams) { return !!ev.cancels && ev.from <= date && date <= ev.to && (!(ev.teams || []).length || (teams || []).some(t => ev.teams.includes(t))); }

// Что происходит с занятием x в конкретную дату.
function sessionOccurrence(x, date) {
  const moved = exceptionsList().find(e => e.sessionId === x.id && e.type === "move" && e.newDate === date);
  if (moved) return { status: "moved", start: moved.newStart || x.start, end: moved.newEnd || x.end, from: moved.date, ex: moved, reason: moved.note || "" };
  if (weekdayOf(date) !== +x.day) return { status: "none" };
  // Явная отмена/перенос конкретной даты важнее общего события (каникул).
  const ex = exceptionsList().find(e => e.sessionId === x.id && e.date === date);
  if (ex && ex.type === "cancel") return { status: "cancelled", start: x.start, end: x.end, reason: ex.note || "отменено", ex };
  if (ex && ex.type === "move") return { status: "movedAway", start: x.start, end: x.end, to: ex.newDate, reason: ex.note || "", ex };
  const ev = eventsList().find(e => eventCancels(e, date, x.teams));
  if (ev) return { status: "cancelled", start: x.start, end: x.end, reason: ev.title, ev };
  return { status: "normal", start: x.start, end: x.end };
}
// Последняя дата, когда занятие реально проходило (для отметки посещаемости).
function lastHeldDate(x) {
  const today = dateStr(new Date());
  for (let i = 0; i < 60; i++) { const d = addDays(today, -i), o = sessionOccurrence(x, d); if (o.status === "normal" || o.status === "moved") return d; }
  return lastOccurrence(x.day);
}

// Все элементы календаря за период [from, to]: занятия, матчи, события.
function occurrences(from, to) {
  const items = [];
  eachDate(from, to).forEach(date => {
    sessionsList().forEach(x => {
      const o = sessionOccurrence(x, date); if (o.status === "none") return;
      items.push({ type: "session", date, start: o.start, end: o.end, title: x.kind, teams: x.teams || [], place: x.place || "", trainer: trainerName(x.trainerId), notes: x.notes || "", status: o.status, reason: o.reason || "", to: o.to, from: o.from, session: x, ex: o.ex, ev: o.ev });
    });
    eventsList().filter(ev => ev.from <= date && date <= ev.to).forEach(ev => items.push({ type: "event", date, start: "", end: "", title: ev.title, kind: ev.kind, teams: ev.teams || [], place: "", notes: ev.note || "", status: "normal", event: ev }));
  });
  const seenMatch = new Set(); // один и тот же матч может лежать в нескольких сезонах (стартовые данные копируются)
  Object.entries(state.seasons || {}).forEach(([sk, sd]) => (sd.matches || []).forEach((m, i) => {
    if (!m.date || m.date < from || m.date > to) return;
    const mk = [m.date, m.time || "", String(m.opponent || "").toLowerCase()].join("|"); if (seenMatch.has(mk)) return; seenMatch.add(mk);
    items.push({ type: "match", date: m.date, start: m.time || "", end: "", title: "Матч: " + m.opponent, teams: m.team ? [m.team] : [], place: m.venue || "", notes: [matchTournamentName(m), m.homeAway].filter(Boolean).join(" · "), status: m.status === "перенесён" ? "cancelled" : "normal", reason: m.status === "перенесён" ? "перенесён" : "", uid: "match-" + sk + "-" + i, matchStatus: m.status, score: m.score });
  }));
  // Шаги по партнёрам: только для тех, кто видит воронку партнёров (календарь виден и родителям).
  if (can("partners.edit")) Object.values(state.seasons || {}).forEach(sd => (sd.partners || []).forEach(x => {
    if (!x.nextDate || x.nextDate < from || x.nextDate > to) return;
    const done = x.lost || x.stage >= PARTNER_STAGES.length - 1;
    items.push({ type: "partner", date: x.nextDate, start: "", end: "", title: "Шаг: " + x.name, teams: [], place: "", notes: [x.category, x.nextStep].filter(Boolean).join(" · "), status: done ? "cancelled" : "normal", reason: x.lost ? "отказ" : done ? "договор заключён" : "", partner: x, uid: "partner-" + x.id });
  }));
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || ""));
}
function inGroup(it) { return calGroup === "all" || (it.type === "match" && !(it.teams || []).length) || (it.type === "event" && !(it.teams || []).length) || (it.teams || []).includes(calGroup); }

// ---------- интерфейс календаря ----------
function calChip(it) {
  const cls = it.type === "match" ? "match" : it.type === "event" ? "event" : it.type === "partner" ? "partner" : it.status === "moved" ? "moved" : "session";
  const gone = it.status === "cancelled" || it.status === "movedAway";
  const label = it.type === "session" ? (it.start + " " + (it.teams.join("·") || it.title)) : it.type === "match" ? ((it.start ? it.start + " " : "") + "матч") : it.title;
  return "<span class=\"cal-chip " + cls + (gone ? " gone" : "") + "\">" + esc(label) + "</span>";
}
function calendarMarkup() {
  if (!calMonth) calMonth = dateStr(new Date()).slice(0, 7);
  if (!calSelected) calSelected = dateStr(new Date());
  const first = new Date(calMonth + "-01T00:00"), lead = ((first.getDay() || 7) - 1), start = addDays(calMonth + "-01", -lead);
  const gridDates = eachDate(start, addDays(start, 41)).slice(0, Math.ceil((lead + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7) * 7);
  const items = occurrences(gridDates[0], gridDates[gridDates.length - 1]).filter(inGroup), today = dateStr(new Date());
  const cells = gridDates.map(d => {
    const list = items.filter(it => it.date === d), other = !d.startsWith(calMonth);
    return "<button type=\"button\" class=\"cal-day" + (other ? " other" : "") + (d === today ? " today" : "") + (d === calSelected ? " selected" : "") + "\" data-cal-date=\"" + d + "\"><b>" + +d.slice(8) + "</b>" + list.slice(0, 3).map(calChip).join("") + (list.length > 3 ? "<span class=\"cal-more\">+" + (list.length - 3) + "</span>" : "") + "</button>";
  }).join("");
  const label = first.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  return "<p class=\"eyebrow\">КАЛЕНДАРЬ КЛУБА</p><div class=\"cal-head\"><h2>" + esc(label) + "</h2><div class=\"cal-nav\"><button type=\"button\" class=\"ghost-button\" data-cal-nav=\"-1\" aria-label=\"Предыдущий месяц\">‹</button><button type=\"button\" class=\"ghost-button\" data-cal-nav=\"0\">СЕГОДНЯ</button><button type=\"button\" class=\"ghost-button\" data-cal-nav=\"1\" aria-label=\"Следующий месяц\">›</button></div></div>"
    + "<div class=\"cal-tools\"><label>Группа<select id=\"cal-group\"><option value=\"all\">Все группы</option>" + TEAMS.map(t => "<option" + (t.id === calGroup ? " selected" : "") + ">" + t.id + "</option>").join("") + "</select></label>"
    + (can("calendar.edit") ? "<button type=\"button\" class=\"primary-button\" id=\"cal-add-event\">+ СОБЫТИЕ / КАНИКУЛЫ</button>" : "") + (can("partners.edit") ? "<label class=\"check cal-opt\"><input type=\"checkbox\" id=\"cal-ics-partners\"" + (calIcsPartners ? " checked" : "") + "> Шаги по партнёрам — тоже в файл .ics</label>" : "") + "<button type=\"button\" class=\"ghost-button\" id=\"cal-ics\">СКАЧАТЬ В КАЛЕНДАРЬ (.ICS)</button></div>"
    + "<div class=\"cal-legend\"><span class=\"cal-chip session\">занятие</span><span class=\"cal-chip moved\">перенесено</span><span class=\"cal-chip session gone\">отменено</span><span class=\"cal-chip match\">матч</span><span class=\"cal-chip event\">событие</span>" + (can("partners.edit") ? "<span class=\"cal-chip partner\">шаг по партнёру</span>" : "") + "</div>"
    + "<div class=\"cal-weekdays\">" + DAYS.map(d => "<span>" + d + "</span>").join("") + "</div><div class=\"cal-grid\">" + cells + "</div><div id=\"cal-detail\" class=\"cal-detail\">" + dayDetailMarkup() + "</div>";
}
function itemActions(it) {
  if (!can("calendar.edit")) return "";
  if (it.type === "session") {
    if (it.status === "normal") return "<button type=\"button\" class=\"ghost-button\" data-cal-cancel=\"" + it.session.id + "\">ОТМЕНИТЬ</button><button type=\"button\" class=\"ghost-button\" data-cal-move=\"" + it.session.id + "\">ПЕРЕНЕСТИ</button>";
    if (it.ex) return "<button type=\"button\" class=\"ghost-button\" data-cal-restore=\"" + it.ex.id + "\">ВЕРНУТЬ ПО РАСПИСАНИЮ</button>";
    return ""; // отменено событием (каникулы) — правится через событие
  }
  if (it.type === "event") return "<button type=\"button\" class=\"ghost-button\" data-cal-edit-event=\"" + it.event.id + "\">ИЗМЕНИТЬ</button><button type=\"button\" class=\"danger-button\" data-cal-del-event=\"" + it.event.id + "\">УДАЛИТЬ</button>";
  return "";
}
function itemLine(it) {
  const gone = it.status === "cancelled" || it.status === "movedAway";
  let head = it.type === "session" ? esc(it.start + "–" + it.end) + " · " + esc(it.title) : it.type === "match" ? (it.start ? esc(it.start) + " · " : "") + esc(it.title) : it.type === "partner" ? "<b>Шаг по партнёру:</b> " + esc(it.partner.name) : "<b>" + esc(it.kind) + ":</b> " + esc(it.title);
  let note = [];
  if (it.teams.length) note.push("группы " + it.teams.join(", "));
  if (it.trainer) note.push(it.trainer);
  if (it.place) note.push(it.place);
  if (it.type === "match" && it.matchStatus) note.push(it.matchStatus + (it.score ? " " + it.score : ""));
  if (it.status === "moved") note.push("перенесено с " + ruDate(it.from));
  if (it.status === "movedAway") note.push("перенесено на " + ruDate(it.to));
  if (it.status === "cancelled" && it.reason) note.push("причина: " + it.reason);
  if (it.type === "event" && it.event.cancels) note.push("занятия групп не проводятся");
  return "<li class=\"cal-item" + (gone ? " gone" : "") + "\"><div><p>" + head + "</p><small>" + esc(note.join(" · ")) + "</small></div><div class=\"cal-item-actions\">" + itemActions(it) + "</div>" + actionForm(it) + "</li>";
}
function actionForm(it) {
  if (!calAction || it.type !== "session" || !it.session || calAction.sessionId !== it.session.id || calAction.date !== it.date) return "";
  if (calAction.kind === "cancel") return "<form class=\"cal-inline\" id=\"cal-cancel-form\"><input name=\"note\" maxlength=\"120\" placeholder=\"Причина (необязательно)\"><button class=\"primary-button\">ОТМЕНИТЬ ЗАНЯТИЕ</button><button type=\"button\" class=\"ghost-button\" data-cal-close>НЕ НАДО</button></form>";
  if (calAction.kind === "move") return "<form class=\"cal-inline\" id=\"cal-move-form\"><label>Новая дата<input required type=\"date\" name=\"newDate\" value=\"" + attr(it.date) + "\"></label><label>Начало<input required type=\"time\" name=\"newStart\" value=\"" + attr(it.start) + "\"></label><label>Конец<input required type=\"time\" name=\"newEnd\" value=\"" + attr(it.end) + "\"></label><label class=\"grow\">Причина<input name=\"note\" maxlength=\"120\" placeholder=\"Необязательно\"></label><button class=\"primary-button\">ПЕРЕНЕСТИ</button><button type=\"button\" class=\"ghost-button\" data-cal-close>НЕ НАДО</button></form>";
  return "";
}
function eventFormMarkup(ev) {
  const e = ev || { kind: "каникулы", title: "", from: calSelected, to: calSelected, teams: [], cancels: true, note: "" };
  return "<form class=\"match-form cal-event-form\" id=\"cal-event-form\" data-id=\"" + attr(e.id || "") + "\"><label>Тип<select name=\"kind\">" + CAL_KINDS.map(k => "<option" + (k === e.kind ? " selected" : "") + ">" + k + "</option>").join("") + "</select></label><label>Название<input required maxlength=\"80\" name=\"title\" placeholder=\"Например, Зимние каникулы\" value=\"" + attr(e.title) + "\"></label><label>С даты<input required type=\"date\" name=\"from\" value=\"" + attr(e.from) + "\"></label><label>По дату<input required type=\"date\" name=\"to\" value=\"" + attr(e.to) + "\"></label>"
    + "<fieldset class=\"team-checks\"><legend>Группы (не выбрано — все)</legend>" + TEAMS.map(g => "<label class=\"check\"><input type=\"checkbox\" name=\"teams\" value=\"" + g.id + "\"" + ((e.teams || []).includes(g.id) ? " checked" : "") + "> " + g.id + "</label>").join("") + "</fieldset>"
    + "<label class=\"check wide\"><input type=\"checkbox\" name=\"cancels\"" + (e.cancels ? " checked" : "") + "> В эти дни обычные занятия этих групп не проводятся</label><label class=\"wide\">Заметки<input maxlength=\"200\" name=\"note\" placeholder=\"Необязательно\" value=\"" + attr(e.note) + "\"></label><div class=\"match-actions wide\"><button class=\"primary-button\">СОХРАНИТЬ</button><button type=\"button\" class=\"ghost-button\" data-cal-close>ОТМЕНА</button></div></form>";
}
function dayDetailMarkup() {
  const day = occurrences(calSelected, calSelected).filter(inGroup);
  const form = calAction && calAction.kind === "event" ? eventFormMarkup(calAction.event) : "";
  return "<h3>" + esc(new Date(calSelected + "T00:00").toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })) + "</h3>" + (day.length ? "<ul class=\"cal-items\">" + day.map(itemLine).join("") + "</ul>" : "<p class=\"empty\">На этот день ничего не запланировано.</p>") + form;
}
function readEventForm(f) {
  const fd = new FormData(f); let from = fd.get("from"), to = fd.get("to"); if (to < from) [from, to] = [to, from];
  return { kind: fd.get("kind"), title: String(fd.get("title") || "").trim(), from, to, teams: fd.getAll("teams"), cancels: fd.get("cancels") === "on", note: fd.get("note") || "" };
}
function renderCalendar() {
  const box = document.querySelector("#calendar-content"); box.innerHTML = calendarMarkup();
  box.querySelectorAll("[data-cal-nav]").forEach(b => b.addEventListener("click", () => { const n = +b.dataset.calNav; if (!n) { calMonth = dateStr(new Date()).slice(0, 7); calSelected = dateStr(new Date()); } else { const d = new Date(calMonth + "-01T00:00"); d.setMonth(d.getMonth() + n); calMonth = dateStr(d).slice(0, 7); calSelected = calMonth + "-01"; } calAction = null; renderCalendar(); }));
  box.querySelectorAll("[data-cal-date]").forEach(b => b.addEventListener("click", () => { calSelected = b.dataset.calDate; if (!calSelected.startsWith(calMonth)) calMonth = calSelected.slice(0, 7); calAction = null; renderCalendar(); }));
  on("#cal-group", "change", e => { calGroup = e.target.value; renderCalendar(); });
  on("#cal-ics", "click", () => { downloadICS(); });
  on("#cal-ics-partners", "change", e => { calIcsPartners = e.target.checked; });
  on("#cal-add-event", "click", () => { calAction = { kind: "event" }; renderCalendar(); document.querySelector("#cal-event-form")?.scrollIntoView({ block: "nearest" }); });
  box.querySelectorAll("[data-cal-close]").forEach(b => b.addEventListener("click", () => { calAction = null; renderCalendar(); }));
  box.querySelectorAll("[data-cal-cancel]").forEach(b => b.addEventListener("click", () => { calAction = { kind: "cancel", sessionId: b.dataset.calCancel, date: calSelected }; renderCalendar(); }));
  box.querySelectorAll("[data-cal-move]").forEach(b => b.addEventListener("click", () => { calAction = { kind: "move", sessionId: b.dataset.calMove, date: calSelected }; renderCalendar(); }));
  box.querySelectorAll("[data-cal-restore]").forEach(b => b.addEventListener("click", () => { state.exceptions = exceptionsList().filter(e => e.id !== b.dataset.calRestore); calAction = null; persist(); renderCalendar(); }));
  box.querySelectorAll("[data-cal-edit-event]").forEach(b => b.addEventListener("click", () => { calAction = { kind: "event", event: eventsList().find(e => e.id === b.dataset.calEditEvent) }; renderCalendar(); }));
  box.querySelectorAll("[data-cal-del-event]").forEach(b => b.addEventListener("click", () => { const ev = eventsList().find(e => e.id === b.dataset.calDelEvent); if (!ev || !confirm("Удалить «" + ev.title + "»?")) return; state.events = eventsList().filter(e => e.id !== ev.id); calAction = null; persist(); renderCalendar(); }));
  on("#cal-cancel-form", "submit", e => { e.preventDefault(); if (!can("calendar.edit")) return; exceptionsList().push({ id: newId(), sessionId: calAction.sessionId, date: calAction.date, type: "cancel", note: String(new FormData(e.currentTarget).get("note") || "").trim() }); calAction = null; persist(); renderCalendar(); });
  on("#cal-move-form", "submit", e => {
    e.preventDefault(); if (!can("calendar.edit")) return; const fd = new FormData(e.currentTarget);
    if (toMin(fd.get("newEnd")) <= toMin(fd.get("newStart"))) { alert("Время окончания должно быть позже начала."); return; }
    exceptionsList().push({ id: newId(), sessionId: calAction.sessionId, date: calAction.date, type: "move", newDate: fd.get("newDate"), newStart: fd.get("newStart"), newEnd: fd.get("newEnd"), note: String(fd.get("note") || "").trim() });
    calAction = null; persist(); renderCalendar();
  });
  on("#cal-event-form", "submit", e => {
    e.preventDefault(); if (!can("calendar.edit")) return; const v = readEventForm(e.currentTarget); if (!v.title) return; const id = e.currentTarget.dataset.id;
    if (id) Object.assign(eventsList().find(q => q.id === id) || {}, v); else eventsList().push({ id: newId(), ...v });
    calAction = null; persist(); renderCalendar();
  });
}
function openCalendar() { calAction = null; renderCalendar(); document.querySelector("#calendar-dialog").showModal(); }

// ---------- экспорт в .ics ----------
function icsEsc(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
function icsFold(line) {
  const enc = new TextEncoder(), parts = []; let cur = "", n = 0, lim = 75;
  for (const ch of line) { const b = enc.encode(ch).length; if (n + b > lim) { parts.push(cur); cur = ch; n = b; lim = 74; } else { cur += ch; n += b; } }
  parts.push(cur); return parts.join("\r\n ");
}
const icsDate = d => d.replace(/-/g, "");
const icsTime = t => { const [h, m] = t.split(":"); return h.padStart(2, "0") + m + "00"; };
function icsAddMinutes(date, time, mins) { const d = new Date(date + "T" + time.padStart(5, "0")); d.setMinutes(d.getMinutes() + mins); return { date: dateStr(d), time: String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") }; }
function buildICS(from, to, group, withMatches, withPartners = false) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""), L = [];
  const push = l => L.push(icsFold(l));
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//" + CLUB.icsProduct + "//Command Center//RU", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:" + icsEsc(CLUB.name + (group === "all" ? "" : " · " + group)), "X-WR-TIMEZONE:" + ICS_TZ,
    "BEGIN:VTIMEZONE", "TZID:" + ICS_TZ, "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:" + CLUB.timezone.offset, "TZOFFSETTO:" + CLUB.timezone.offset, "TZNAME:" + CLUB.timezone.abbr, "END:STANDARD", "END:VTIMEZONE"].forEach(push);
  const saved = calGroup; calGroup = group;
  const items = occurrences(from, to).filter(it => inGroup(it) && (withMatches || it.type !== "match") && (withPartners || it.type !== "partner")); calGroup = saved;
  const seenEvents = new Set(), seenUids = new Set(); let count = 0;
  items.forEach(it => {
    if (it.status === "movedAway") return; // перенос выгружается одним событием на новую дату с прежним UID
    let uid, dtstart, dtend, summary, desc = [], status = "CONFIRMED";
    if (it.type === "session") {
      uid = it.session.id + "-" + (it.status === "moved" ? it.from : it.date) + "@" + CLUB.icsDomain;
      dtstart = "DTSTART;TZID=" + ICS_TZ + ":" + icsDate(it.date) + "T" + icsTime(it.start); dtend = "DTEND;TZID=" + ICS_TZ + ":" + icsDate(it.date) + "T" + icsTime(it.end);
      summary = CLUB.name + ": " + it.title + (it.teams.length ? " (" + it.teams.join(", ") + ")" : "");
      if (it.trainer) desc.push("Тренер: " + it.trainer); if (it.teams.length) desc.push("Группы: " + it.teams.join(", ")); if (it.notes) desc.push(it.notes);
      if (it.status === "moved") desc.push("Перенесено с " + ruDate(it.from) + (it.reason ? ": " + it.reason : ""));
      if (it.status === "cancelled") { status = "CANCELLED"; summary = "ОТМЕНЕНО: " + summary; if (it.reason) desc.push("Причина: " + it.reason); }
    } else if (it.type === "match") {
      uid = it.uid + "@" + CLUB.icsDomain; summary = "Матч: " + CLUB.name + " — " + it.title.replace(/^Матч: /, "");
      if (it.start) { const e = icsAddMinutes(it.date, it.start, 120); dtstart = "DTSTART;TZID=" + ICS_TZ + ":" + icsDate(it.date) + "T" + icsTime(it.start); dtend = "DTEND;TZID=" + ICS_TZ + ":" + icsDate(e.date) + "T" + icsTime(e.time); }
      else { dtstart = "DTSTART;VALUE=DATE:" + icsDate(it.date); dtend = "DTEND;VALUE=DATE:" + icsDate(addDays(it.date, 1)); }
      if (it.notes) desc.push(it.notes); if (it.status === "cancelled") { status = "CANCELLED"; summary = "ОТМЕНЁН/ПЕРЕНЕСЁН: " + summary; }
    } else if (it.type === "partner") {
      uid = it.uid + "@" + CLUB.icsDomain; summary = "Шаг по партнёру: " + it.partner.name;
      dtstart = "DTSTART;VALUE=DATE:" + icsDate(it.date); dtend = "DTEND;VALUE=DATE:" + icsDate(addDays(it.date, 1));
      desc.push("Категория: " + it.partner.category, "Этап: " + PARTNER_STAGES[it.partner.stage]); if (it.partner.nextStep) desc.push("Следующий шаг: " + it.partner.nextStep);
      if (it.status === "cancelled") { status = "CANCELLED"; summary = "НЕАКТУАЛЬНО: " + summary; if (it.reason) desc.push("Причина: " + it.reason); }
    } else {
      if (seenEvents.has(it.event.id)) return; seenEvents.add(it.event.id);
      uid = "event-" + it.event.id + "@" + CLUB.icsDomain; summary = it.kind[0].toUpperCase() + it.kind.slice(1) + ": " + it.title;
      dtstart = "DTSTART;VALUE=DATE:" + icsDate(it.event.from); dtend = "DTEND;VALUE=DATE:" + icsDate(addDays(it.event.to, 1));
      if (it.teams.length) desc.push("Группы: " + it.teams.join(", ")); if (it.notes) desc.push(it.notes); if (it.event.cancels) desc.push("Обычные занятия в эти дни не проводятся.");
    }
    if (seenUids.has(uid)) return; seenUids.add(uid);
    ["BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + stamp, dtstart, dtend, "SUMMARY:" + icsEsc(summary), desc.length ? "DESCRIPTION:" + icsEsc(desc.join("\n")) : "", it.place ? "LOCATION:" + icsEsc(it.place) : "", "STATUS:" + status, "END:VEVENT"].filter(Boolean).forEach(push);
    count++;
  });
  push("END:VCALENDAR");
  return { text: L.join("\r\n") + "\r\n", count };
}
function downloadICS(monthsAhead = 6) {
  const from = dateStr(new Date()), to = addDays(from, Math.round(monthsAhead * 30.5));
  const { text, count } = buildICS(from, to, calGroup, true, calIcsPartners && can("partners.edit"));
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" })), download: CLUB.filePrefix + (calGroup === "all" ? "" : "-" + calGroup) + ".ics" });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return count;
}
