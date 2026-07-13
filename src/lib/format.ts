const WEEKDAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const MONTHS_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const pad = (n: number) => String(n).padStart(2, "0");

/** 19:30 */
export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 2026/08/08 (六) */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} (${WEEKDAYS_ZH[d.getDay()]})`;
}

/** 08 AUG —— 登機證用的航空風日期 */
export function fmtDateEn(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())} ${MONTHS_EN[d.getMonth()]}`;
}

/** 2026-08-08T18:30 → <input type="datetime-local"> 用 */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
