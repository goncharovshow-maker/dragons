// Панель руководителя (сектор «Цифровой штаб»). Только чтение: всё считается из уже существующих данных сезона
// и пересчитывается при каждой отрисовке (render), то есть при изменении задач, статусов, матчей или сезона.
// Ничего не хранит и не меняет. Файл подключается до app.js; к данным приложения обращается только при вызове.

function sectorStats(s) {
  const ms = missionsFor(s), tasks = ms.flatMap((_, i) => tasksFor(s.id, i));
  return { missions: ms.length, total: tasks.length, done: tasks.filter(t => t.status === "выполнено").length, inWork: tasks.filter(t => t.status === "в работе").length, progress: sectorProgress(s) };
}
function lastPlayedMatch() {
  const today = dateStr(new Date());
  return season().matches.filter(m => m.date && m.date <= today && m.status !== "перенесён").sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")))[0] || null;
}
// Динамика по сезонам: текущий сезон — по живым данным, остальные — по сохранённой истории (нет истории — «нет данных»).
function seasonDynamics() {
  const live = metrics();
  return SEASONS.map(s => { const h = s === currentSeason ? { completion: live.completion, development: live.development } : (state.seasons[s] && state.seasons[s].history) || null; return { season: s, current: s === currentSeason, h }; });
}
function dashMatchCard(title, m, empty) {
  if (!m) return "<div class=\"dash-match\"><p class=\"eyebrow\">" + title + "</p><p class=\"empty\">" + empty + "</p></div>";
  return "<div class=\"dash-match\"><p class=\"eyebrow\">" + title + "</p><p class=\"dm-title\">" + esc(CLUB.name) + " — " + esc(m.opponent) + "</p><p class=\"dm-meta\">" + date(m.date) + (m.time ? " · " + esc(m.time) : "") + (m.venue ? " · " + esc(m.venue) : "") + "</p><p class=\"dm-meta\">" + esc(m.status) + (m.score ? " · счёт " + esc(m.score) : "") + "</p></div>";
}
function dashboardMarkup() {
  const m = metrics(), stats = sectors.map(s => ({ s, st: sectorStats(s) })), notStarted = m.total - m.done - m.inWork;
  const kpi = (label, value, sub) => "<div class=\"kpi\"><span>" + label + "</span><b>" + value + "</b><small>" + sub + "</small></div>";
  const rows = stats.map(({ s, st }, i) => "<button type=\"button\" class=\"dash-row\" data-dash-sector=\"" + s.id + "\"><span class=\"dr-name\">" + String(i + 1).padStart(2, "0") + " " + esc(s.name) + "</span><span class=\"dr-bar\"><i style=\"width:" + st.progress + "%\"></i></span><b>" + st.progress + "%</b><small>" + (st.missions ? st.missions + " " + plural(st.missions, "миссия", "миссии", "миссий") + " · задач " + st.done + "/" + st.total : "миссий нет") + "</small></button>").join("");
  const dyn = seasonDynamics().map(d => "<div class=\"dyn-row" + (d.current ? " current" : "") + "\"><span>" + esc(d.season) + (d.current ? " <em>текущий</em>" : "") + "</span>" + (d.h ? "<div class=\"dyn-bars\"><i class=\"b1\" style=\"width:" + d.h.completion + "%\"></i><i class=\"b2\" style=\"width:" + d.h.development + "%\"></i></div><small>миссии " + d.h.completion + "% · индекс " + d.h.development + "%</small>" : "<div class=\"dyn-bars none\"></div><small>нет данных</small>") + "</div>").join("");
  return "<section class=\"dashboard\"><div class=\"section-heading\"><div><p class=\"eyebrow\">ПАНЕЛЬ РУКОВОДИТЕЛЯ</p><h3>Сезон " + esc(currentSeason) + " в цифрах</h3></div></div>"
    + "<div class=\"kpi-grid\">" + kpi("ВЫПОЛНЕНИЕ МИССИЙ", m.completion + "%", "выполнено " + m.done + " из " + m.total + " " + plural(m.total, "задачи", "задач", "задач"))
    + kpi("ИНДЕКС РАЗВИТИЯ", m.development + "%", "среднее по секторам с миссиями") + kpi("ЗАДАЧ В РАБОТЕ", m.inWork, "не начато: " + notStarted) + kpi("ВЫПОЛНЕНО ЗАДАЧ", m.done, "всего задач: " + m.total) + kpi("МИССИЙ В СЕЗОНЕ", m.missionTotal, "в " + stats.filter(x => x.st.missions).length + " из " + sectors.length + " секторов") + "</div>"
    + "<div class=\"dash-cols\"><div><p class=\"eyebrow\">ПРОГРЕСС СЕКТОРОВ</p><div class=\"dash-rows\">" + rows + "</div></div>"
    + "<div>" + dashMatchCard("БЛИЖАЙШИЙ МАТЧ", (upcomingMatch() || {}).m, "Запланированных матчей нет.") + dashMatchCard("ПОСЛЕДНИЙ МАТЧ", lastPlayedMatch(), "Сыгранных матчей пока нет.")
    + "<div class=\"dash-dyn\"><p class=\"eyebrow\">ДИНАМИКА СЕЗОНОВ</p>" + dyn + "<p class=\"dyn-legend\"><i class=\"b1\"></i> выполнение миссий <i class=\"b2\"></i> индекс развития</p></div></div></div>" + reportControls() + "</section>";
}
function bindDashboard() {
  on("#print-report", "click", printReport);
  document.querySelectorAll("[data-dash-sector]").forEach(b => b.addEventListener("click", () => selectSector(b.dataset.dashSector)));
}
