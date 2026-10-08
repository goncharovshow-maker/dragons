// Тренеры (сектор «Спорт»).
// Файл входит в разбиение бывшего app.js; порядок подключения — в index.html.
// ===== Тренеры (сектор «Спорт») =====
const COACH_ROLES = ["основной тренер", "вратарский тренер", "помощник тренера", "главный тренер", "директор по развитию", "другое"];
const MAIN_COACHES_TARGET = CLUB.mainCoaches;   // null — цель не показывается
function trainersList() { return state.trainers || (state.trainers = []); }
function initials(name) { return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?"; }
function trainerFields(t = {}) {
  const teams = t.teams || [];
  return "<label class=\"wide\">Имя и фамилия<input required maxlength=\"80\" name=\"name\" placeholder=\"Например, Сергей Иванов\" value=\"" + attr(t.name) + "\"></label>"
    + "<label>Должность<select name=\"role\">" + COACH_ROLES.map(x => "<option" + (x === (t.role || COACH_ROLES[0]) ? " selected" : "") + ">" + x + "</option>").join("") + "</select></label>"
    + "<fieldset class=\"team-checks\"><legend>Группы</legend>" + TEAMS.map(x => "<label class=\"check\"><input type=\"checkbox\" name=\"teams\" value=\"" + x.id + "\"" + (teams.includes(x.id) ? " checked" : "") + "> " + x.id + "</label>").join("") + "</fieldset>"
    + "<label class=\"wide\">Заметки<input maxlength=\"200\" name=\"notes\" placeholder=\"Необязательно\" value=\"" + attr(t.notes) + "\"></label>";
}
function readTrainer(form) { const fd = new FormData(form); return { name: String(fd.get("name") || "").trim(), role: fd.get("role"), teams: fd.getAll("teams"), notes: fd.get("notes") || "" }; }
function trainersMarkup() {
  const all = trainersList(), main = all.filter(t => t.role === "основной тренер").length;
  const cards = all.length ? "<div class=\"player-cards\">" + all.map(t => "<button type=\"button\" class=\"player-card trainer-card\" data-trainer=\"" + t.id + "\"><b>" + (t.photo ? "<img class=\"tr-photo\" src=\"" + attr(t.photo) + "\" alt=\"\">" : esc(initials(t.name))) + "</b><span>" + esc(t.name) + "</span><small>" + esc(t.role) + (t.teams && t.teams.length ? " · " + esc(t.teams.join(", ")) : "") + "</small></button>").join("") + "</div>" : "<p class=\"empty\">Тренеры пока не внесены. " + (MAIN_COACHES_TARGET ? "В ТЗ указано " + MAIN_COACHES_TARGET + " " + plural(MAIN_COACHES_TARGET, "основной тренер", "основных тренера", "основных тренеров") + " — добавьте их и при необходимости новых." : "Добавьте тренеров клуба.") + "</p>";
  return "<section class=\"players-section trainers-section\"><div class=\"section-heading\"><div><p class=\"eyebrow\">ТРЕНЕРСКИЙ ШТАБ</p><h3>Тренеры</h3></div>" + (can("trainers.edit") ? "<button type=\"button\" class=\"primary-button\" id=\"add-trainer-toggle\">+ ТРЕНЕР</button>" : "") + "</div>"
    + "<p class=\"resource-line\">Основных тренеров: <strong>" + main + (MAIN_COACHES_TARGET ? " из " + MAIN_COACHES_TARGET : "") + "</strong> <i></i> всего в штабе: " + all.length + "</p>"
    + (can("trainers.edit") ? "<form class=\"match-form\" id=\"trainer-form\" hidden>" + trainerFields() + "<button class=\"primary-button\">СОХРАНИТЬ ТРЕНЕРА</button></form>" : "") + cards + "</section>";
}
function bindTrainers() {
  on("#add-trainer-toggle","click", () => { const f = document.querySelector("#trainer-form"); f.hidden = !f.hidden; });
  on("#trainer-form","submit", e => { e.preventDefault(); const t = readTrainer(e.currentTarget); if (!t.name) return; t.id = newId(); trainersList().push(t); persist(); });
  document.querySelectorAll("[data-trainer]").forEach(b => b.addEventListener("click", () => openTrainer(b.dataset.trainer)));
}
function openTrainer(id) {
  const t = trainersList().find(x => x.id === id); if (!t) return;
  document.querySelector("#trainer-dialog-content").innerHTML = "<p class=\"eyebrow\">КАРТОЧКА ТРЕНЕРА</p>" + (t.photo ? "<img class=\"tr-photo-big\" src=\"" + attr(t.photo) + "\" alt=\"" + attr(t.name) + "\">" : "") + "<h2>" + esc(t.name) + "</h2>"
    + "<dl class=\"match-info\"><div><dt>Должность</dt><dd>" + esc(t.role) + "</dd></div><div><dt>Группы</dt><dd>" + esc((t.teams || []).join(", ") || "Не указаны") + "</dd></div><div class=\"wide-info\"><dt>Занятия в неделю</dt><dd>" + (sessionsList().filter(q => q.trainerId === id).sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start)).map(q => esc(sessionLine(q) + " · " + (q.teams || []).join(", "))).join("<br>") || "Не назначены") + "</dd></div><div class=\"wide-info\"><dt>Заметки</dt><dd>" + esc(t.notes || "—") + "</dd></div></dl>"
    + (can("trainers.edit") ? "<div class=\"match-actions\"><button type=\"button\" class=\"primary-button\" id=\"edit-trainer\">РЕДАКТИРОВАТЬ</button><button type=\"button\" class=\"danger-button\" id=\"delete-trainer\">УДАЛИТЬ ТРЕНЕРА</button></div>" : "");
  on("#edit-trainer","click", () => editTrainer(id));
  on("#delete-trainer","click", () => { if (!confirm("Удалить тренера «" + t.name + "»?")) return; state.trainers = trainersList().filter(x => x.id !== id); sessionsList().forEach(q => { if (q.trainerId === id) q.trainerId = ""; }); document.querySelector("#trainer-dialog").close(); persist(); });
  const d = document.querySelector("#trainer-dialog"); if (!d.open) d.showModal();
}
function editTrainer(id) {
  const t = trainersList().find(x => x.id === id), box = document.querySelector("#trainer-dialog-content");
  box.innerHTML = "<p class=\"eyebrow\">РЕДАКТИРОВАНИЕ ТРЕНЕРА</p><h2>" + esc(t.name) + "</h2><form class=\"match-form\" id=\"edit-trainer-form\">" + trainerFields(t) + "<div class=\"match-actions wide\"><button class=\"primary-button\">СОХРАНИТЬ</button><button type=\"button\" class=\"ghost-button\" id=\"cancel-trainer-edit\">ОТМЕНА</button></div></form>";
  box.querySelector("#cancel-trainer-edit").addEventListener("click", () => openTrainer(id));
  box.querySelector("#edit-trainer-form").addEventListener("submit", e => { e.preventDefault(); const n = readTrainer(e.currentTarget); if (!n.name) return; Object.assign(t, n); persist(); openTrainer(id); });
}
