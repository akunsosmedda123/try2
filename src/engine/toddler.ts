import type { DayPlan, JournalEntry, PortionEaten, SeafoodEvent } from '../types';
import type { Ctx } from './context';
import { addDaysStr, diffDays, eachDate } from './calendar';
import { laukOfMember, isSeafoodRecipe } from './validate';
import { combinedStatus, recipeGluten } from './restrictions';
import { isWeekend } from './calendar';

export const PORTION_VALUE: Record<PortionEaten, number> = { habis: 1, '3/4': 0.75, '1/2': 0.5, '1/4': 0.25, tidak: 0 };

export type SeafoodStatus = 'COMPLETED' | 'DUE SOON' | 'OVERDUE' | 'NO HISTORY';
export interface SeafoodTracker {
  lastDate?: string;
  lastType?: 'udang' | 'cumi';
  nextDue?: string;
  daysLeft?: number;
  status: SeafoodStatus;
  plannedNext?: { date: string; type: 'udang' | 'cumi' };
  plannedOk: boolean;
}

/** Seafood yang BENAR-BENAR dimakan (jurnal, porsi > 0) + catatan manual. Menu terjadwal tidak dihitung. */
export function actualSeafoodEvents(journal: JournalEntry[], ctx: Ctx, manual: SeafoodEvent[]): SeafoodEvent[] {
  const fromJournal: SeafoodEvent[] = journal
    .filter((j) => j.recipeId && PORTION_VALUE[j.eaten] > 0)
    .flatMap((j) => {
      const r = ctx.recipes.get(j.recipeId!);
      const t = r ? isSeafoodRecipe(r) : null;
      return t ? [{ id: `j-${j.id}`, date: j.date, type: t, source: 'journal' as const }] : [];
    });
  return [...manual, ...fromJournal].sort((a, b) => a.date.localeCompare(b.date));
}

export function seafoodTracker(events: SeafoodEvent[], planDays: DayPlan[], ctx: Ctx, today: string): SeafoodTracker {
  const past = events.filter((e) => e.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const last = past[0];
  const planned = [...planDays].sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((d) => {
      const t = laukOfMember(d, 'anak', ctx).map(isSeafoodRecipe).find((x) => x);
      return t ? [{ date: d.date, type: t }] : [];
    })
    .filter((p) => p.date >= today);
  const plannedNext = planned[0];
  if (!last) return { status: 'NO HISTORY', plannedNext, plannedOk: !!plannedNext && diffDays(plannedNext.date, today) <= 14 };
  const nextDue = addDaysStr(last.date, 14);
  const daysLeft = diffDays(nextDue, today);
  const status: SeafoodStatus = daysLeft < 0 ? 'OVERDUE' : daysLeft <= 3 ? 'DUE SOON' : 'COMPLETED';
  return { lastDate: last.date, lastType: last.type, nextDue, daysLeft, status, plannedNext, plannedOk: !!plannedNext && plannedNext.date <= nextDue };
}

export interface ToddlerDay {
  date: string;
  meals: { slot: 'sarapan' | 'siang' | 'malam'; lauk: string; recipeId: string }[];
  veg: string;
  rice: string;
  riceNote?: string;
  fat: string;
  ironRich: boolean;
  beef: boolean;
  seafood: 'udang' | 'cumi' | null;
  gluten: 'SAFE' | 'NEEDS_VERIFICATION' | 'NOT_SUITABLE';
  status: ReturnType<typeof combinedStatus>;
}

/** Ringkasan menu RENCANA hari itu untuk anak (planned meals; bukan konsumsi aktual). */
export function toddlerDay(day: DayPlan, ctx: Ctx): ToddlerDay {
  const A = ctx.recipes.get(day.mainA);
  const B = ctx.recipes.get(day.mainB);
  const rice = ctx.recipes.get(day.rice);
  const lauk = [A, B].filter((r): r is NonNullable<typeof r> => !!r);
  let worst: ToddlerDay['gluten'] = 'SAFE';
  for (const r of [...lauk, rice, ctx.recipes.get(day.veg)]) {
    if (!r) continue;
    const g = recipeGluten(r, ctx);
    if (g === 'NOT_SUITABLE' || (g === 'NEEDS_VERIFICATION' && worst === 'SAFE')) worst = g;
  }
  const weekend = isWeekend(day.date);
  const status = lauk.length ? combinedStatus(lauk[0], ['anak'], ctx, { weekend, asMain: true }) : 'SAFE';
  return {
    date: day.date,
    meals: [
      { slot: 'sarapan', lauk: A?.name ?? day.mainA, recipeId: day.mainA },
      { slot: 'siang', lauk: A?.name ?? day.mainA, recipeId: day.mainA },
      { slot: 'malam', lauk: B?.name ?? day.mainB, recipeId: day.mainB },
    ],
    veg: ctx.recipes.get(day.veg)?.name ?? day.veg,
    rice: rice?.name ?? day.rice,
    riceNote: day.riceNote,
    fat: rice?.note?.replace(/\. Lauk pendamping.*$/, '').replace('Jenis lemak: ', '') ?? '-',
    ironRich: lauk.some((r) => r.ironRich),
    beef: lauk.some((r) => r.protein === 'sapi'),
    seafood: lauk.map(isSeafoodRecipe).find((x) => x) ?? null,
    gluten: worst,
    status,
  };
}

export interface WeeklyReview {
  entries: number;
  proteins: string[];
  lauk: number;
  rice: number;
  veg: number;
  beef: number;
  seafood: number;
  extraFat: number;
  favorites: string[];
  leftovers: string[];
  avgEaten: number;
}

export function weeklyReview(journal: JournalEntry[], ctx: Ctx, start: string): WeeklyReview {
  const dates = new Set(eachDate(start, addDaysStr(start, 6)));
  const es = journal.filter((j) => dates.has(j.date));
  const ate = es.filter((e) => PORTION_VALUE[e.eaten] > 0);
  const proteinSet = new Set<string>();
  let beef = 0;
  let seafood = 0;
  for (const e of ate) {
    const r = e.recipeId ? ctx.recipes.get(e.recipeId) : undefined;
    if (r && r.protein !== 'none') proteinSet.add(r.protein);
    else if (e.protein) proteinSet.add(e.protein.toLowerCase());
    if (r?.protein === 'sapi') beef++;
    if (r && isSeafoodRecipe(r)) seafood++;
  }
  const tally = (f: (e: JournalEntry) => string) => new Set(ate.map(f).filter(Boolean)).size;
  const byMenu = new Map<string, { n: number; full: number; left: number }>();
  for (const e of es) {
    if (!e.menu) continue;
    const m = byMenu.get(e.menu) ?? { n: 0, full: 0, left: 0 };
    m.n++;
    if (e.eaten === 'habis') m.full++;
    if (e.eaten === '1/4' || e.eaten === 'tidak') m.left++;
    byMenu.set(e.menu, m);
  }
  const avg = es.length ? es.reduce((s, e) => s + PORTION_VALUE[e.eaten], 0) / es.length : 0;
  return {
    entries: es.length,
    proteins: [...proteinSet],
    lauk: tally((e) => e.menu), rice: tally((e) => e.rice), veg: tally((e) => e.veg),
    beef, seafood,
    extraFat: es.filter((e) => e.extraFat.trim() && PORTION_VALUE[e.eaten] > 0).length,
    favorites: [...byMenu.entries()].filter(([, v]) => v.full >= 2 || (v.n === v.full && v.n >= 1)).map(([k]) => k).slice(0, 5),
    leftovers: [...byMenu.entries()].filter(([, v]) => v.left >= 1).map(([k]) => k).slice(0, 5),
    avgEaten: Math.round(avg * 100) / 100,
  };
}
