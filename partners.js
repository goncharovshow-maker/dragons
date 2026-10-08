// Сектор «Партнёры»: воронка «Поиск → Переговоры → Договор». Записи вносит пользователь вручную, хранятся по сезонам (season().partners).
// Стартовых партнёров нет. Денежные суммы намеренно не учитываются: финансовые показатели не выводятся.
// Категории соответствуют миссиям сектора (партнёры, инвесторы, гранты, бартер, мероприятия). Файл подключается до ui.js.
const PARTNER_STAGES = ["Поиск", "Переговоры", "Договор"];
const PARTNER_CATEGORIES = ["Партнёр", "Инвестор", "Грант", "Бартер", "Мероприятие", "Другое"];
let partnerFilter = "all"; // "all" | "0".."2" | "lost"

function partnersList() { const d = season(); return d.partners || (d.partners = []); }
function partnerById(id) { return partnersList().find(x => x.id === id); }
function normalizePartners(d) {
  const str = v => typeof v === "string" ? v : "", st = v => Number.isInteger(+v) && +v >= 0 && +v < PARTNER_STAGES.length && v !== "" && v !== null ? +v : 0;
  d.partners = (Array.isArray(d.partners) ? d.partners : []).filter(x => x && typeof x.name === "string" && x.name.trim()).map(x => {
    const stage = st(x.stage), log = (Array.isArray(x.log) ? x.log : []).filter(l => l && DATE_RE.test(l.date)).map(l => ({ stage: st(l.stage), date: l.date, lost: !!l.lost, reason: str(l.reason) }));
    return { id: cleanId(x.id), name: x.name.trim(), category: PARTNER_CATEGORIES.includes(x.category) ? x.category : PARTNER_CATEGORIES[0], contact: str(x.contact), pack: str(x.pack), nextStep: str(x.nextStep), nextDate: DATE_RE.test(x.nextDate) ? x.nextDate : "", notes: str(x.notes), stage, reached: Math.max(stage, st(x.reached)), lost: !!x.lost, lostReason: str(x.lostReason), created: DATE_RE.test(x.created) ? x.created : "", log };
  });
}
function partnerStats() {
  const list = partnersList(), reached = PARTNER_STAGES.map((_, k) => list.filter(x => x.reached >= k).length), now = PARTNER_STAGES.map((_, k) => list.filter(x => !x.lost && x.stage === k).length);
  const lost = list.filter(x => x.lost), reasons = {}; lost.forEach(x => { const r = (x.lostReason || "без причины").trim().toLowerCase(); reasons[r] = (reasons[r] || 0) + 1; });
  return { list, reached, now, lost, reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]) };
}
// Просрочен следующий шаг: дата в прошлом у действующего (не отказавшего и не заключённого) контакта.
function partnerOverdue(x) { return !x.lost && x.stage < PARTNER_STAGES.length - 1 && !!x.nextDate && x.nextDate < dateStr(new Date()); }

function partnerFields(x = {}) {
  return "<label class=\"wide\">Организация / контакт<input required maxlength=\"100\" name=\"name\" placeholder=\"Название организации\" value=\"" + attr(x.name) + "\"></label>"
    + "<label>Категория<select name=\"category\">" + PARTNER_CATEGORIES.map(c => "<option" + (c === (x.category || PARTNER_CATEGORIES[0]) ? " selected" : "") + ">" + c + "</option>").join("") + "</select></label>"
    + (x.id ? "<span></span>" : "<label>Начальный этап<select name=\"stage\">" + PARTNER_STAGES.map((n, i) => "<option value=\"" + i + "\">" + (i + 1) + ". " + n + "</option>").join("") + "</select></label>")
    + "<label>Контактное лицо<input maxlength=\"120\" name=\"contact\" placeholder=\"Имя, телефон, почта\" value=\"" + attr(x.contact) + "\"></label>"
    + "<label>Партнёрский пакет<input maxlength=\"120\" name=\"pack\" placeholder=\"Какой пакет обсуждается\" value=\"" + attr(x.pack) + "\"></label>"
    + "<label>Следующий шаг<input maxlength=\"140\" name=\"nextStep\" placeholder=\"Например, отправить предложение\" value=\"" + attr(x.nextStep) + "\"></label>"
    + "<label>Срок шага<input type=\"date\" name=\"nextDate\" value=\"" + attr(x.nextDate) + "\"></label>"
    + "<label class=\"wide\">Заметки<input maxlength=\"300\" name=\"notes\" placeholder=\"Необязательно\" value=\"" + attr(x.notes) + "\"></label>";
}
function readPartner(form) { const fd = new FormData(form), s = k => String(fd.get(k) || "").trim(); return { name: s("name"), category: s("category"), contact: s("contact"), pack: s("pack"), nextStep: s("nextStep"), nextDate: s("nextDate"), notes: s("notes") }; }
function partnersMarkup() {
  const st = partnerStats(), base = Math.max(st.reached[0], 1);
  const rows = PARTNER_STAGES.map((n, k) => { const conv = k && st.reached[k - 1] ? Math.round(st.reached[k] / st.reached[k - 1] * 100) + "% от предыдущего этапа" : k ? "нет данных" : "начало воронки"; return "<div class=\"fn-stage\"><span class=\"fn-name\">" + (k + 1) + ". " + esc(n) + "</span><div class=\"fn-bar\"><i style=\"width:" + Math.round(st.reached[k] / base * 100) + "%\"></i></div><b>" + st.reached[k] + "</b><small>сейчас на этапе: " + st.now[k] + " · " + conv + "</small></div>"; }).join("");
  const shown = st.list.filter(x => partnerFilter === "all" ? true : partnerFilter === "lost" ? x.lost : !x.lost && String(x.stage) === partnerFilter);
  const chip = (v, label, n) => "<button type=\"button\" class=\"fn-chip" + (partnerFilter === v ? " active" : "") + "\" data-pn-filter=\"" + v + "\">" + label + " <b>" + n + "</b></button>";
  const chips = chip("all", "Все", st.list.length) + PARTNER_STAGES.map((n, k) => chip(String(k), n, st.now[k])).join("") + chip("lost", "Отказы", st.lost.length);
  const overdue = st.list.filter(partnerOverdue).length;
  const cards = shown.length ? "<div class=\"player-cards\">" + shown.map(x => "<button type=\"button\" class=\"player-card fn-card" + (x.lost ? " lost" : "") + "\" data-partner=\"" + x.id + "\"><b>" + (x.lost ? "×" : x.stage + 1) + "</b><span>" + esc(x.name) + "</span><small>" + esc(x.category) + " · " + (x.lost ? "отказ" + (x.lostReason ? ": " + esc(x.lostReason) : "") : esc(PARTNER_STAGES[x.stage])) + (partnerOverdue(x) ? " · ⚠ шаг просрочен" : x.nextDate && !x.lost ? " · шаг до " + esc(date(x.nextDate)) : "") + "</small></button>").join("") + "</div>" : "<p class=\"empty\">" + (st.list.length ? "В этой выборке никого нет." : "Воронка партнёров пока пуста. Добавьте организацию и двигайте её по этапам: поиск → переговоры → договор.") + "</p>";
  return "<section class=\"players-section funnel-section partners-section\"><div class=\"section-heading\"><div><p class=\"eyebrow\">ВОРОНКА ПАРТНЁРОВ</p><h3>От поиска до договора</h3></div><button type=\"button\" class=\"primary-button\" id=\"add-partner-toggle\">+ ПАРТНЁР</button></div>"
    + "<div class=\"fn-stages\">" + rows + "</div>"
    + "<p class=\"resource-line\">Всего в воронке: " + st.list.length + " <i></i> отказались: <strong>" + st.lost.length + "</strong>" + (st.reasons.length ? " (" + st.reasons.map(([r, n]) => esc(r) + " — " + n).join(", ") + ")" : "") + (overdue ? " <i></i> <span class=\"warn\">⚠ просрочены шаги: " + overdue + "</span>" : "") + "</p>"
    + "<form class=\"match-form\" id=\"partner-form\" hidden>" + partnerFields() + "<button class=\"primary-button\">СОХРАНИТЬ</button></form><div class=\"fn-chips\">" + chips + "</div>" + cards + "<p class=\"hint\">Денежные суммы здесь не учитываются: финансовые показатели остаются в закрытом секторе.</p></section>";
}
function bindPartners() {
  document.querySelectorAll("[data-pn-filter]").forEach(b => b.addEventListener("click", () => { partnerFilter = b.dataset.pnFilter; render(); }));
  on("#add-partner-toggle", "click", () => { const f = document.querySelector("#partner-form"); f.hidden = !f.hidden; });
  on("#partner-form", "submit", e => {
    e.preventDefault(); if (!can("partners.edit")) return; const x = readPartner(e.currentTarget); if (!x.name) return;
    const stage = Math.min(PARTNER_STAGES.length - 1, Math.max(0, +new FormData(e.currentTarget).get("stage") || 0)), today = dateStr(new Date());
    partnersList().push({ id: newId(), ...x, stage, reached: stage, lost: false, lostReason: "", created: today, log: [{ stage, date: today, lost: false, reason: "" }] }); persist();
  });
  document.querySelectorAll("[data-partner]").forEach(b => b.addEventListener("click", () => openPartner(b.dataset.partner)));
}
function movePartner(x, to) { x.stage = to; x.reached = Math.max(x.reached, to); x.log.push({ stage: to, date: dateStr(new Date()), lost: false, reason: "" }); persist(); openPartner(x.id); }
function openPartner(id) {
  const x = partnerById(id); if (!x || !can("partners.edit")) return; const box = document.querySelector("#partner-dialog-content");
  const timeline = x.log.map(l => "<li>" + esc(date(l.date)) + " — " + (l.lost ? "<b>отказ</b>" + (l.reason ? " (" + esc(l.reason) + ")" : "") + " на этапе «" + esc(PARTNER_STAGES[l.stage]) + "»" : "этап «" + esc(PARTNER_STAGES[l.stage]) + "»") + "</li>").join("");
  box.innerHTML = "<p class=\"eyebrow\">ПАРТНЁР · " + esc(x.category) + "</p><h2>" + esc(x.name) + "</h2><div class=\"match-score-large fn-now\">" + (x.lost ? "Отказ" : (x.stage + 1) + ". " + esc(PARTNER_STAGES[x.stage])) + "</div>"
    + "<dl class=\"match-info\"><div><dt>Контактное лицо</dt><dd>" + esc(x.contact || "Не указано") + "</dd></div><div><dt>Партнёрский пакет</dt><dd>" + esc(x.pack || "Не указан") + "</dd></div>"
    + "<div><dt>Следующий шаг</dt><dd>" + esc(x.nextStep || "Не указан") + (partnerOverdue(x) ? " <span class=\"warn\">⚠ просрочен</span>" : "") + "</dd></div><div><dt>Срок шага</dt><dd>" + (x.nextDate ? esc(date(x.nextDate)) : "Не указан") + "</dd></div>"
    + (x.lost ? "<div class=\"wide-info\"><dt>Причина отказа</dt><dd>" + esc(x.lostReason || "Не указана") + "</dd></div>" : "")
    + "<div class=\"wide-info\"><dt>Заметки</dt><dd>" + esc(x.notes || "—") + "</dd></div><div class=\"wide-info\"><dt>История</dt><dd><ul class=\"fn-log\">" + timeline + "</ul></dd></div></dl>"
    + "<div class=\"match-actions\">" + (x.lost ? "<button type=\"button\" class=\"primary-button\" data-pn=\"restore\">ВЕРНУТЬ В ВОРОНКУ</button>" : (x.stage < PARTNER_STAGES.length - 1 ? "<button type=\"button\" class=\"primary-button\" data-pn=\"next\">СЛЕДУЮЩИЙ ЭТАП →</button>" : "") + (x.stage > 0 ? "<button type=\"button\" class=\"ghost-button\" data-pn=\"prev\">← ШАГ НАЗАД</button>" : "") + "<button type=\"button\" class=\"ghost-button\" data-pn=\"lost\">ОТКАЗ</button>") + "<button type=\"button\" class=\"ghost-button\" data-pn=\"edit\">ИЗМЕНИТЬ</button><button type=\"button\" class=\"danger-button\" data-pn=\"delete\">УДАЛИТЬ</button></div>"
    + "<form class=\"cal-inline\" id=\"pn-lost-form\" hidden><input name=\"reason\" maxlength=\"120\" placeholder=\"Причина отказа (необязательно)\"><button class=\"primary-button\">ЗАФИКСИРОВАТЬ ОТКАЗ</button></form>";
  const act = (n, fn) => { const b = box.querySelector("[data-pn=" + n + "]"); if (b) b.addEventListener("click", fn); };
  act("next", () => movePartner(x, x.stage + 1)); act("prev", () => movePartner(x, x.stage - 1));
  act("restore", () => { x.lost = false; x.lostReason = ""; x.log.push({ stage: x.stage, date: dateStr(new Date()), lost: false, reason: "" }); persist(); openPartner(id); });
  act("lost", () => { const f = box.querySelector("#pn-lost-form"); f.hidden = !f.hidden; if (!f.hidden) f.reason.focus(); });
  on("#pn-lost-form", "submit", e => { e.preventDefault(); const r = String(new FormData(e.currentTarget).get("reason") || "").trim(); x.lost = true; x.lostReason = r; x.log.push({ stage: x.stage, date: dateStr(new Date()), lost: true, reason: r }); persist(); openPartner(id); });
  act("edit", () => editPartner(id));
  act("delete", () => { if (!confirm("Удалить «" + x.name + "» из воронки?")) return; season().partners = partnersList().filter(q => q.id !== id); document.querySelector("#partner-dialog").close(); persist(); });
  const dlg = document.querySelector("#partner-dialog"); if (!dlg.open) dlg.showModal();
}
function editPartner(id) {
  const x = partnerById(id), box = document.querySelector("#partner-dialog-content");
  box.innerHTML = "<p class=\"eyebrow\">РЕДАКТИРОВАНИЕ</p><h2>" + esc(x.name) + "</h2><form class=\"match-form\" id=\"edit-partner-form\">" + partnerFields(x) + "<div class=\"match-actions wide\"><button class=\"primary-button\">СОХРАНИТЬ</button><button type=\"button\" class=\"ghost-button\" id=\"cancel-pn-edit\">ОТМЕНА</button></div></form>";
  box.querySelector("#cancel-pn-edit").addEventListener("click", () => openPartner(id));
  box.querySelector("#edit-partner-form").addEventListener("submit", e => { e.preventDefault(); if (!can("partners.edit")) return; const n = readPartner(e.currentTarget); if (!n.name) return; Object.assign(x, n); persist(); openPartner(id); });
}
