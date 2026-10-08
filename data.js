// Данные клуба: восемь секторов. Пустая заготовка — миссии, факты и матчи клуб вносит сам (или вы заполняете здесь).
// Изолированы в блочной области: остальной код получает их через window.ClubData (так не возникает конфликта глобальных const).
// Менять можно названия (name, short), списки missions и facts. Поле id и позиции (position) не трогайте.
// Необязательные блоки на панели сектора (если поля нет — блока нет):
//   у сектора 'sport':     resources: { title, cells: [{ label, value, unit }], notes: [] }
//   у сектора 'children':  intro: { title, steps: [], highlight: { value, unit } }
{
const SEASONS = ['2026-27', '2027-28', '2028-29'];

const sectors = [
  { id: 'sport', name: 'Спорт', short: 'СПОРТ', position: 'top-left', missions: [], facts: [] },
  { id: 'children', name: 'Дети', short: 'ДЕТИ', position: 'left-high', missions: [], facts: [] },
  { id: 'education', name: 'Программа', short: 'ПРОГРАММА', position: 'left-low', missions: [], facts: [] },
  { id: 'competitions', name: 'Соревнования', short: 'СОРЕВНОВАНИЯ', position: 'bottom-left', missions: [], facts: [] },
  { id: 'finance', name: 'Финансы', short: 'ФИНАНСЫ', position: 'bottom-right', missions: [], facts: [], restricted: true },
  { id: 'partners', name: 'Партнёры', short: 'ПАРТНЁРЫ', position: 'right-low', missions: [], facts: [] },
  { id: 'media', name: 'Медиа', short: 'МЕДИА', position: 'right-high', missions: [], facts: [] },
  { id: 'digital', name: 'Цифровой штаб', short: 'ЦИФРОВОЙ ШТАБ', position: 'top-right', missions: [], facts: [] }
];

const matches = [];

window.ClubData = { SEASONS, sectors, matches };
}
