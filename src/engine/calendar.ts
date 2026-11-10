import { addDays, differenceInCalendarDays, format, getDay, parseISO } from 'date-fns';

export const ymd = (d: Date): string => format(d, 'yyyy-MM-dd');
export const parse = (s: string): Date => parseISO(s);

export function isWeekend(date: string): boolean {
  const g = getDay(parse(date));
  return g === 0 || g === 6;
}

export function addDaysStr(date: string, n: number): string {
  return ymd(addDays(parse(date), n));
}

export function diffDays(a: string, b: string): number {
  return differenceInCalendarDays(parse(a), parse(b));
}

/** Senin dari minggu kalender yang memuat tanggal. */
export function weekStart(date: string): string {
  const g = getDay(parse(date)); // 0=Min
  const back = g === 0 ? 6 : g - 1;
  return addDaysStr(date, -back);
}

export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; diffDays(end, d) >= 0; d = addDaysStr(d, 1)) out.push(d);
  return out;
}

export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const dayName = (date: string): string => DAY_NAMES[getDay(parse(date))];

export function longDate(date: string): string {
  const d = parse(date);
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${dayName(date)}, ${d.getDate()} ${months[d.getMonth()]}`;
}

export function shortDate(date: string): string {
  const d = parse(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

/** Kelompokkan tanggal berurutan ke minggu kalender (Senin–Minggu). */
export function groupByWeek(dates: string[]): { start: string; dates: string[]; partial: boolean }[] {
  const map = new Map<string, string[]>();
  for (const d of dates) {
    const k = weekStart(d);
    map.set(k, [...(map.get(k) ?? []), d]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([start, ds]) => ({ start, dates: ds, partial: ds.length < 7 }));
}

export function today(): string {
  return ymd(new Date());
}
