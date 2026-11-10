import type { DayPlan, Recipe } from '../types';
import type { Ctx } from './context';
import { isWeekend } from './calendar';
import { recipeRequirement } from './requirements';
import { servingsForDay } from './portions';
import { ADULT_ALT_DEFAULT } from './portions';

export interface CookTask {
  id: string;
  label: string;
  minutes: number;
  recipeId?: string;
}
export interface CookSession {
  id: 'pagi' | 'sore' | 'weekend';
  title: string;
  tasks: CookTask[];
  minutes: number;
}

const rn = (ctx: Ctx, id: string): string => ctx.recipes.get(id)?.name ?? id;
const mins = (r?: Recipe): number => (r ? r.prepMin + r.cookMin : 0);

/** Sesi memasak per hari: weekday maks. 2 (pagi, sore); weekend 1 sesi. Food prep bukan sesi memasak harian. */
export function cookingSessions(day: DayPlan, ctx: Ctx): CookSession[] {
  const A = ctx.recipes.get(day.mainA);
  const B = ctx.recipes.get(day.mainB);
  const V = ctx.recipes.get(day.veg);
  const R = ctx.recipes.get(day.rice);
  const egg = ctx.recipes.get('telur-ceplok');
  const eggTask: CookTask = { id: 'telur', label: `Masak ${ctx.prefs.motherBreakfastEggs} telur ceplok ibu`, minutes: 5, recipeId: 'telur-ceplok' };
  const rice: CookTask = { id: 'nasi', label: `Masak nasi anak: ${R?.name ?? day.rice}${day.riceNote ? ' ' + day.riceNote : ''}`, minutes: mins(R) || 25, recipeId: day.rice };
  const veg: CookTask = { id: 'sayur', label: `Masak sayur harian: ${V?.name ?? day.veg}`, minutes: mins(V), recipeId: day.veg };
  void egg;

  if (isWeekend(day.date)) {
    const tasks: CookTask[] = [
      { id: 'bahan', label: 'Siapkan bahan dan bumbu', minutes: 15 },
      eggTask,
      rice,
      { id: 'laukA', label: `Masak lauk A (pagi-siang): ${A?.name ?? day.mainA}`, minutes: mins(A), recipeId: day.mainA },
      { id: 'laukB', label: `Masak lauk B (malam): ${B?.name ?? day.mainB}`, minutes: mins(B), recipeId: day.mainB },
      veg,
      { id: 'bagi', label: 'Bagi porsi per waktu makan', minutes: 10 },
      { id: 'simpan', label: 'Simpan makanan berikutnya dengan aman (kulkas, jangan di suhu ruang)', minutes: 5 },
    ];
    return [{ id: 'weekend', title: 'Sesi masak weekend (satu sesi)', tasks, minutes: tasks.reduce((s, t) => s + t.minutes, 0) }];
  }

  const lunch = day.motherLunch.mode === 'follow'
    ? { id: 'siang-ibu', label: 'Siapkan lauk makan siang ibu: ikut lauk anak', minutes: 3 }
    : { id: 'siang-ibu', label: `Siapkan lauk makan siang ibu: ambil ${rn(ctx, day.motherLunch.recipeId ?? ADULT_ALT_DEFAULT)} dari food prep`, minutes: 5, recipeId: day.motherLunch.recipeId ?? ADULT_ALT_DEFAULT };
  const pagi: CookTask[] = [
    { id: 'bahan', label: 'Siapkan bahan', minutes: 10 },
    eggTask,
    rice,
    { id: 'laukA', label: `Masak lauk anak (pagi-siang): ${A?.name ?? day.mainA}`, minutes: mins(A), recipeId: day.mainA },
    lunch,
    veg,
    { id: 'simpan', label: 'Simpan makanan dengan aman', minutes: 5 },
  ];
  const sore: CookTask[] = [
    { id: 'ambil', label: 'Ambil bahan', minutes: 5 },
    { id: 'laukB', label: `Masak lauk keluarga: ${B?.name ?? day.mainB}`, minutes: mins(B), recipeId: day.mainB },
    { id: 'sayur', label: 'Sajikan sayur harian (sayur pagi dipakai lagi, tidak masak sayur kedua)', minutes: 5 },
    { id: 'sajikan', label: 'Sajikan makan malam', minutes: 5 },
  ];
  return [
    { id: 'pagi', title: 'Sesi pagi', tasks: pagi, minutes: pagi.reduce((s, t) => s + t.minutes, 0) },
    { id: 'sore', title: 'Sesi sore', tasks: sore, minutes: sore.reduce((s, t) => s + t.minutes, 0) },
  ];
}

export const sessionCount = (day: DayPlan, ctx: Ctx): number => cookingSessions(day, ctx).length;

/** Urutan memasak yang disarankan: yang paling lama dulu. */
export function suggestedOrder(session: CookSession): CookTask[] {
  return [...session.tasks].filter((t) => t.recipeId).sort((a, b) => b.minutes - a.minutes);
}

// ===== Food prep mingguan =====
export interface PrepTask {
  id: string;
  label: string;
  detail: string;
}
export interface PrepContainer {
  ingredient: string;
  grams: number;
  unit: string;
  menu: string;
  date: string;
  condition: 'mentah';
  location: 'kulkas' | 'freezer';
}

export function prepContainers(days: DayPlan[], ctx: Ctx): PrepContainer[] {
  const out: PrepContainer[] = [];
  for (const d of days) {
    for (const s of servingsForDay(d, ctx).values()) {
      const r = ctx.recipes.get(s.recipeId);
      if (!r || !['ayam', 'ikan', 'udang', 'cumi', 'sapi', 'hati'].includes(r.protein) || r.role !== 'lauk') continue;
      const reqs = recipeRequirement(r, s.adultUnits, s.childPortions, ctx, {}, new Map(), false);
      for (const l of reqs.values()) {
        const ing = ctx.ingredients.get(l.ingredientId);
        if (!ing || !ing.protein || ing.protein === 'none' || ing.protein === 'tahu_tempe') continue;
        out.push({ ingredient: ing.name, grams: Math.round(l.gross), unit: ing.unit, menu: r.name, date: d.date, condition: 'mentah', location: 'kulkas' });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function foodPrepTasks(days: DayPlan[], ctx: Ctx): PrepTask[] {
  const kinds = new Set<string>();
  for (const d of days) for (const id of [d.mainA, d.mainB]) {
    const r = ctx.recipes.get(id);
    if (r) kinds.add(r.protein);
  }
  const bumbu = new Set<string>();
  for (const d of days) for (const s of servingsForDay(d, ctx).values()) ctx.recipes.get(s.recipeId)?.bumbu.forEach((b) => bumbu.add(b.type));
  const t: PrepTask[] = [];
  if (kinds.has('ayam')) t.push({ id: 'ayam', label: 'Bagi ayam', detail: 'Bagi per menu, simpan di kulkas (≤2 hari) atau freezer.' });
  if (kinds.has('ikan')) t.push({ id: 'ikan', label: 'Bagi ikan', detail: 'Bersihkan, bagi per menu; ikan segar simpan paling lama 1 hari di kulkas atau bekukan.' });
  if (kinds.has('udang') || kinds.has('cumi')) t.push({ id: 'seafood', label: 'Siapkan seafood anak', detail: 'Porsi anak saja. Gunakan stok beku dulu. Cumi hanya untuk menu weekday.' });
  if (bumbu.has('kuning')) t.push({ id: 'kuning', label: 'Siapkan bumbu kuning', detail: 'Lihat Smart Bumbu Prep untuk jumlah.' });
  if (bumbu.has('putih')) t.push({ id: 'putih', label: 'Siapkan bumbu putih', detail: 'Lihat Smart Bumbu Prep untuk jumlah.' });
  if (bumbu.has('merah_tanpa_cabai') || bumbu.has('merah_pedas')) t.push({ id: 'merah', label: 'Siapkan bumbu merah', detail: 'Pisahkan versi tanpa cabai (anak) dari versi pedas (dewasa).' });
  if (bumbu.has('bawang_merah_cincang') || bumbu.has('bawang_putih_cincang')) t.push({ id: 'cincang', label: 'Siapkan bawang cincang', detail: 'Merah dan putih, wadah terpisah.' });
  t.push({ id: 'sayur', label: 'Siapkan sayur', detail: 'Cuci dan potong sayur untuk beberapa hari ke depan (simpan kering di kulkas).' });
  t.push({ id: 'label', label: 'Beri label wadah', detail: 'Nama bahan, berat, menu tujuan, tanggal, kondisi, lokasi, rencana pemakaian.' });
  return t;
}
