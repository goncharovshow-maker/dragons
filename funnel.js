// Сектор «Дети»: воронка ребёнка. Этапы взяты из существующего блока «Воронка ребёнка в клубе».
// Записи создаёт пользователь вручную и хранит по сезонам (season().funnel); стартовых данных нет.
// Файл подключается до app.js; к данным приложения обращается только при вызове.
const FUNNEL_STAGES = ["Бесплатная пробная тренировка", "Решение семьи", "Абонемент", "Регулярные занятия", "Удержание"];
let funnelFilter = "all"; // "all" | "0".."4" | "lost"

function funnelList() { const d = season(); return d.funnel || (d.funnel = []); }
function funnelById(id) { return funnelList().find(x => x.id === id); }
function normalizeFunnel(d, pids = new Set()) {
  const str = v => typeof v === "string" ? v : "", st = v => Number.isInteger(+v) && +v >= 0 && +v < FUNNEL_STAGES.length && v !== "" && v !== null ? +v : 0;
  d.funnel = (Array.isArray(d.funnel) ? d.funnel : []).filter(x => x && typeof x.name === "string" && x.name.trim()).map(x => {
    const stage = st(x.stage), log = (Array.isArray(x.log) ? x.log : []).filter(l => l && DATE_RE.test(l.date)).map(l => ({ stage: st(l.stage), date: l.date, lost: !!l.lost, reason: str(l.reason), note: str(l.note) }));
    return { id: cleanId(x.id), playerId: pids.has(x.playerId) ? x.playerId : "", name: x.name.trim(), contact: str(x.contact), source: str(x.source), notes: str(x.notes), stage, reached: Math.max(stage, st(x.reached)), lost: !!x.lost, lostReason: str(x.lostReason), lostAt: st(x.lostAt), created: DATE_RE.test(x.created) ? x.created : "", log };
  });
}
function funnelStats() {
  const list = funnelList(), reached = FUNNEL_STAGES.map((_, k) => list.filter(x => x.reached >= k).length), now = FUNNEL_STAGES.map((_, k) => list.filter(x => !x.lost && x.stage === k).length);
  const lost = list.filter(x => x.lost), reasons = {}; lost.forEach(x => { const r = (x.lostReason || "без причины").trim().toLowerCase(); reasons[r] = (reasons[r] || 0) + 1; });
  return { list, reached, now, lost, reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]) };
}
function daysInStage(x) { const last = x.log.length ? x.log[x.log.length - 1].date : x.created; return last ? Math.max(0, Math.round((new Date(dateStr(new Date()) + "T00:00") - new Date(last + "T00:00")) / 864e5)) : null; }

function funnelFields(x = {}) {
  return "<label class=\"wide\">Имя ребёнка<input required maxlength=\"80\" name=\"name\" placeholder=\"Например, Иван Петров\" value=\"" + attr(x.name) + "\"></label>"
    + "<label>Контакт родителя<input maxlength=\"100\" name=\"contact\" placeholder=\"Имя, телефон — необязательно\" value=\"" + attr(x.contact) + "\"></label>"
    + "<label>Откуда узнали<input maxlength=\"100\" name=\"source\" placeholder=\"Необязательно\" value=\"" + attr(x.source) + "\"></label>"
    + (x.id ? "" : "<label>Начальный этап<select name=\"stage\">" + FUNNEL_STAGES.map((n, i) => "<option value=\"" + i + "\">" + (i + 1) + ". " + n + "</option>").join("") + "</select></label><span></span>")
    + "<label class=\"wide\">Заметки<input maxlength=\"300\" name=\"notes\" placeholder=\"Необязательно\" value=\"" + attr(x.notes) + "\"></label>";
}
function funnelMarkup() {
  const st = funnelStats(), base = Math.max(st.reached[0], 1), ed = can("funnel.edit");
  const rows = FUNNEL_STAGES.map((n, k) => { const conv = k && st.reached[k - 1] ? Math.round(st.reached[k] / st.reached[k - 1] * 100) + "% от предыдущего этапа" : k ? "нет данных" : "начало воронки"; return "<div class=\"fn-stage\"><span class=\"fn-name\">" + (k + 1) + ". " + esc(n) + "</span><div class=\"fn-bar\"><i style=\"width:" + Math.round(st.reached[k] / base * 100) + "%\"></i></div><b>" + st.reached[k] + "</b><small>сейчас на этапе: " + st.now[k] + " · " + conv + "</small></div>"; }).join("");
  const shown = st.list.filter(x => funnelFilter === "all" ? true : funnelFilter === "lost" ? x.lost : !x.lost && String(x.stage) === funnelFilter);
  const chip = (v, label, n) => "<button type=\"button\" class=\"fn-chip" + (funnelFilter === v ? " active" : "") + "\" data-fn-filter=\"" + v + "\">" + label + " <b>" + n + "</b></button>";
  const chips = chip("all", "Все", st.list.length) + FUNNEL_STAGES.map((_, k) => chip(String(k), String(k + 1), st.now[k])).join("") + chip("lost", "Отказы", st.lost.length);
  const cards = shown.length ? "<div class=\"player-cards\">" + shown.map(x => { const d = daysInStage(x); return "<button type=\"button\" class=\"player-card fn-card" + (x.lost ? " lost" : "") + "\" data-funnel=\"" + x.id + "\"><b>" + (x.lost ? "×" : x.stage + 1) + "</b><span>" + esc(x.name) + "</span><small>" + (x.lost ? "отказ" + (x.lostReason ? ": " + esc(x.lostReason) : "") : esc(FUNNEL_STAGES[x.stage])) + (d !== null && !x.lost ? " · " + d + " " + plural(d, "день", "дня", "дней") : "") + "</small></button>"; }).join("") + "</div>" : "<p class=\"empty\">" + (st.list.length ? "В этой выборке никого нет." : "Воронка пока пуста. " + (ed ? "Добавьте ребёнка, который пришёл на пробную тренировку, и двигайте его по этапам." : "")) + "</p>";
  return "<section class=\"players-section funnel-section\"><div class=\"section-heading\"><div><p class=\"eyebrow\">ВОРОНКА РЕБЁНКА</p><h3>Путь ребёнка в клубе</h3></div>" + (ed ? "<button type=\"button\" class=\"primary-button\" id=\"add-funnel-toggle\">+ РЕБЁНОК</button>" : "") + "</div>"
    + "<div class=\"fn-stages\">" + rows + "</div>"
    + "<p class=\"resource-line\">Всего в воронке: " + st.list.length + " <i></i> отказались: <strong>" + st.lost.length + "</strong>" + (st.reasons.length ? " (" + st.reasons.map(([r, n]) => esc(r) + " — " + n).join(", ") + ")" : "") + "</p>"
    + (ed ? "<form class=\"match-form\" id=\"funnel-form\" hidden>" + funnelFields() + "<button class=\"primary-button\">СОХРАНИТЬ</button></form>" : "") + "<div class=\"fn-chips\">" + chips + "</div>" + cards + "</section>";
}
function bindFunnel() {
  document.querySelectorAll("[data-fn-filter]").forEach(b => b.addEventListener("click", () => { funnelFilter = b.dataset.fnFilter; render(); }));
  on("#add-funnel-toggle", "click", () => { const f = document.querySelector("#funnel-form"); f.hidden = !f.hidden; });
  on("#funnel-form", "submit", e => {
    e.preventDefault(); if (!can("funnel.edit")) return; const fd = new FormData(e.currentTarget), s = k => String(fd.get(k) || "").trim(), name = s("name"); if (!name) return;
    const stage = Math.min(FUNNEL_STAGES.length - 1, Math.max(0, +fd.get("stage") || 0)), today = dateStr(new Date());
    funnelList().push({ id: newId(), name, contact: s("contact"), source: s("source"), notes: s("notes"), stage, reached: stage, lost: false, lostReason: "", lostAt: 0, created: today, log: [{ stage, date: today, lost: false, reason: "" }] }); persist();
  });
  document.querySelectorAll("[data-funnel]").forEach(b => b.addEventListener("click", () => openFunnel(b.dataset.funnel)));
}
function moveFunnel(x, to) { x.stage = to; x.reached = Math.max(x.reached, to); x.log.push({ stage: to, date: dateStr(new Date()), lost: false, reason: "" }); persist(); openFunnel(x.id); }
function openFunnel(id) {
  const x = funnelById(id); if (!x) return; const ed = can("funnel.edit"), box = document.querySelector("#funnel-dialog-content"), d = daysInStage(x), linked = x.playerId ? playersList().find(p => p.id === x.playerId) : null, canPromote = ed && canPromoteFunnel(x);
  const timeline = x.log.map(l => "<li>" + esc(date(l.date)) + " — " + (l.lost ? "<b>отказ</b>" + (l.reason ? " (" + esc(l.reason) + ")" : "") + " на этапе «" + esc(FUNNEL_STAGES[l.stage]) + "»" : "этап «" + esc(FUNNEL_STAGES[l.stage]) + "»") + (l.note ? " — " + esc(l.note) : "") + "</li>").join("");
  box.innerHTML = "<p class=\"eyebrow\">КАРТОЧКА РЕБЁНКА В ВОРОНКЕ</p><h2>" + esc(x.name) + "</h2><div class=\"match-score-large fn-now\">" + (x.lost ? "Отказ" : (x.stage + 1) + ". " + esc(FUNNEL_STAGES[x.stage])) + "</div>"
    + "<dl class=\"match-info\"><div><dt>Контакт родителя</dt><dd>" + esc(x.contact || "Не указан") + "</dd></div><div><dt>Откуда узнали</dt><dd>" + esc(x.source || "Не указано") + "</dd></div><div><dt>В составе клуба</dt><dd>" + (linked ? esc(linked.name + " · группа " + linked.team) : "Нет") + "</dd></div>"
    + "<div><dt>Дошёл до этапа</dt><dd>" + (x.reached + 1) + ". " + esc(FUNNEL_STAGES[x.reached]) + "</dd></div><div><dt>" + (x.lost ? "Причина отказа" : "На этапе") + "</dt><dd>" + (x.lost ? esc(x.lostReason || "Не указана") : d !== null ? d + " " + plural(d, "день", "дня", "дней") : "—") + "</dd></div>"
    + "<div class=\"wide-info\"><dt>Заметки</dt><dd>" + esc(x.notes || "—") + "</dd></div><div class=\"wide-info\"><dt>История</dt><dd><ul class=\"fn-log\">" + timeline + "</ul></dd></div></dl>";
  if (ed) {
    box.insertAdjacentHTML("beforeend", "<div class=\"match-actions\">"
      + (x.lost ? "<button type=\"button\" class=\"primary-button\" data-fn=\"restore\">ВЕРНУТЬ В ВОРОНКУ</button>" : (x.stage < FUNNEL_STAGES.length - 1 ? "<button type=\"button\" class=\"primary-button\" data-fn=\"next\">СЛЕДУЮЩИЙ ЭТАП →</button>" : "") + (x.stage > 0 ? "<button type=\"button\" class=\"ghost-button\" data-fn=\"prev\">← ШАГ НАЗАД</button>" : "") + "<button type=\"button\" class=\"ghost-button\" data-fn=\"lost\">ОТКАЗ</button>")
      + (canPromote ? "<button type=\"button\" class=\"primary-button\" data-fn=\"promote\">ПЕРЕВЕСТИ В ИГРОКИ</button>" : "") + "<button type=\"button\" class=\"ghost-button\" data-fn=\"edit\">ИЗМЕНИТЬ</button><button type=\"button\" class=\"danger-button\" data-fn=\"delete\">УДАЛИТЬ</button></div><form class=\"cal-inline\" id=\"fn-lost-form\" hidden><input name=\"reason\" maxlength=\"120\" placeholder=\"Причина отказа (необязательно)\"><button class=\"primary-button\">ЗАФИКСИРОВАТЬ ОТКАЗ</button></form>" + (canPromote ? "<form class=\"cal-inline\" id=\"fn-promote-form\" hidden><label>Группа<select name=\"team\">" + TEAMS.map(t => "<option>" + t.id + "</option>").join("") + "</select></label><label>Амплуа<select name=\"position\">" + POSITIONS.map(p => "<option" + (p === "нападающий" ? " selected" : "") + ">" + p + "</option>").join("") + "</select></label><label>Номер<input type=\"number\" min=\"0\" max=\"99\" name=\"number\" placeholder=\"—\"></label><button class=\"primary-button\">ДОБАВИТЬ В СОСТАВ</button></form>" : ""));
    const act = (n, fn) => { const b = box.querySelector("[data-fn=" + n + "]"); if (b) b.addEventListener("click", fn); };
    act("next", () => moveFunnel(x, x.stage + 1)); act("prev", () => moveFunnel(x, x.stage - 1));
    act("restore", () => { x.lost = false; x.lostReason = ""; x.log.push({ stage: x.stage, date: dateStr(new Date()), lost: false, reason: "" }); persist(); openFunnel(id); });
    act("lost", () => { const f = box.querySelector("#fn-lost-form"); f.hidden = !f.hidden; if (!f.hidden) f.reason.focus(); });
    on("#fn-lost-form", "submit", e => { e.preventDefault(); const r = String(new FormData(e.currentTarget).get("reason") || "").trim(); x.lost = true; x.lostReason = r; x.lostAt = x.stage; x.log.push({ stage: x.stage, date: dateStr(new Date()), lost: true, reason: r }); persist(); openFunnel(id); });
    act("promote", () => { const f = box.querySelector("#fn-promote-form"); f.hidden = !f.hidden; });
    on("#fn-promote-form", "submit", e => { e.preventDefault(); promoteFunnel(x, new FormData(e.currentTarget)); });
    act("edit", () => editFunnel(id));
    act("delete", () => { if (!confirm("Удалить «" + x.name + "» из воронки?")) return; season().funnel = funnelList().filter(q => q.id !== id); document.querySelector("#funnel-dialog").close(); persist(); });
  }
  const dlg = document.querySelector("#funnel-dialog"); if (!dlg.open) dlg.showModal();
}
// Перевод ребёнка из воронки в состав: создаётся игрок (или связывается существующий с таким же именем).
// Перевести можно ребёнка, который дошёл до этапа «Абонемент» и дальше, не отказался и ещё не связан с игроком.
function canPromoteFunnel(x) { return can("players.edit") && !x.playerId && !x.lost && x.stage >= 2; }
function promoteFunnel(x, fd) {
  if (!canPromoteFunnel(x)) return; const today = dateStr(new Date()), same = playersList().find(p => p.name.toLowerCase() === x.name.toLowerCase());
  if (same) { if (!confirm("Игрок «" + same.name + "» уже есть в составе (группа " + same.team + "). Связать карточку воронки с ним, не создавая дубль?")) return; x.playerId = same.id; x.log.push({ stage: x.stage, date: today, lost: false, reason: "", note: "связан с игроком из состава" }); }
  else { const num = String(fd.get("number") || ""), p = { id: newId(), name: x.name, team: String(fd.get("team")), position: String(fd.get("position")), number: num === "" ? "" : String(Math.min(99, Math.max(0, Math.round(+num) || 0))), notes: "Пришёл через воронку " + ruDate(today) }; playersList().push(p); x.playerId = p.id; x.log.push({ stage: x.stage, date: today, lost: false, reason: "", note: "добавлен в состав, группа " + p.team }); }
  persist(); openFunnel(x.id);
}
function editFunnel(id) {
  const x = funnelById(id), box = document.querySelector("#funnel-dialog-content");
  box.innerHTML = "<p class=\"eyebrow\">РЕДАКТИРОВАНИЕ</p><h2>" + esc(x.name) + "</h2><form class=\"match-form\" id=\"edit-funnel-form\">" + funnelFields(x) + "<div class=\"match-actions wide\"><button class=\"primary-button\">СОХРАНИТЬ</button><button type=\"button\" class=\"ghost-button\" id=\"cancel-fn-edit\">ОТМЕНА</button></div></form>";
  box.querySelector("#cancel-fn-edit").addEventListener("click", () => openFunnel(id));
  box.querySelector("#edit-funnel-form").addEventListener("submit", e => { e.preventDefault(); if (!can("funnel.edit")) return; const fd = new FormData(e.currentTarget), s = k => String(fd.get(k) || "").trim(); if (!s("name")) return; Object.assign(x, { name: s("name"), contact: s("contact"), source: s("source"), notes: s("notes") }); persist(); openFunnel(id); });
}
