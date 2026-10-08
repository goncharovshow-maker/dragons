// ДЕМО-ДАННЫЕ ТОЛЬКО ДЛЯ ПРОБНОЙ КОПИИ. В рабочий проект не входят. Все имена, телефоны и названия вымышлены.
// Данные кладутся только в браузер того, кто нажал кнопку; даты считаются от сегодняшнего дня.
(function () {
  // Если браузер не даёт писать в localStorage (закрытое окно, ограничения встроенной страницы), приложение не должно падать:
  // данные держатся в памяти до обновления страницы, и об этом сообщается в полосе вверху.
  let memory = null, memoryMode = false;
  const realWrite = LocalStore.write, realRead = LocalStore.read;
  LocalStore.write = s => { try { realWrite(s); } catch { memory = JSON.stringify(s); memoryMode = true; note(); } };
  LocalStore.read = () => { try { return realRead(); } catch { return memory ? JSON.parse(memory) : null; } };
  function note() { const n = document.querySelector("#demo-note"); if (n) n.textContent = "Браузер не разрешает сохранение: данные пропадут при обновлении страницы."; }
  const bar = document.createElement("div");
  bar.id = "demo-bar";
  bar.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;padding:8px 12px;background:#2a1f05;color:#ffd979;font:600 12px Manrope,sans-serif;letter-spacing:.04em;border-bottom:1px solid #6b5416";
  bar.innerHTML = '<span>ПРОБНАЯ ВЕРСИЯ · данные только на этом устройстве</span><span id="demo-note"></span><button type="button" id="demo-load"></button><button type="button" id="demo-clear"></button>';
  document.body.insertBefore(bar, document.body.firstChild);
  const btnCss = "min-height:32px;padding:0 12px;border:1px solid #ffd979;background:transparent;color:#ffd979;font:700 12px Manrope,sans-serif;cursor:pointer;border-radius:4px";
  const load = bar.querySelector("#demo-load"), clear = bar.querySelector("#demo-clear");
  load.style.cssText = clear.style.cssText = btnCss;
  const arm = (b, a, b2) => { b.textContent = a; b.dataset.armed = ""; };
  const reset = () => { arm(load, "ЗАГРУЗИТЬ ДЕМО-ДАННЫЕ"); arm(clear, "ОЧИСТИТЬ ВСЁ"); };
  reset();
  const twoStep = (btn, ask, run) => btn.addEventListener("click", () => {
    if ("armed" in btn.dataset && btn.dataset.armed === "1") { run(); reset(); return; }
    reset(); btn.dataset.armed = "1"; btn.textContent = ask; setTimeout(() => { if (btn.dataset.armed === "1") reset(); }, 5000);
  });
  const isEmpty = () => !state.players.length && !state.trainers.length && !state.sessions.length && season().matches.length <= 1;
  const done = text => { const n = document.querySelector("#demo-note"); if (n) { n.textContent = text; setTimeout(() => { if (n.textContent === text) n.textContent = ""; }, 6000); } };
  load.addEventListener("click", () => {
    if (isEmpty() || load.dataset.armed === "1") { fillDemo(); reset(); done("Готово: демо-данные загружены."); return; }
    reset(); load.dataset.armed = "1"; load.textContent = "ЗАМЕНИТЬ МОИ ДАННЫЕ ДЕМО? НАЖМИТЕ ЕЩЁ РАЗ"; setTimeout(() => { if (load.dataset.armed === "1") reset(); }, 5000);
  });
  twoStep(clear, "УДАЛИТЬ ВСЕ ДАННЫЕ? НАЖМИТЕ ЕЩЁ РАЗ", () => { state = normalizeState(null); persist(); done("Данные удалены."); });

  function fillDemo() {
    const today = dateStr(new Date()), A = n => addDays(today, n), mo = A(0).slice(0, 7), pm = addDays(A(0).slice(0, 7) + "-01", -1).slice(0, 7);
    state = normalizeState(null); role = "admin";
    const P = (id, name, team, position, number) => ({ id, name, team, position, number, notes: "ДЕМО" });
    state.players.push(P("d1", "Артём Волков", "2017", "вратарь", "1"), P("d2", "Матвей Орлов", "2017", "защитник", "5"), P("d3", "Иван Белов", "2017", "нападающий", "9"), P("d4", "Кирилл Лебедев", "2017", "нападающий", "17"),
      P("d5", "Егор Соколов", "2018", "вратарь", "30"), P("d6", "Лев Морозов", "2018", "защитник", "4"), P("d7", "Роман Ким", "2018", "нападающий", "11"),
      P("d8", "Тимур Алиев", "2019", "нападающий", "8"), P("d9", "Глеб Фомин", "2019", "защитник", "3"), P("d10", "Максим Дроздов", "СОГ", "нападающий", "21"), P("d11", "Никита Руденко", "СОГ", "защитник", "6"));
    state.trainers.push({ id: "dt0", name: "Феклистов Андрей Дмитриевич", role: "главный тренер", teams: ["2017", "2018", "2019", "СОГ"], notes: "ДЕМО", photo: "assets/feklistov.jpg" }, { id: "dtd", name: "Гончаров Дмитрий Владимирович", role: "директор по развитию", teams: [], notes: "ДЕМО", photo: "assets/director.png" }, { id: "dt1", name: "Сергей Иванов", role: "основной тренер", teams: ["2017", "2018"], notes: "ДЕМО" }, { id: "dt2", name: "Дмитрий Орлов", role: "основной тренер", teams: ["2019", "СОГ"], notes: "ДЕМО" }, { id: "dt3", name: "Павел Громов", role: "вратарский тренер", teams: ["2017", "2018", "2019"], notes: "ДЕМО" });
    state.parents.push({ id: "dr1", name: "Анна Белова", phone: "+7 900 000-00-01", children: ["d3"], notes: "ДЕМО" }, { id: "dr2", name: "Ольга Ким", phone: "+7 900 000-00-02", children: ["d7"], notes: "ДЕМО" });
    state.sessions.push({ id: "ds1", kind: "тренировка на льду", day: 1, start: "18:00", end: "19:00", teams: ["2017"], trainerId: "dt1", place: "Ледовая арена", notes: "" },
      { id: "ds2", kind: "тренировка на льду", day: 3, start: "17:00", end: "18:00", teams: ["2018"], trainerId: "dt1", place: "Ледовая арена", notes: "" },
      { id: "ds3", kind: "ОФП / зал", day: 4, start: "18:30", end: "19:30", teams: ["2019", "СОГ"], trainerId: "dt2", place: "Зал", notes: "" },
      { id: "ds4", kind: "тренировка на льду", day: 5, start: "10:00", end: "11:30", teams: ["2017", "2018"], trainerId: "dt1", place: "Ледовая арена", notes: "" });
    state.events.push({ id: "dv1", kind: "сборы", title: "Выездной сбор (демо)", from: A(21), to: A(24), teams: ["2017"], cancels: false, note: "" });
    state.attendance[A(-7) + "|ds1"] = { d1: true, d2: true, d3: false, d4: true }; state.attendance[A(-5) + "|ds2"] = { d5: true, d6: true, d7: false };
    state.payments[mo] = { d1: true, d2: true, d5: true, d6: true }; state.payments[pm] = { d1: true, d2: true, d3: true, d4: true, d5: true };
    const d = season();
    d.matches.push({ id: "dm1", date: A(-6), time: "12:00", venue: "Арена «Гололёд»", opponent: "Северная Звезда (демо)", team: "2017", homeAway: "дом", status: "завершён", tournament: "", tournamentId: "dtr1", score: "5–2", periods: "2–0, 1–1, 2–1", scorers: "Белов ×2, Лебедев ×2, Орлов", notes: "", protocol: "" },
      { id: "dm2", date: A(3), time: "11:30", venue: "Арена «Гололёд»", opponent: "Невские Рыси (демо)", team: "2018", homeAway: "дом", status: "запланирован", tournament: "", tournamentId: "dtr1", score: "", periods: "", scorers: "", notes: "", protocol: "" },
      { id: "dm3", date: A(10), time: "15:00", venue: "ЛДС «Север»", opponent: "Академия Восток (демо)", team: "2017", homeAway: "выезд", status: "запланирован", tournament: "", tournamentId: "", score: "", periods: "", scorers: "", notes: "", protocol: "" });
    d.tournaments.push({ id: "dtr1", name: "Кубок Города (демо)", stage: "Группа", status: "идёт", applyFrom: A(-40), applyTo: A(-20), notes: "", place: 2, table: "1. Северная Звезда  2. Шанхай Дрэгонс" });
    d.opponents.push({ id: "do1", name: "Северная Звезда (демо)", notes: "" }, { id: "do2", name: "Невские Рыси (демо)", notes: "" });
    d.content.push({ id: "dc1", date: A(1), channel: "ВКонтакте", title: "Анонс матча 2018", status: "идея", notes: "", matchId: "dm2" }, { id: "dc2", date: A(-5), channel: "Instagram", title: "Итоги матча 2017", status: "опубликовано", notes: "", matchId: "dm1" });
    d.funnel.push({ id: "df1", playerId: "", name: "Соня Белова (демо)", contact: "+7 900 000-00-03", source: "ВКонтакте", notes: "", stage: 0, reached: 1, lost: false, lostReason: "", lostAt: 0, created: A(-3), log: [{ stage: 0, date: A(-3), lost: false, reason: "" }] },
      { id: "df2", playerId: "", name: "Даниил Громов (демо)", contact: "", source: "знакомые", notes: "", stage: 2, reached: 3, lost: false, lostReason: "", lostAt: 0, created: A(-20), log: [{ stage: 2, date: A(-10), lost: false, reason: "" }] },
      { id: "df3", playerId: "", name: "Ева Зайцева (демо)", contact: "", source: "сайт", notes: "", stage: 1, reached: 2, lost: true, lostReason: "далеко ехать", lostAt: 1, created: A(-25), log: [{ stage: 1, date: A(-18), lost: true, reason: "далеко ехать" }] });
    d.partners.push({ id: "dp1", name: "ООО Ромашка (демо)", category: "Партнёр", contact: "", pack: "Базовый", nextStep: "Отправить предложение", nextDate: A(2), notes: "", stage: 1, reached: 2, lost: false, lostReason: "", created: A(-12), log: [] },
      { id: "dp2", name: "Фонд Лёд (демо)", category: "Грант", contact: "", pack: "", nextStep: "Позвонить", nextDate: A(-2), notes: "", stage: 0, reached: 1, lost: false, lostReason: "", created: A(-8), log: [] });
    d.criteria.push({ id: "dk1", name: "Катание", max: 5 }, { id: "dk2", name: "Игра в защите", max: 5 }, { id: "dk3", name: "Дисциплина", max: 5 });
    d.assessments.push({ id: "da1", playerId: "d3", date: A(-40), scores: { dk1: 3, dk2: 2, dk3: 4 }, notes: "" }, { id: "da2", playerId: "d3", date: A(-1), scores: { dk1: 4, dk2: 3, dk3: 5 }, notes: "" }, { id: "da3", playerId: "d1", date: A(-2), scores: { dk1: 3, dk2: 4, dk3: 4 }, notes: "" });
    // В заготовке клуба миссий нет: для примера добавляются свои миссии с пометкой «демо».
    const need = { sport: ["Критерии развития игроков (демо)", "Набор вратарей (демо)"], children: ["Набор детей (демо)", "Адаптация новичков (демо)"], partners: ["Поиск партнёров (демо)"] };
    for (const [sid, names] of Object.entries(need)) { const s = sectors.find(x => x.id === sid); while (missionsFor(s).length < names.length) d.customMissions[sid].push(names[missionsFor(s).length]); }
    const T = (s, m, list) => list.forEach(([t, st]) => tasksFor(s, m).push({ title: t + " (демо)", status: st }));
    T("sport", 0, [["Выбрать критерии оценки", "выполнено"], ["Провести первую оценку", "в работе"], ["Обсудить результаты с тренерами", "не начато"]]);
    T("sport", 1, [["Набрать вратарей", "выполнено"], ["Провести контрольный матч", "в работе"]]);
    T("children", 0, [["Объявить набор", "выполнено"], ["Провести пробные тренировки", "выполнено"], ["Связаться с семьями", "в работе"]]);
    T("children", 1, [["Подготовить памятку новичкам", "в работе"]]);
    T("partners", 0, [["Составить список компаний", "выполнено"], ["Отправить предложения", "в работе"]]);
    const PR = (team, list) => list.forEach(([title, period, done], i) => d.program.push({ id: "dg" + team + i, team, title: title + " (демо)", period, done: !!done, doneDate: done ? A(-(12 - i * 3)) : "", notes: "" }));
    d.program = [];
    PR("2017", [["Катание: старты и остановки", "Сентябрь", 1], ["Работа с клюшкой: ведение шайбы", "Сентябрь", 1], ["Броски с места", "Октябрь", 1], ["Передачи в движении", "Октябрь", 0], ["Игра в трёх зонах", "Ноябрь", 0], ["Тактика: выход из зоны", "Декабрь", 0]]);
    PR("2018", [["Катание: повороты и виражи", "Сентябрь", 1], ["Ведение шайбы с обводкой", "Октябрь", 0], ["Броски по воротам", "Ноябрь", 0], ["Игра в большинстве", "Декабрь", 0]]);
    PR("2019", [["Первые шаги на льду", "Сентябрь", 1], ["Катание вперёд и назад", "Октябрь", 1], ["Знакомство с клюшкой и шайбой", "Ноябрь", 1], ["Простые игры на льду", "Декабрь", 0]]);
    PR("СОГ", [["ОФП и растяжка", "Сентябрь", 1], ["Скоростное катание", "Октябрь", 0], ["Игровые комбинации", "Ноябрь", 0]]);
    persist();
  }
})();
