// Оплата абонементов по месяцам (сектор «Дети»): только статусы, без сумм.
// Файл входит в разбиение бывшего app.js; порядок подключения — в index.html.

// ===== Оплата абонементов (сектор «Дети») =====
// Только статус «оплачено» по месяцам. Суммы не считаются и не выводятся — финансовые показатели остаются в закрытом секторе.
// state.payments = { "ГГГГ-ММ": { <id игрока>: true } }
let payMonth = dateStr(new Date()).slice(0, 7);
function paymentsMap() { return state.payments || (state.payments = {}); }
function monthLabel(m) { return new Date(m + "-01T00:00").toLocaleDateString("ru-RU", { month: "long", year: "numeric" }); }
function paymentsMarkup() {
  const kids = playersList(), paid = paymentsMap()[payMonth] || {}, done = kids.filter(k => paid[k.id]), debt = kids.filter(k => !paid[k.id]);
  const pct = kids.length ? Math.round(done.length / kids.length * 100) : 0;
  const chips = kids.length ? "<div class=\"pay-chips\">" + kids.map(k => "<button type=\"button\" class=\"pay-chip" + (paid[k.id] ? " paid" : "") + "\" data-pay=\"" + k.id + "\" aria-pressed=\"" + !!paid[k.id] + "\"><span>" + esc(k.name) + "</span><small>" + esc(k.team) + " · " + (paid[k.id] ? "оплачено" : "не оплачено") + "</small></button>").join("") + "</div>" : "<p class=\"empty\">Сначала внесите игроков в секторе «Спорт».</p>";
  const debtors = debt.length && done.length + debt.length ? "<div class=\"debt-block\"><p class=\"eyebrow\">НЕ ОПЛАТИЛИ ЗА " + esc(monthLabel(payMonth).toUpperCase()) + "</p><ul class=\"debt-list\">" + debt.map(k => { const ps = parentsOf(k.id); return "<li><b>" + esc(k.name) + "</b><span>" + (ps.length ? ps.map(x => esc(x.name) + (x.phone ? " · <a href=\"tel:" + attr(x.phone.replace(/[^\d+]/g, "")) + "\">" + esc(x.phone) + "</a>" : "")).join("; ") : "<i class=\"muted\">родитель не указан</i>") + "</span></li>"; }).join("") + "</ul></div>" : "";
  return "<section class=\"players-section\"><div class=\"section-heading\"><div><p class=\"eyebrow\">АБОНЕМЕНТЫ</p><h3>Оплата за месяц</h3></div><label class=\"month-pick\">Месяц<input type=\"month\" id=\"pay-month\" value=\"" + attr(payMonth) + "\"></label></div>"
    + "<p class=\"resource-line\">Оплатили: <strong>" + done.length + " из " + kids.length + "</strong> <i></i> " + esc(monthLabel(payMonth)) + " <i></i> без сумм: финансовые показатели остаются в закрытом секторе</p><i class=\"hud-bar pay-bar\"><em style=\"width:" + pct + "%\"></em></i>" + chips + debtors + "</section>";
}
function bindPayments() {
  on("#pay-month","change", e => { if (e.target.value) { payMonth = e.target.value; render(); } });
  document.querySelectorAll("[data-pay]").forEach(b => b.addEventListener("click", () => { const m = paymentsMap()[payMonth] || (paymentsMap()[payMonth] = {}); if (m[b.dataset.pay]) delete m[b.dataset.pay]; else m[b.dataset.pay] = true; persist(); }));
}
