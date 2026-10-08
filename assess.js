// Оценка игроков (сектор «Спорт», миссия «Критерии развития игроков»).
// В ТЗ нет ни критериев, ни шкалы, поэтому критерии (название и максимальный балл) и оценки вносит пользователь.
// Хранится по сезонам: season().criteria и season().assessments. Файл подключается до ui.js; к данным обращается только при вызове.
function criteriaList() { const d = season(); return d.criteria || (d.criteria = []); }
function assessList() { const d = season(); return d.assessments || (d.assessments = []); }
function normalizeAssess(d, pids) {
  const str = v => typeof v === "string" ? v : "";
  d.criteria = (Array.isArray(d.criteria) ? d.criteria : []).filter(c => c && typeof c.name === "string" && c.name.trim() && Number.isInteger(+c.max) && +c.max >= 1 && +c.max <= 100 && c.max !== "" && c.max !== null).map(c => ({ id: cleanId(c.id), name: c.name.trim(), max: +c.max }));
  const byId = Object.fromEntries(d.criteria.map(c => [c.id, c]));
  d.assessments = (Array.isArray(d.assessments) ? d.assessments : []).filter(a => a && pids.has(a.playerId) && DATE_RE.test(a.date)).map(a => {
    const scores = {}; Object.entries(a.scores && typeof a.scores === "object" ? a.scores : {}).forEach(([k, v]) => { const c = byId[k]; if (c && typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= c.max) scores[k] = v; });
    return { id: cleanId(a.id), playerId: a.playerId, date: a.date, scores, notes: str(a.notes) };
  });
}
// Итог оценки — средняя доля набранных баллов по заполненным критериям (в процентах).
function assessPercent(a) {
  const vals = criteriaList().filter(c => typeof a.scores[c.id] === "number").map(c => a.scores[c.id] / c.max);
  return vals.length ? Math.round(vals.reduce((x, y) => x + y, 0) / vals.length * 100) : null;
}
function playerAssessments(pid) { return assessList().filter(a => a.playerId === pid).sort((x, y) => x.date.localeCompare(y.date)); }
function assessSummary(pid) {
  const list = playerAssessments(pid); if (!list.length) return null;
  const last = list.at(-1), prev = list.at(-2), lp = assessPercent(last), pp = prev ? assessPercent(prev) : null;
  return { count: list.length, date: last.date, percent: lp, delta: lp !== null && pp !== null ? lp - pp : null };
}
// По каждому критерию: первый и последний внесённый балл за сезон.
function criterionDynamics(pid) {
  const list = playerAssessments(pid);
  return criteriaList().map(c => { const vals = list.filter(a => typeof a.scores[c.id] === "number").map(a => a.scores[c.id]); return { id: c.id, name: c.name, max: c.max, first: vals.length ? vals[0] : null, last: vals.length ? vals.at(-1) : null, count: vals.length }; });
}
// Средний последний балл по группе для каждого критерия (только игроки, у которых есть оценка).
function groupAverages(team) {
  const ps = playersList().filter(p => p.team === team && playerAssessments(p.id).length);
  return ps.length ? criteriaList().map(c => { const v = ps.map(p => { const l = playerAssessments(p.id).filter(a => typeof a.scores[c.id] === "number"); return l.length ? l.at(-1).scores[c.id] : null; }).filter(x => x !== null); return { name: c.name, max: c.max, avg: v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null, n: v.length }; }).filter(x => x.n) : [];
}
function assessLine(p) {
  const s = assessSummary(p.id); if (!s) return "Нет оценок";
  return (s.percent !== null ? s.percent + "%" : "—") + " · оценок: " + s.count + " · последняя " + date(s.date) + (s.delta !== null ? " · " + (s.delta > 0 ? "▲ +" : s.delta < 0 ? "▼ " : "= ") + s.delta : "");
}
// График динамики: по горизонтали — оценки игрока по порядку (подписи — даты), по вертикали — доля набранных баллов (0–100%).
// Тонкие цветные линии — критерии, толстая тёмная — итог. Для линии нужно минимум две оценки.
const CHART_COLORS = ["#e31d32", "#2f8cff", "#d5a13a", "#1c8a5a", "#7a4cff", "#e0602f", "#0f9aa8", "#8a5a3c"];
function assessChartData(pid) {
  const list = playerAssessments(pid), cs = criteriaList();
  return {
    dates: list.map(a => a.date),
    total: list.map(a => assessPercent(a)),
    series: cs.map((c, i) => ({ id: c.id, name: c.name, color: CHART_COLORS[i % CHART_COLORS.length], values: list.map(a => typeof a.scores[c.id] === "number" ? Math.round(a.scores[c.id] / c.max * 1000) / 10 : null) })).filter(s => s.values.some(v => v !== null))
  };
}
function assessChart(pid) {
  const d = assessChartData(pid), n = d.dates.length;
  if (n < 2) return "<p class=\"hint\">" + (n ? "Для графика нужно минимум две оценки." : "Оценок пока нет.") + "</p>";
  const narrow = typeof window !== "undefined" && window.innerWidth > 0 && window.innerWidth <= 650, W = narrow ? 340 : 520, H = narrow ? 270 : 230, L = narrow ? 48 : 38, FS = narrow ? 13 : 10, R = narrow ? 26 : 14, T = 14, B = 34, x = i => Math.round((L + (W - L - R) * i / (n - 1)) * 10) / 10, y = v => Math.round((T + (H - T - B) * (1 - v / 100)) * 10) / 10;
  const line = (vals, color, w, dash) => { let path = "", pts = ""; vals.forEach((v, i) => { if (v === null) return; path += (path && vals[i - 1] !== null && i > 0 ? "L" : "M") + x(i) + " " + y(v); pts += "<circle cx=\"" + x(i) + "\" cy=\"" + y(v) + "\" r=\"" + (w > 2 ? 4 : 3) + "\" fill=\"" + color + "\"><title>" + v + "%</title></circle>"; }); return "<path d=\"" + path + "\" fill=\"none\" stroke=\"" + color + "\" stroke-width=\"" + w + "\" stroke-linejoin=\"round\"" + (dash ? " stroke-dasharray=\"" + dash + "\"" : "") + "/>" + pts; };
  const grid = [0, 25, 50, 75, 100].map(v => "<line x1=\"" + L + "\" x2=\"" + (W - R) + "\" y1=\"" + y(v) + "\" y2=\"" + y(v) + "\" stroke=\"#dbe5e9\" stroke-width=\"1\"/><text x=\"" + (L - 6) + "\" y=\"" + (y(v) + Math.round(FS * 0.35)) + "\" text-anchor=\"end\" font-size=\"" + FS + "\" fill=\"#788a92\">" + v + "%</text>").join("");
  const step = Math.max(1, Math.ceil(n / (narrow ? 4 : 6))), labels = d.dates.map((dt, i) => i % step === 0 || i === n - 1 ? "<text x=\"" + x(i) + "\" y=\"" + (H - (narrow ? 14 : 12)) + "\" text-anchor=\"middle\" font-size=\"" + FS + "\" fill=\"#788a92\">" + esc(dt.slice(8) + "." + dt.slice(5, 7)) + "</text>" : "").join("");
  const legend = d.series.map(s => "<span><i style=\"background:" + s.color + "\"></i>" + esc(s.name) + "</span>").join("") + "<span><i class=\"total\"></i>Итог</span>";
  return "<div class=\"assess-chart\"><svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Динамика оценок игрока\"><title>Динамика оценок: доля набранных баллов по критериям</title>" + grid + labels + d.series.map(s => line(s.values, s.color, 1.6)).join("") + line(d.total, "#10181e", 3) + "</svg><div class=\"chart-legend\">" + legend + "</div></div>";
}
function dropCriterion(id) { season().criteria = criteriaList().filter(c => c.id !== id); assessList().forEach(a => { delete a.scores[id]; }); season().assessments = assessList().filter(a => Object.keys(a.scores).length || a.notes); }

function assessMarkup() {
  const ed = can("assess.edit"), cs = criteriaList(), players = playersList().slice().sort((a, b) => TEAMS.findIndex(t => t.id === a.team) - TEAMS.findIndex(t => t.id === b.team) || a.name.localeCompare(b.name, "ru"));
  const chips = cs.length ? "<div class=\"crit-chips\">" + cs.map(c => "<span class=\"crit-chip\">" + esc(c.name) + " <small>0–" + c.max + "</small>" + (ed ? "<button type=\"button\" class=\"del-btn\" data-del-crit=\"" + c.id + "\" aria-label=\"Удалить критерий\" title=\"Удалить критерий и его оценки\">×</button>" : "") + "</span>").join("") + "</div>" : "<p class=\"empty\">Критерии пока не заданы: в ТЗ их нет. " + (ed ? "Добавьте критерии вручную — название и максимальный балл, затем оценивайте игроков." : "") + "</p>";
  const cards = players.length ? "<div class=\"player-cards\">" + players.map(p => { const s = assessSummary(p.id); return "<button type=\"button\" class=\"player-card assess-card\" data-assess-player=\"" + p.id + "\"><b>" + (s && s.percent !== null ? s.percent + "%" : "—") + "</b><span>" + esc(p.name) + "</span><small>" + esc(p.team) + " · " + (s ? "оценок: " + s.count + (s.delta !== null ? " · " + (s.delta > 0 ? "▲ +" : s.delta < 0 ? "▼ " : "= ") + s.delta : "") : "нет оценок") + "</small></button>"; }).join("") + "</div>" : "<p class=\"empty\">Сначала внесите игроков в разделе «Игроки».</p>";
  const avg = TEAMS.map(t => ({ t, a: groupAverages(t.id) })).filter(x => x.a.length).map(x => "<li><b>" + esc(x.t.id) + ":</b> " + x.a.map(c => esc(c.name) + " " + c.avg + "/" + c.max).join(" · ") + "</li>").join("");
  return "<section class=\"players-section assess-section\"><div class=\"section-heading\"><div><p class=\"eyebrow\">КРИТЕРИИ РАЗВИТИЯ ИГРОКОВ</p><h3>Оценка игроков</h3></div></div>" + chips
    + (ed ? "<form class=\"add-task\" id=\"crit-form\"><input required maxlength=\"60\" name=\"name\" placeholder=\"Название критерия\"><input required type=\"number\" min=\"1\" max=\"100\" step=\"1\" name=\"max\" class=\"crit-max\" placeholder=\"Макс. балл\" aria-label=\"Максимальный балл\"><button>+ КРИТЕРИЙ</button></form>" : "")
    + (cs.length ? cards : "") + (avg ? "<div class=\"assess-avg\"><p class=\"eyebrow\">СРЕДНИЙ ПОСЛЕДНИЙ БАЛЛ ПО ГРУППАМ</p><ul>" + avg + "</ul></div>" : "") + "</section>";
}
function bindAssess() {
  on("#crit-form", "submit", e => { e.preventDefault(); if (!can("assess.edit")) return; const fd = new FormData(e.currentTarget), name = String(fd.get("name") || "").trim(), max = Math.round(+fd.get("max")); if (!name || !(max >= 1 && max <= 100)) return; if (criteriaList().some(c => c.name.toLowerCase() === name.toLowerCase())) { alert("Такой критерий уже есть."); return; } criteriaList().push({ id: newId(), name, max }); persist(); });
  document.querySelectorAll("[data-del-crit]").forEach(b => b.addEventListener("click", () => { const c = criteriaList().find(x => x.id === b.dataset.delCrit); if (!c || !confirm("Удалить критерий «" + c.name + "» вместе с внесёнными по нему оценками?")) return; dropCriterion(c.id); persist(); }));
  document.querySelectorAll("[data-assess-player]").forEach(b => b.addEventListener("click", () => openAssess(b.dataset.assessPlayer)));
}
function openAssess(pid) {
  const p = playersList().find(x => x.id === pid); if (!p) return;
  const cs = criteriaList(), list = playerAssessments(pid).slice().reverse(), ed = can("assess.edit"), box = document.querySelector("#assess-dialog-content"), today = dateStr(new Date());
  const dyn = criterionDynamics(pid).filter(d => d.count), sum = assessSummary(pid);
  box.innerHTML = "<p class=\"eyebrow\">ОЦЕНКА РАЗВИТИЯ · " + esc(currentSeason) + "</p><h2>" + esc(p.name) + "</h2><p class=\"resource-line\">Группа " + esc(p.team) + " <i></i> " + esc(assessLine(p)) + "</p>"
    + (dyn.length ? "<table class=\"assess-table\"><thead><tr><th>Критерий</th><th>Первый</th><th>Последний</th><th>Динамика</th></tr></thead><tbody>" + dyn.map(d => "<tr><td>" + esc(d.name) + "</td><td>" + d.first + "</td><td>" + d.last + " / " + d.max + "</td><td>" + (d.count > 1 ? (d.last - d.first > 0 ? "▲ +" : d.last - d.first < 0 ? "▼ " : "= ") + Math.round((d.last - d.first) * 10) / 10 : "—") + "</td></tr>").join("") + "</tbody></table>" : "") + (playerAssessments(pid).length ? assessChart(pid) : "")
    + (list.length ? "<ul class=\"assess-history\">" + list.map(a => "<li><div><b>" + esc(date(a.date)) + "</b>" + (assessPercent(a) !== null ? " · " + assessPercent(a) + "%" : "") + "<small>" + esc(cs.filter(c => typeof a.scores[c.id] === "number").map(c => c.name + " " + a.scores[c.id] + "/" + c.max).join(" · ")) + (a.notes ? " — " + esc(a.notes) : "") + "</small></div>" + (ed ? "<button type=\"button\" class=\"del-btn\" data-del-assess=\"" + a.id + "\" aria-label=\"Удалить оценку\" title=\"Удалить оценку\">×</button>" : "") + "</li>").join("") + "</ul>" : "<p class=\"empty\">Оценок пока нет.</p>")
    + (ed ? (cs.length ? "<form class=\"match-form assess-form\" id=\"assess-form\"><p class=\"eyebrow wide\">НОВАЯ ОЦЕНКА (за ту же дату — обновляется)</p><label>Дата<input required type=\"date\" name=\"date\" value=\"" + today + "\"></label><span></span>" + cs.map(c => "<label>" + esc(c.name) + " <small>0–" + c.max + "</small><input type=\"number\" min=\"0\" max=\"" + c.max + "\" step=\"0.5\" name=\"c_" + c.id + "\" placeholder=\"—\"></label>").join("") + "<label class=\"wide\">Заметки<input maxlength=\"300\" name=\"notes\" placeholder=\"Необязательно\"></label><button class=\"primary-button\">СОХРАНИТЬ ОЦЕНКУ</button></form>" : "<p class=\"hint\">Чтобы оценивать, сначала добавьте критерии в разделе «Оценка игроков».</p>") : "");
  box.querySelectorAll("[data-del-assess]").forEach(b => b.addEventListener("click", () => { if (!confirm("Удалить эту оценку?")) return; season().assessments = assessList().filter(a => a.id !== b.dataset.delAssess); persist(); openAssess(pid); }));
  on("#assess-form", "submit", e => {
    e.preventDefault(); if (!can("assess.edit")) return; const fd = new FormData(e.currentTarget), scores = {};
    criteriaList().forEach(c => { const raw = fd.get("c_" + c.id); if (raw === "" || raw === null) return; const v = +raw; if (Number.isFinite(v) && v >= 0 && v <= c.max) scores[c.id] = v; });
    if (!Object.keys(scores).length) { alert("Заполните хотя бы один критерий."); return; }
    const dt = String(fd.get("date")), notes = String(fd.get("notes") || "").trim(), ex = assessList().find(a => a.playerId === pid && a.date === dt);
    if (ex) { ex.scores = { ...ex.scores, ...scores }; if (notes) ex.notes = notes; } else assessList().push({ id: newId(), playerId: pid, date: dt, scores, notes });
    persist(); openAssess(pid);
  });
  const d = document.querySelector("#assess-dialog"); if (!d.open) d.showModal();
}
