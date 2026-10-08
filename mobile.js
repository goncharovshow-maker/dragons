// Мобильная навигация: нижняя панель (Арена, Карта, Календарь, Меню) и меню с действиями, которые на телефоне спрятаны в боковой панели и шапке.
// Меню не дублирует логику: оно нажимает на уже существующие кнопки (резервная копия, история, доступ, выход) и показывает только доступные роли.
// Панель видна только на узких экранах (см. styles.css). Файл подключается до main.js; к DOM обращается только при вызове.
const MENU_ACTIONS = [["Резервная копия", "#data-button"], ["История сезонов", "#history-button"], ["Доступ и роли", "#access-button"], ["Выйти из системы", "#logout-button"]];

function menuEntries() {
  const items = MENU_ACTIONS.map(([label, sel]) => ({ label, el: document.querySelector(sel) })).filter(x => x.el && !x.el.hidden).map(x => ({ label: x.label, run: () => x.el.click() }));
  const install = typeof installMenuEntry === "function" ? installMenuEntry() : null;
  return install ? [...items, install] : items;
}
function openMenu() {
  const box = document.querySelector("#menu-dialog-content"), items = menuEntries();
  box.innerHTML = "<p class=\"eyebrow\">МЕНЮ</p>" + (items.length ? "<div class=\"menu-list\">" + items.map((x, i) => "<button type=\"button\" class=\"menu-item\" data-menu=\"" + i + "\">" + esc(x.label) + "</button>").join("") + "</div>" : "<p class=\"empty\">Для вашей роли дополнительных действий нет.</p>");
  box.querySelectorAll("[data-menu]").forEach(b => b.addEventListener("click", () => { const item = items[+b.dataset.menu]; document.querySelector("#menu-dialog").close(); item.run(); }));
  const d = document.querySelector("#menu-dialog"); if (!d.open) d.showModal();
}
// Какая вкладка подсвечена: «Секторы», когда список секторов поднялся в верхнюю половину экрана, иначе «Арена».
function navActiveTab(overviewTop, viewportHeight) { return overviewTop < viewportHeight * 0.5 ? "map" : "arena"; }
function updateNav() {
  const overview = document.querySelector(".sector-overview"); if (!overview) return;
  const tab = navActiveTab(overview.getBoundingClientRect().top, window.innerHeight);
  document.querySelectorAll(".bottom-nav [data-nav]").forEach(b => b.classList.toggle("active", b.dataset.nav === tab));
}
function initMobileNav() {
  const go = {
    arena: () => window.scrollTo({ top: 0, behavior: "smooth" }),
    map: () => document.querySelector(".sector-overview").scrollIntoView({ behavior: "smooth", block: "start" }),
    calendar: () => openCalendar(),
    menu: () => openMenu()
  };
  document.querySelectorAll(".bottom-nav [data-nav]").forEach(b => b.addEventListener("click", () => go[b.dataset.nav]()));
  let tick = false; window.addEventListener("scroll", () => { if (tick) return; tick = true; requestAnimationFrame(() => { tick = false; updateNav(); }); }, { passive: true });
  updateNav();
  initSwipeToClose();
}

// ---------- закрытие окон свайпом вниз (телефон) ----------
// Тянем окно вниз, когда оно прокручено к началу; достаточно длинный или быстрый жест закрывает его. Окно входа не закрывается.
const SWIPE_CLOSE_PX = 110;
function swipeDecision(dy, ms) { return dy >= SWIPE_CLOSE_PX || (dy >= 50 && ms > 0 && dy / ms >= 0.5) ? "close" : "cancel"; }
function swipeStartsOnField(el) { return !!(el && el.closest && el.closest("input,textarea,select,[contenteditable]")); }
function resetSwipe(dlg) { dlg.style.transition = ""; dlg.style.transform = ""; dlg.style.opacity = ""; }
function initSwipeToClose() {
  let st = null;
  document.addEventListener("touchstart", e => {
    const dlg = e.target.closest && e.target.closest("dialog[open]");
    if (!dlg || dlg.id === "login-dialog" || e.touches.length !== 1 || swipeStartsOnField(e.target) || dlg.scrollTop > 0) { st = null; return; }
    st = { dlg, x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), dy: 0, active: false };
  }, { passive: true });
  document.addEventListener("touchmove", e => {
    if (!st) return; const p = e.touches[0], dy = p.clientY - st.y, dx = Math.abs(p.clientX - st.x);
    if (!st.active) { if (dy > 10 && dy > dx * 1.5 && st.dlg.scrollTop <= 0) st.active = true; else { if (dy < -10 || dx > 10) st = null; return; } }
    st.dy = Math.max(0, dy); st.dlg.style.transition = "none"; st.dlg.style.transform = "translateY(" + st.dy + "px)"; st.dlg.style.opacity = String(1 - Math.min(0.5, st.dy / 400));
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  const finish = cancelled => {
    if (!st || !st.active) { st = null; return; }
    const { dlg, dy, t } = st; st = null; dlg.style.transition = "transform .18s ease, opacity .18s ease";
    if (!cancelled && swipeDecision(dy, Date.now() - t) === "close") { dlg.style.transform = "translateY(100%)"; dlg.style.opacity = "0"; setTimeout(() => { dlg.close(); resetSwipe(dlg); }, 180); }
    else { dlg.style.transform = ""; dlg.style.opacity = ""; setTimeout(() => resetSwipe(dlg), 200); }
  };
  document.addEventListener("touchend", () => finish(false), { passive: true });
  document.addEventListener("touchcancel", () => finish(true), { passive: true });
}
