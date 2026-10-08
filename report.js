// Отчёт для руководителя за выбранный сезон: итоги, посещаемость, воронки, оценки игроков.
// Формируется из уже существующих данных и печатается через окно печати браузера («Сохранить как PDF»).
// Денежных показателей нет. Доступен тем, кто видит панель руководителя (администратор). Файл подключается до ui.js.
const REPORT_SECTIONS = [["summary", "Итоги сезона и секторы"], ["attendance", "Посещаемость"], ["funnels", "Воронки: дети и партнёры"], ["assess", "Оценки игроков"]];

function rpTable(head, rows) {
  return "<table><thead><tr>" + head.map(h => "<th>" + esc(h) + "</th>").join("") + "</tr></thead><tbody>" + rows.map(r => "<tr>" + r.map(c => "<td>" + esc(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table>";
}
const rpPct = v => v === null || v === undefined ? "—" : v + "%";
function rpFunnel(title, names, st, extra) {
  const rows = names.map((n, k) => [(k + 1) + ". " + n, st.reached[k], st.now[k], k && st.reached[k - 1] ? Math.round(st.reached[k] / st.reached[k - 1] * 100) + "%" : "—"]);
  return "<h4>" + esc(title) + "</h4>" + (st.list.length ? rpTable(["Этап", "Дошли до этапа", "Сейчас на этапе", "Конверсия"], rows) + "<p>Всего в воронке: " + st.list.length + ". Отказались: " + st.lost.length + (st.reasons.length ? " (" + esc(st.reasons.map(([r, n]) => r + " — " + n).join(", ")) + ")" : "") + "." + (extra || "") + "</p>" : "<p class=\"rp-empty\">Записей нет.</p>");
}
function rpTeamAttendance(team, days) {
  const s = playersList().filter(p => p.team === team).map(p => attStats(p.id, days)), total = s.reduce((n, x) => n + x.total, 0), present = s.reduce((n, x) => n + x.present, 0);
  return { total, present, pct: total ? Math.round(present / total * 100) : null };
}
function reportSummary() {
  const m = metrics(), today = dateStr(new Date()), matches = season().matches.slice().sort((a, b) => a.date.localeCompare(b.date));
  const played = matches.filter(x => x.date <= today && x.status !== "перенесён").length, planned = matches.filter(x => x.status === "запланирован" && x.date >= today).length;
  return "<h3>1. Итоги сезона и секторы</h3>"
    + rpTable(["Показатель", "Значение"], [["Выполнение миссий", m.completion + "%"], ["Индекс развития", m.development + "%"], ["Миссий в сезоне", String(m.missionTotal)], ["Задач всего / выполнено / в работе / не начато", [m.total, m.done, m.inWork, m.total - m.done - m.inWork].join(" / ")]])
    + "<h4>Прогресс секторов</h4>" + rpTable(["Сектор", "Миссий", "Задач выполнено", "Прогресс"], sectors.map((s, i) => { const st = sectorStats(s); return [String(i + 1).padStart(2, "0") + " " + s.name, st.missions ? String(st.missions) : "нет", st.total ? st.done + " из " + st.total : "—", st.progress + "%"]; }))
    + "<h4>Матчи сезона</h4><p>Сыграно: " + played + ". Запланировано: " + planned + ".</p>"
    + (matches.length ? rpTable(["Дата", "Соперник", "Группа", "Счёт", "Статус"], matches.map(x => [date(x.date) + (x.time ? " " + x.time : ""), x.opponent, x.team || "—", x.score || "—", x.status])) : "<p class=\"rp-empty\">Матчей нет.</p>");
}
function reportAttendance() {
  const teams = TEAMS.filter(t => playersList().some(p => p.team === t.id)), any = Object.keys(attendanceMap()).length;
  const rows = teams.map(t => { const a = rpTeamAttendance(t.id), b = rpTeamAttendance(t.id, 30); return [t.id, String(playersList().filter(p => p.team === t.id).length), a.total ? a.present + " из " + a.total + " (" + a.pct + "%)" : "нет отметок", b.total ? b.pct + "% (" + b.total + " отм.)" : "нет отметок"]; });
  const low = lowAttendance();
  return "<h3>2. Посещаемость</h3>" + (any && teams.length ? rpTable(["Группа", "Игроков", "За всё время", "За 30 дней"], rows) + "<h4>Реже половины занятий</h4>" + (low.length ? rpTable(["Игрок", "Группа", "Посещено", "Доля"], low.map(x => [x.p.name, x.p.team, x.s.present + " из " + x.s.total, x.s.pct + "%"])) + "<p class=\"rp-note\">Учитываются игроки минимум с тремя отметками.</p>" : "<p>Таких игроков нет.</p>") : "<p class=\"rp-empty\">Отметок посещаемости за сезон нет.</p>");
}
function reportFunnels() {
  const pn = partnerStats(), overdue = pn.list.filter(partnerOverdue).length;
  return "<h3>3. Воронки</h3>" + rpFunnel("Путь ребёнка в клубе", FUNNEL_STAGES, funnelStats()) + rpFunnel("Партнёры: от поиска до договора", PARTNER_STAGES, pn, overdue ? " Просрочены шаги: " + overdue + "." : "");
}
function reportAssess() {
  const cs = criteriaList(), ps = playersList().filter(p => assessSummary(p.id)).sort((a, b) => TEAMS.findIndex(t => t.id === a.team) - TEAMS.findIndex(t => t.id === b.team) || a.name.localeCompare(b.name, "ru"));
  if (!cs.length || !ps.length) return "<h3>4. Оценки игроков</h3><p class=\"rp-empty\">" + (cs.length ? "Оценок за сезон нет." : "Критерии оценки не заданы.") + "</p>";
  const avg = TEAMS.flatMap(t => groupAverages(t.id).map(c => [t.id, c.name, c.avg + " из " + c.max, String(c.n)]));
  return "<h3>4. Оценки игроков</h3><p>Критерии: " + esc(cs.map(c => c.name + " (0–" + c.max + ")").join(", ")) + ".</p>"
    + "<h4>Средний последний балл по группам</h4>" + rpTable(["Группа", "Критерий", "Средний балл", "Игроков"], avg)
    + "<h4>Игроки</h4>" + rpTable(["Игрок", "Группа", "Оценок", "Последняя", "Итог", "Динамика"], ps.map(p => { const s = assessSummary(p.id); return [p.name, p.team, String(s.count), date(s.date), rpPct(s.percent), s.delta === null ? "—" : (s.delta > 0 ? "▲ +" : s.delta < 0 ? "▼ " : "= ") + s.delta]; }));
}
function reportHtml(selected) {
  const sel = selected || REPORT_SECTIONS.map(s => s[0]), build = { summary: reportSummary, attendance: reportAttendance, funnels: reportFunnels, assess: reportAssess };
  return "<div class=\"rp\"><div class=\"print-head\"><img src=\"" + esc(CLUB.logo) + "\" alt=\"\"><div><h1>" + esc(CLUB.fullName) + "</h1><h2>Отчёт для руководителя · сезон " + esc(currentSeason) + "</h2></div></div>"
    + REPORT_SECTIONS.filter(([k]) => sel.includes(k)).map(([k]) => build[k]()).join("")
    + "<p class=\"print-foot\">Сформирован " + new Date().toLocaleDateString("ru-RU") + ". Данные из приложения на момент формирования; финансовые показатели в отчёт не входят.</p></div>";
}
function reportControls() {
  return "<div class=\"report-box\"><p class=\"eyebrow\">ОТЧЁТ ДЛЯ РУКОВОДИТЕЛЯ (PDF)</p><div class=\"report-opts\">" + REPORT_SECTIONS.map(([k, n]) => "<label class=\"check\"><input type=\"checkbox\" data-report-section=\"" + k + "\" checked> " + esc(n) + "</label>").join("") + "</div><button type=\"button\" class=\"primary-button\" id=\"print-report\">СФОРМИРОВАТЬ ОТЧЁТ</button><p class=\"hint\">Откроется окно печати браузера — выберите «Сохранить как PDF». Отчёт за выбранный сезон: " + esc(currentSeason) + ".</p></div>";
}
function printReport() {
  if (!can("dashboard")) return;
  const sel = [...document.querySelectorAll("[data-report-section]:checked")].map(c => c.dataset.reportSection);
  if (!sel.length) { alert("Выберите хотя бы один раздел отчёта."); return; }
  printDocument(reportHtml(sel));
}
