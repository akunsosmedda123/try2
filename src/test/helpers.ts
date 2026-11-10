import { BASE_INGREDIENTS } from '../data/ingredients';
import { LAUK_RECIPES } from '../data/recipes';
import { BUMBU_RECIPES, NASI_RECIPES, SAYUR_RECIPES } from '../data/recipes2';
import { DEFAULT_SETTINGS, buildSeedDays } from '../data/seed';
import { makeCtx, type Ctx } from '../engine/context';
import type { Ingredient, Preferences, Recipe } from '../types';

export const ALL_RECIPES: Recipe[] = [...LAUK_RECIPES, ...SAYUR_RECIPES, ...NASI_RECIPES, ...BUMBU_RECIPES];

export function testCtx(opts: { prefs?: Partial<Preferences>; ingredients?: Ingredient[] } = {}): Ctx {
  const s = structuredClone(DEFAULT_SETTINGS);
  return makeCtx(opts.ingredients ?? structuredClone(BASE_INGREDIENTS), structuredClone(ALL_RECIPES), s.profile, { ...s.prefs, ...opts.prefs });
}
export const seedDays = () => buildSeedDays();
export const dayAfter = (d: string, n: number) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);
