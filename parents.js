// Родители (сектор «Дети»).
// Файл входит в разбиение бывшего app.js; порядок подключения — в index.html.
// ===== Родители (сектор «Дети»): связь «родитель — ребёнок-игрок» =====
function parentsList() { return state.parents || (state.parents = []); }
function childNames(ids) { return (ids || []).map(id => playersList().find(p => p.id === id)).filter(Boolean).map(p => p.name); }
function parentsOf(playerId) { return parentsList().filter(x => (x.children || []).includes(playerId)); }
function parentFields(p = {}) {
  const kids = p.children || [], all = playersList();
  const list = all.length ? all.map(c => "<label class=\"check\"><input type=\"checkbox\" name=\"children\" value=\"" + c.id + "\"" + (kids.includes(c.id) ? " checked" : "") + "> " + esc(c.name) + " <small>" + esc(c.team) + "</small></label>").join("") : "<span class=\"hint\">Сначала внесите игроков в секторе «Спорт».</span>";
  return "<label class=\"wide\">Имя и фамилия<input required maxlength=\"80\" name=\"name\" placeholder=\"Например, Анна Петрова\" value=\"" + attr(p.name) + "\"></label>"
    + "<label class=\"wide\">Телефон<input type=\"tel\" maxlength=\"30\" name=\"phone\" placeholder=\"Необязательно\" value=\"" + attr(p.phone) + "\"></label>"
    + "<fieldset class=\"team-checks kids-checks\"><legend>Дети (игроки клуба)</legend>" + list + "</fieldset>"
    + "<label class=\"wide\">Заметки<input maxlength=\"200\" name=\"notes\" placeholder=\"Необязательно\" value=\"" + attr(p.notes) + "\"></label>";
}
function readParent(form) { const fd = new FormData(form); return { name: String(fd.get("name") || "").trim(), phone: String(fd.get("phone") || "").trim(), children: fd.getAll("children"), notes: fd.get("notes") || "" }; }
function parentsMarkup() {
  const all = parentsList(), kids = playersList(), linked = new Set(all.flatMap(x => x.children || [])), without = kids.filter(k => !linked.has(k.id)).length;
  const cards = all.length ? "<div class=\"player-cards\">" + all.map(x => "<button type=\"button\" class=\"player-card trainer-card\" data-parent=\"" + x.id + "\"><b>" + esc(initials(x.name)) + "</b><span>" + esc(x.name) + "</span><small>" + (childNames(x.children).map(esc).join(", ") || "дети не указаны") + "</small></button>").join("") + "</div>" : "<p class=\"empty\">Родители пока не внесены. Добавьте родителя и свяжите его с ребёнком из состава.</p>";
  return "<section class=\"players-section\"><div class=\"section-heading\"><div><p class=\"eyebrow\">РАБОТА С РОДИТЕЛЯМИ</p><h3>Родители</h3></div>" + (can("parents.edit") ? "<button type=\"button\" class=\"primary-button\" id=\"add-parent-toggle\">+ РОДИТЕЛЬ</button>" : "") + "</div>"
    + "<p class=\"resource-line\">Родителей: " + all.length + " <i></i> детей без родителя в системе: <strong>" + without + " из " + kids.length + "</strong></p>"
    + (can("parents.edit") ? "<form class=\"match-form\" id=\"parent-form\" hidden>" + parentFields() + "<button class=\"primary-button\">СОХРАНИТЬ РОДИТЕЛЯ</button></form>" : "") + cards + "</section>";
}
function bindParents() {
  on("#add-parent-toggle","click", () => { const f = document.querySelector("#parent-form"); f.hidden = !f.hidden; });
  on("#parent-form","submit", e => { e.preventDefault(); const x = readParent(e.currentTarget); if (!x.name) return; x.id = newId(); parentsList().push(x); persist(); });
  document.querySelectorAll("[data-parent]").forEach(b => b.addEventListener("click", () => openParent(b.dataset.parent)));
}
function openParent(id) {
  const x = parentsList().find(q => q.id === id); if (!x) return;
  const tel = x.phone ? "<a href=\"tel:" + attr(x.phone.replace(/[^\d+]/g, "")) + "\">" + esc(x.phone) + "</a>" : "Не указан";
  document.querySelector("#parent-dialog-content").innerHTML = "<p class=\"eyebrow\">КАРТОЧКА РОДИТЕЛЯ</p><h2>" + esc(x.name) + "</h2><dl class=\"match-info\"><div><dt>Телефон</dt><dd>" + tel + "</dd></div><div><dt>Дети</dt><dd>" + (childNames(x.children).map(esc).join(", ") || "Не указаны") + "</dd></div><div class=\"wide-info\"><dt>Заметки</dt><dd>" + esc(x.notes || "—") + "</dd></div></dl>" + (can("parents.edit") ? actionsMarkup("РОДИТЕЛЯ") : "");
  const box = document.querySelector("#parent-dialog-content");
  bindAct(box, "edit", "click", () => editParent(id));
  bindAct(box, "delete", "click", () => { if (!confirm("Удалить родителя «" + x.name + "»?")) return; state.parents = parentsList().filter(q => q.id !== id); document.querySelector("#parent-dialog").close(); persist(); });
  const d = document.querySelector("#parent-dialog"); if (!d.open) d.showModal();
}
function editParent(id) {
  const x = parentsList().find(q => q.id === id), box = document.querySelector("#parent-dialog-content");
  box.innerHTML = "<p class=\"eyebrow\">РЕДАКТИРОВАНИЕ РОДИТЕЛЯ</p><h2>" + esc(x.name) + "</h2><form class=\"match-form\" id=\"edit-parent-form\">" + parentFields(x) + "<div class=\"match-actions wide\"><button class=\"primary-button\">СОХРАНИТЬ</button><button type=\"button\" class=\"ghost-button\" id=\"cancel-parent-edit\">ОТМЕНА</button></div></form>";
  box.querySelector("#cancel-parent-edit").addEventListener("click", () => openParent(id));
  box.querySelector("#edit-parent-form").addEventListener("submit", e => { e.preventDefault(); const n = readParent(e.currentTarget); if (!n.name) return; Object.assign(x, n); persist(); openParent(id); });
}
