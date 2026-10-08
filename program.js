// Сектор «Программа» (id education): план обучения на сезон отдельно для каждой группы и прогресс его прохождения.
// Тренер вносит пункты вручную и отмечает пройденное; готовых программ в приложении нет. Данные хранятся по сезонам (season().program).
// Файл подключается до ui.js; к данным обращается только при вызове.
let programTeam = "";   // выбранная группа в разделе

function programList() { const d = season(); return d.program || (d.program = []); }
function normalizeProgram(d) {
  const dre = /^\d{4}-\d{2}-\d{2}$/;
  d.program = (Array.isArray(d.program) ? d.program : []).filter(x => x && typeof x === "object" && typeof x.title === "string" && x.title.trim() && typeof x.team === "string" && x.team)
    .map(x => ({ id: cleanId(x.id), team: x.team, title: x.title.trim().slice(0, 200), period: String(x.period || "").slice(0, 60), done: x.done === true, doneDate: x.done === true && dre.test(x.doneDate) ? x.doneDate : "", notes: String(x.notes || "").slice(0, 300) }));
}
function programStats(team) {
  const list = programList().filter(x => !team || x.team === team), done = list.filter(x => x.done).length;
  return { total: list.length, done, percent: list.length ? Math.round(done / list.length * 100) : 0 };
}
// Прогресс всего сектора: доля пройденных пунктов по всем группам; null — программа ещё не заполнена (тогда прогресс считают миссии).
function programPercent() { const s = programStats(); return s.total ? s.percent : null; }

function programMarkup() {
  const edit = can("program.edit"), team = programTeam && TEAMS.some(t => t.id === programTeam) ? programTeam : TEAMS[0].id;
  programTeam = team;
  const all = programStats(), st = programStats(team), items = programList().filter(x => x.team === team);
  const chips = TEAMS.map(t => { const s = programStats(t.id); return "<button type=\"button\" class=\"prog-chip" + (t.id === team ? " active" : "") + "\" data-prog-team=\"" + attr(t.id) + "\"><span>" + esc(t.name) + "</span><b>" + (s.total ? s.percent + "%" : "—") + "</b><i class=\"progress-line\"><i style=\"width:" + s.percent + "%\"></i></i><small>" + (s.total ? s.done + " из " + s.total : "нет плана") + "</small></button>"; }).join("");
  return "<section class=\"match-section program-section\"><div class=\"section-heading\"><div><p class=\"eyebrow\">ПРОГРАММА ОБУЧЕНИЯ</p><h3>План сезона " + esc(currentSeason) + " по группам</h3></div><span class=\"eyebrow\">" + (all.total ? "Всего пройдено: " + all.done + " из " + all.total + " (" + all.percent + "%)" : "План не заполнен") + "</span></div>"
    + "<div class=\"prog-chips\">" + chips + "</div>"
    + "<div class=\"prog-head\"><h4>Группа " + esc(TEAMS.find(t => t.id === team).name) + "</h4><span>" + (st.total ? "Пройдено " + st.done + " из " + st.total + " · " + st.percent + "%" : "Пунктов пока нет") + "</span></div>"
    + (st.total ? "<div class=\"progress-line prog-total\"><i style=\"width:" + st.percent + "%\"></i></div>" : "")
    + (edit ? "<form class=\"prog-form\" id=\"program-form\"><label>Период или тема (необязательно)<input maxlength=\"60\" name=\"period\" placeholder=\"Например: сентябрь\"></label><label>Пункты плана: каждая строка — отдельный пункт<textarea required rows=\"3\" maxlength=\"4000\" name=\"lines\" placeholder=\"Катание: старты и остановки\nБросок с места\"></textarea></label><button class=\"primary-button\">+ ДОБАВИТЬ В ПЛАН</button></form>" : "")
    + (items.length ? "<ul class=\"prog-list\">" + items.map(x => "<li class=\"" + (x.done ? "done" : "") + "\"><label class=\"check\"><input type=\"checkbox\" data-prog-done=\"" + attr(x.id) + "\"" + (x.done ? " checked" : "") + (edit ? "" : " disabled") + "> <span><b>" + esc(x.title) + "</b>" + (x.period ? "<small>" + esc(x.period) + "</small>" : "") + (x.done && x.doneDate ? "<small>пройдено " + date(x.doneDate) + "</small>" : "") + "</span></label>" + (edit ? "<button type=\"button\" class=\"del-btn\" data-prog-del=\"" + attr(x.id) + "\" aria-label=\"Удалить пункт\">×</button>" : "") + "</li>").join("") + "</ul>"
      : "<p class=\"empty\">" + (edit ? "План для этой группы пока не составлен. Добавьте первые пункты выше." : "План для этой группы пока не составлен.") + "</p>")
    + "</section>";
}
function bindProgram() {
  document.querySelectorAll("[data-prog-team]").forEach(b => b.addEventListener("click", () => { programTeam = b.dataset.progTeam; render(); }));
  if (!can("program.edit")) return;
  on("#program-form", "submit", e => {
    e.preventDefault(); const fd = new FormData(e.currentTarget), period = String(fd.get("period") || "").trim();
    String(fd.get("lines") || "").split("\n").map(s => s.trim()).filter(Boolean).forEach(title => programList().push({ id: newId(), team: programTeam, title: title.slice(0, 200), period, done: false, doneDate: "", notes: "" }));
    persist();
  });
  document.querySelectorAll("[data-prog-done]").forEach(c => c.addEventListener("change", () => { const x = programList().find(i => i.id === c.dataset.progDone); if (!x) return; x.done = c.checked; x.doneDate = c.checked ? dateStr(new Date()) : ""; persist(); }));
  document.querySelectorAll("[data-prog-del]").forEach(b => b.addEventListener("click", () => { const x = programList().find(i => i.id === b.dataset.progDel); if (!x || !confirm("Удалить пункт «" + x.title + "» из плана?")) return; season().program = programList().filter(i => i.id !== x.id); persist(); }));
}
