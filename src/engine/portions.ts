import type { DayPlan, Member, MealSlot, Recipe } from '../types';
import type { Ctx } from './context';
import { isWeekend } from './calendar';

export const EGG_RECIPE_ID = 'telur-ceplok';
export const ADULT_ALT_DEFAULT = 'ayam-suwir';

export type ItemKind = 'lauk' | 'sayur' | 'nasi' | 'sarapan' | 'pendamping';
export interface OccItem {
  recipeId: string;
  kind: ItemKind;
  /** hanya untuk sarapan ibu: jumlah butir telur */
  units?: number;
}
export interface Occasion {
  member: Member;
  slot: MealSlot;
  items: OccItem[];
}

/** Siapa makan apa pada suatu hari (sumber tunggal untuk validasi, belanja, dan jurnal). */
export function occasionsForDay(day: DayPlan, ctx: Ctx): Occasion[] {
  const weekend = isWeekend(day.date);
  const eggs = ctx.prefs.motherBreakfastEggs;
  const occ: Occasion[] = [];
  const egg: OccItem[] = eggs > 0 ? [{ recipeId: EGG_RECIPE_ID, kind: 'sarapan', units: eggs }] : [];
  const sides = day.sides.map((s) => ({ recipeId: s, kind: 'pendamping' as const }));
  const lunchLauk = (): OccItem =>
    day.motherLunch.mode === 'follow' || weekend
      ? { recipeId: day.mainA, kind: 'lauk' }
      : { recipeId: day.motherLunch.recipeId ?? ADULT_ALT_DEFAULT, kind: 'lauk' };

  // Ibu: 3x sehari
  occ.push({ member: 'ibu', slot: 'sarapan', items: egg });
  occ.push({ member: 'ibu', slot: 'siang', items: [lunchLauk(), { recipeId: day.veg, kind: 'sayur' }] });
  occ.push({ member: 'ibu', slot: 'malam', items: [{ recipeId: day.mainB, kind: 'lauk' }, { recipeId: day.veg, kind: 'sayur' }, ...sides] });

  // Ayah: weekday hanya malam, weekend 3x (A, A, B)
  if (weekend) {
    occ.push({ member: 'ayah', slot: 'sarapan', items: [{ recipeId: day.mainA, kind: 'lauk' }] });
    occ.push({ member: 'ayah', slot: 'siang', items: [{ recipeId: day.mainA, kind: 'lauk' }, { recipeId: day.veg, kind: 'sayur' }] });
  }
  occ.push({ member: 'ayah', slot: 'malam', items: [{ recipeId: day.mainB, kind: 'lauk' }, { recipeId: day.veg, kind: 'sayur' }, ...sides] });

  // Anak: 3x sehari, lauk A pagi+siang, lauk B malam, nasi tiap makan
  const rice: OccItem = { recipeId: day.rice, kind: 'nasi' };
  occ.push({ member: 'anak', slot: 'sarapan', items: [{ recipeId: day.mainA, kind: 'lauk' }, rice] });
  occ.push({ member: 'anak', slot: 'siang', items: [{ recipeId: day.mainA, kind: 'lauk' }, { recipeId: day.veg, kind: 'sayur' }, rice] });
  occ.push({ member: 'anak', slot: 'malam', items: [{ recipeId: day.mainB, kind: 'lauk' }, { recipeId: day.veg, kind: 'sayur' }, rice] });
  return occ;
}

export interface Serving {
  recipeId: string;
  kind: ItemKind;
  adultUnits: number; // jumlah porsi dewasa penuh
  childPortions: number; // jumlah kali anak makan resep ini
}

export function servingsForDay(day: DayPlan, ctx: Ctx): Map<string, Serving> {
  const out = new Map<string, Serving>();
  for (const o of occasionsForDay(day, ctx)) {
    for (const it of o.items) {
      const key = it.recipeId;
      const s = out.get(key) ?? { recipeId: key, kind: it.kind, adultUnits: 0, childPortions: 0 };
      if (o.member === 'anak') s.childPortions += 1;
      else s.adultUnits += it.units ?? 1;
      out.set(key, s);
    }
  }
  return out;
}

export function childFactor(recipe: Recipe, ctx: Ctx): number {
  return recipe.childPortionFactor ?? ctx.profile.childPortionFactor;
}

/** Total porsi dewasa-ekuivalen yang dibutuhkan untuk resep. */
export function totalUnits(s: Serving, recipe: Recipe, ctx: Ctx): number {
  return s.adultUnits + s.childPortions * childFactor(recipe, ctx);
}

/** Jumlah makan nasi dewasa pada hari itu (nasi dewasa = beras polos, di luar budget). */
export function adultRiceMealsExact(day: DayPlan): number {
  // weekday: ibu siang + ibu malam + ayah malam = 3 ; weekend: ibu siang+malam, ayah pagi+siang+malam = 5
  return isWeekend(day.date) ? 5 : 3;
}
