// Роли и PIN-коды. ВАЖНО: это разграничение на уровне интерфейса, а не криптографическая защита данных.
// Данные хранятся в этом браузере (localStorage). Человек с доступом к компьютеру и инструментам разработчика
// сможет их прочитать. Настоящая защита возможна только на сервере. PIN-коды хранятся отдельно от данных клуба
// (в резервную копию не попадают), в виде соли и хеша PBKDF2-SHA256.
const ACCESS_KEY = STORE + "-access";
const ROLE_KEY = STORE + "-role";
const ROLES = { admin: "Администратор", coach: "Тренер", parent: "Родитель / гость" };
const ROLE_PERMS = {
  coach: new Set(["write", "players.view", "players.edit", "trainers.view", "parents.view", "schedule.view", "schedule.edit", "attendance.edit", "matches.view", "matches.edit", "calendar.edit", "missions.view", "history", "tasks.sport", "tasks.children", "tasks.competitions", "funnel.view", "funnel.edit", "assess.view", "assess.edit", "program.view", "program.edit"]),
  parent: new Set(["schedule.view", "matches.view"])
};
const PIN_MIN = 4, PIN_MAX = 12, FAIL_LIMIT = 5, LOCK_SECONDS = 30;
let role = "parent";       // минимальные права, пока не определена роль
let accessCfg = null;      // { v, pins: { admin:{s,h}, coach?:{s,h} }, fails:{n,until} }

// Право на действие. Администратор может всё.
function can(p) { return role === "admin" || !!(ROLE_PERMS[role] && ROLE_PERMS[role].has(p)); }
function on(sel, ev, fn) { const e = document.querySelector(sel); if (e) e.addEventListener(ev, fn); }
const cryptoOk = () => !!(window.crypto && crypto.subtle && crypto.getRandomValues);
const toHex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
async function hashPin(pin, salt) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return toHex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 120000 }, k, 256));
}
async function makePin(pin) { const s = toHex(crypto.getRandomValues(new Uint8Array(16))); return { s, h: await hashPin(pin, s) }; }
async function checkPin(rec, pin) { return !!rec && (await hashPin(pin, rec.s)) === rec.h; }
function pinProblem(pin) { return pin.length < PIN_MIN || pin.length > PIN_MAX ? "PIN должен быть от " + PIN_MIN + " до " + PIN_MAX + " символов." : ""; }

function loadAccess() { try { const a = JSON.parse(localStorage.getItem(ACCESS_KEY)); return a && a.pins && a.pins.admin && a.pins.admin.h ? a : null; } catch { return null; } }
function saveAccess(a) { try { a ? localStorage.setItem(ACCESS_KEY, JSON.stringify(a)) : localStorage.removeItem(ACCESS_KEY); } catch {} accessCfg = a; }
function availableRoles() { return accessCfg ? ["admin", ...(accessCfg.pins.coach ? ["coach"] : []), "parent"] : ["admin"]; }

// Ограничение подбора: после FAIL_LIMIT неверных попыток вход блокируется на LOCK_SECONDS секунд.
function lockLeft() { const u = accessCfg && accessCfg.fails ? accessCfg.fails.until || 0 : 0; return Math.max(0, Math.ceil((u - Date.now()) / 1000)); }
function noteFail() { const f = accessCfg.fails || (accessCfg.fails = { n: 0, until: 0 }); f.n++; if (f.n >= FAIL_LIMIT) { f.n = 0; f.until = Date.now() + LOCK_SECONDS * 1000; } saveAccess(accessCfg); }
async function tryLogin(r, pin) {
  if (r === "parent") return "";
  if (lockLeft()) return "Слишком много попыток. Подождите " + lockLeft() + " с.";
  if (!cryptoOk()) return "PIN недоступен в этом браузере.";
  if (await checkPin(accessCfg.pins[r], pin)) { if (accessCfg.fails) { accessCfg.fails = { n: 0, until: 0 }; saveAccess(accessCfg); } return ""; }
  noteFail(); return lockLeft() ? "Слишком много попыток. Подождите " + lockLeft() + " с." : "Неверный PIN.";
}
function setRole(r) {
  role = r; try { sessionStorage.setItem(ROLE_KEY, r); } catch {}
  document.body.classList.remove("locked"); applyRoleUI(); render();
}
function lockApp() { role = "parent"; try { sessionStorage.removeItem(ROLE_KEY); } catch {} document.body.classList.add("locked"); applyRoleUI(); showLogin(); }

function applyRoleUI() {
  document.body.dataset.role = role;
  const on_ = !!accessCfg, badge = document.querySelector("#role-badge");
  if (badge) { badge.textContent = ROLES[role]; badge.hidden = !on_; }
  const show = (id, v) => { const e = document.querySelector(id); if (e) e.hidden = !v; };
  show("#logout-button", on_); show("#access-button", role === "admin");
  show("#data-button", can("backup")); show("#history-button", can("history"));
}
function showLogin() {
  const dlg = document.querySelector("#login-dialog"), roles = availableRoles();
  dlg.querySelector("#login-roles").innerHTML = roles.map((r, i) => "<label class=\"check\"><input type=\"radio\" name=\"role\" value=\"" + r + "\"" + (i === 0 ? " checked" : "") + "> " + ROLES[r] + "</label>").join("");
  dlg.querySelector("#login-error").textContent = ""; dlg.querySelector("#login-pin").value = "";
  const sync = () => { const r = dlg.querySelector("[name=role]:checked").value; dlg.querySelector("#pin-label").hidden = r === "parent"; dlg.querySelector("#login-hint").textContent = r === "parent" ? "Только просмотр расписания и матчей." : ""; };
  dlg.querySelectorAll("[name=role]").forEach(x => x.addEventListener("change", sync)); sync();
  if (!dlg.open) dlg.showModal();
  if (!dlg.querySelector("#pin-label").hidden) dlg.querySelector("#login-pin").focus();
}
function initAccess() {
  accessCfg = loadAccess();
  document.querySelector("#login-dialog").addEventListener("cancel", e => e.preventDefault());
  on("#login-form", "submit", async e => {
    e.preventDefault(); const dlg = document.querySelector("#login-dialog"), r = dlg.querySelector("[name=role]:checked").value, err = dlg.querySelector("#login-error");
    err.textContent = ""; const msg = await tryLogin(r, dlg.querySelector("#login-pin").value);
    if (msg) { err.textContent = msg; dlg.querySelector("#login-pin").select(); return; }
    dlg.close(); setRole(r);
  });
  on("#logout-button", "click", lockApp);
  on("#access-button", "click", openAccess);
  if (!accessCfg) { role = "admin"; applyRoleUI(); return; }
  let saved = null; try { saved = sessionStorage.getItem(ROLE_KEY); } catch {}
  if (saved && availableRoles().includes(saved)) { role = saved; applyRoleUI(); return; }
  lockApp();
}

// ---------- окно «Доступ» (только администратор) ----------
function accessNote() { return "<p class=\"access-warn\"><b>Важно.</b> Это защита интерфейса, а не шифрование: данные лежат в этом браузере, и человек с доступом к компьютеру и знаниями сможет их прочитать. Для настоящей защиты нужен сервер. Забыли PIN администратора — удалите ключ «" + ACCESS_KEY + "» в localStorage (данные клуба при этом не пострадают) или очистите данные сайта и загрузите резервную копию.</p>"; }
function openAccess() {
  if (!can("access")) return;
  const box = document.querySelector("#access-dialog-content"), st = document.querySelector("#access-status");
  const pinField = (name, label, req) => "<label>" + label + "<input type=\"password\" name=\"" + name + "\" autocomplete=\"new-password\" maxlength=\"" + PIN_MAX + "\"" + (req ? " required" : "") + "></label>";
  if (!cryptoOk()) box.innerHTML = "<p class=\"eyebrow\">ДОСТУП</p><h2>Роли и PIN</h2><p class=\"data-status err\">Этот браузер не поддерживает шифрование (нужна страница на localhost или https). PIN-коды недоступны.</p>";
  else if (!accessCfg) box.innerHTML = "<p class=\"eyebrow\">ДОСТУП</p><h2>Включить защиту</h2><p class=\"dialog-intro\">Сейчас все, кто открыл страницу, видят и меняют всё. После включения будет вход по ролям: <b>Администратор</b> (всё), <b>Тренер</b> (состав, расписание, матчи, посещаемость; без оплат, резервных копий и настроек), <b>Родитель / гость</b> (только расписание, календарь и матчи, без PIN).</p><form class=\"match-form\" id=\"access-form\">" + pinField("admin", "PIN администратора", true) + pinField("admin2", "Повторите PIN", true) + pinField("coach", "PIN тренера (необязательно)", false) + "<div class=\"match-actions wide\"><button class=\"primary-button\">ВКЛЮЧИТЬ ЗАЩИТУ</button></div></form>" + accessNote();
  else box.innerHTML = "<p class=\"eyebrow\">ДОСТУП</p><h2>Защита включена</h2><form class=\"match-form\" id=\"access-form\">" + pinField("current", "Текущий PIN администратора", true) + pinField("admin", "Новый PIN администратора", false) + pinField("coach", accessCfg.pins.coach ? "Новый PIN тренера" : "PIN тренера", false) + (accessCfg.pins.coach ? "<label class=\"check wide\"><input type=\"checkbox\" name=\"dropCoach\"> Убрать PIN тренера (роль тренера отключится)</label>" : "") + "<div class=\"match-actions wide\"><button class=\"primary-button\">СОХРАНИТЬ</button><button type=\"button\" class=\"danger-button\" id=\"access-off\">ОТКЛЮЧИТЬ ЗАЩИТУ</button></div></form>" + accessNote();
  st.textContent = ""; st.className = "data-status";
  const say = (m, ok) => { st.textContent = m; st.className = "data-status " + (ok ? "ok" : "err"); };
  on("#access-form", "submit", async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget), val = k => String(f.get(k) || "");
    if (!accessCfg) {
      const bad = pinProblem(val("admin")) || (val("admin") !== val("admin2") ? "PIN-коды не совпадают." : "") || (val("coach") ? pinProblem(val("coach")) || (val("coach") === val("admin") ? "PIN тренера должен отличаться от PIN администратора." : "") : "");
      if (bad) return say(bad);
      const cfg = { v: 1, pins: { admin: await makePin(val("admin")) }, fails: { n: 0, until: 0 } }; if (val("coach")) cfg.pins.coach = await makePin(val("coach"));
      saveAccess(cfg); try { sessionStorage.setItem(ROLE_KEY, "admin"); } catch {} applyRoleUI(); openAccess(); say("Защита включена. Вы вошли как администратор.", true); return;
    }
    if (lockLeft()) return say("Слишком много попыток. Подождите " + lockLeft() + " с.");
    if (!(await checkPin(accessCfg.pins.admin, val("current")))) { noteFail(); return say("Текущий PIN неверен."); }
    const cfg = JSON.parse(JSON.stringify(accessCfg));
    if (val("admin")) { const bad = pinProblem(val("admin")); if (bad) return say(bad); cfg.pins.admin = await makePin(val("admin")); }
    if (f.get("dropCoach")) delete cfg.pins.coach;
    else if (val("coach")) { const bad = pinProblem(val("coach")) || (await checkPin(cfg.pins.admin, val("coach")) ? "PIN тренера должен отличаться от PIN администратора." : ""); if (bad) return say(bad); cfg.pins.coach = await makePin(val("coach")); }
    saveAccess(cfg); openAccess(); say("Настройки доступа сохранены.", true);
  });
  on("#access-off", "click", async () => {
    const cur = document.querySelector("#access-form [name=current]").value;
    if (!(await checkPin(accessCfg.pins.admin, cur))) { noteFail(); return say("Введите текущий PIN администратора, чтобы отключить защиту."); }
    if (!confirm("Отключить защиту? После этого все смогут видеть и менять все данные.")) return;
    saveAccess(null); try { sessionStorage.removeItem(ROLE_KEY); } catch {} role = "admin"; applyRoleUI(); render(); openAccess(); say("Защита отключена.", true);
  });
  const d = document.querySelector("#access-dialog"); if (!d.open) d.showModal();
}
