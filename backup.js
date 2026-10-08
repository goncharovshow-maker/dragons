// Резервная копия: экспорт и импорт JSON, напоминание о копии.
// Файл входит в разбиение бывшего app.js; порядок подключения — в index.html.
function dataSummary(st) { const nm = Object.values(st.seasons).reduce((n, s) => n + (s.matches || []).length, 0), c = (k, a, b, d) => { const n = (st[k] || []).length; return n + " " + plural(n, a, b, d); }; return [c("players", "игрок", "игрока", "игроков"), c("trainers", "тренер", "тренера", "тренеров"), c("parents", "родитель", "родителя", "родителей"), c("sessions", "занятие", "занятия", "занятий"), nm + " " + plural(nm, "матч", "матча", "матчей")].join(", "); }
// Содержимое и имя файла резервной копии (отдельно от скачивания, чтобы их можно было проверить тестами).
function exportPayload() { return { app: CLUB.backupApp, format: 1, exportedAt: new Date().toISOString(), data: state }; }
function backupFileName() { return CLUB.filePrefix + "-backup-" + new Date().toLocaleDateString("sv-SE") + ".json"; }
function exportData() {
  const payload = exportPayload();
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })), download: backupFileName() });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  markBackedUp(); renderBackupBanner();
  return dataSummary(state);
}
function parseImport(text) {
  let obj; try { obj = JSON.parse(text); } catch { throw new Error("Файл не является корректным JSON."); }
  const data = obj && obj.data ? obj.data : obj;
  if (!data || typeof data !== "object" || !data.seasons || typeof data.seasons !== "object" || Array.isArray(data.seasons)) throw new Error("В файле нет данных «" + CLUB.nameGenitive + "» (не найден раздел seasons).");
  if (data.players != null && !Array.isArray(data.players)) throw new Error("Поле players должно быть списком.");
  if (data.trainers != null && !Array.isArray(data.trainers)) throw new Error("Поле trainers должно быть списком.");
  for (const [k, v] of Object.entries(data.seasons)) if (!v || typeof v !== "object" || (v.matches != null && !Array.isArray(v.matches))) throw new Error("Некорректные данные сезона «" + k + "».");
  return normalizeState(data);
}
async function importData(file) {
  const next = parseImport(await file.text());
  if (!confirm("Заменить текущие данные данными из файла?\n\nСейчас: " + dataSummary(state) + "\nВ файле: " + dataSummary(next) + "\n\nПеред заменой текущие данные сохранятся во внутреннюю резервную копию браузера.")) return null;
  try { localStorage.setItem(STORE + "-before-import", JSON.stringify(state)); } catch {}
  state = next; playerFilter = "all"; save(); lsSet(K_UNSAVED, null); render(); return dataSummary(next);
}
function renderBackupBanner() {
  const el = document.querySelector("#backup-banner"), since = lsGet(K_UNSAVED), snooze = +lsGet(K_SNOOZE) || 0;
  const due = since && daysAgo(since) >= BACKUP_REMINDER_DAYS && Date.now() > snooze;
  el.hidden = !due || !can("backup"); if (el.hidden) return;
  el.querySelector("span").textContent = "Изменения не сохранены в файл уже " + daysAgo(since) + " " + plural(daysAgo(since), "день", "дня", "дней") + ". Данные хранятся только в этом браузере. " + backupInfo();
}
