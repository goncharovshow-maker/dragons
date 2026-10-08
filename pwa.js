// Установка на экран телефона (PWA): регистрация сервис-воркера и пункт «Установить» в меню.
// Сервис-воркер работает только на https или localhost (не из файла file://). Файл подключается до main.js.
let deferredInstall = null;

function isStandalone() {
  return !!((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || (typeof navigator !== "undefined" && navigator.standalone === true));
}
function isIos() { return typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent || "") && !window.MSStream; }
function canRegisterSW(proto, nav) { return !!(nav && "serviceWorker" in nav) && /^https?:$/.test(proto || ""); }
function registerPwa() {
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; });
  window.addEventListener("appinstalled", () => { deferredInstall = null; });
  if (!canRegisterSW(location.protocol, navigator)) return;
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
// Пункт меню «Установить»: системное окно установки (Android/Chrome) или подсказка для iPhone. В установленном приложении не показывается.
function installMenuEntry() {
  if (isStandalone()) return null;
  if (deferredInstall) return { label: "Установить на экран телефона", run: () => { const p = deferredInstall; deferredInstall = null; p.prompt(); } };
  if (isIos()) return { label: "Как установить на iPhone", run: () => alert("В Safari нажмите «Поделиться» и выберите «На экран Домой». Приложение появится на главном экране и будет открываться без адресной строки.") };
  return null;
}
