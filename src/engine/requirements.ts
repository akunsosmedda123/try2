import type { DayPlan, Ingredient, Recipe } from '../types';
import { BUMBU_DEFS } from '../data/bumbu';
import type { Ctx } from './context';
import { adultRiceMealsExact, childFactor, servingsForDay, totalUnits } from './portions';

export interface ReqLine {
  ingredientId: string;
  net: number; // kebutuhan bersih (edible)
  gross: number; // kebutuhan kotor yang harus dibeli/dipakai dari stok
  bySource: Record<string, number>; // recipeId -> gross
}

/** Biaya per gram/ml/pcs BERSIH (memperhitungkan edible yield). null bila harga kosong. */
export function costPerNet(ing: Ingredient): number | null {
  if (ing.packPrice === null) return null;
  return ing.packPrice / ing.packSize / ing.ediblePct;
}

export interface ChooseOpts {
  /** stok gross per bahan yang boleh dipakai (sudah dikonfirmasi & aman) */
  stock?: Map<string, number>;
  /** selisih biaya <= ini dianggap setara, lalu urutan daftar opsi yang menentukan (potong > paha > fillet) */
  tieTolerance?: number;
}

/** Pilih bahan terbaik di antara bahan utama + opsi (stok dulu, lalu paling murah; seri → urutan resep). */
export function chooseIngredient(ids: string[], ctx: Ctx, o: ChooseOpts = {}): string {
  const cands = ids.map((id) => ctx.ingredients.get(id)).filter((x): x is Ingredient => !!x && x.buyable !== false);
  if (cands.length <= 1) return cands[0]?.id ?? ids[0];
  const withStock = cands.filter((c) => (o.stock?.get(c.id) ?? 0) > 0);
  if (withStock.length) return withStock[0].id;
  const priced = cands.filter((c) => costPerNet(c) !== null);
  if (!priced.length) return cands[0].id;
  const min = Math.min(...priced.map((c) => costPerNet(c) as number));
  const tol = o.tieTolerance ?? 0.05;
  // pertahankan urutan resep: bahan pertama yang biayanya dalam toleransi
  return priced.find((c) => (costPerNet(c) as number) <= min * (1 + tol))!.id;
}

function addLine(map: Map<string, ReqLine>, ing: Ingredient, net: number, source: string) {
  if (net <= 0) return;
  const gross = net / ing.ediblePct;
  const l = map.get(ing.id) ?? { ingredientId: ing.id, net: 0, gross: 0, bySource: {} };
  l.net += net;
  l.gross += gross;
  l.bySource[source] = (l.bySource[source] ?? 0) + gross;
  map.set(ing.id, l);
}

/** Kebutuhan bahan dari satu resep untuk `adultUnits` dewasa + `childPortions` porsi anak. */
export function recipeRequirement(
  recipe: Recipe,
  adultUnits: number,
  childPortions: number,
  ctx: Ctx,
  co: ChooseOpts = {},
  into: Map<string, ReqLine> = new Map(),
  includeBumbu = true,
): Map<string, ReqLine> {
  const cf = childFactor(recipe, ctx);
  const ratioFor = (): number => (adultUnits + childPortions * cf) / recipe.serves;
  for (const ri of recipe.ingredients) {
    const chosen = chooseIngredient([ri.ingredientId, ...(ri.options ?? [])], ctx, co);
    const ing = ctx.ingredients.get(chosen);
    if (!ing) continue;
    const perUnit = ri.amount / recipe.serves;
    const override = recipe.childPortionGrams?.[ri.ingredientId];
    let net: number;
    if (override !== undefined) net = adultUnits * perUnit + childPortions * override;
    else net = ri.amount * ratioFor();
    addLine(into, ing, net, recipe.id);
  }
  if (includeBumbu) {
    for (const b of recipe.bumbu) {
      const def = BUMBU_DEFS[b.type];
      const grams = b.grams * ratioFor();
      for (const base of def.base) {
        const ing = ctx.ingredients.get(base.ingredientId);
        if (ing) addLine(into, ing, (base.amount / 100) * grams, `bumbu:${b.type}`);
      }
    }
  }
  return into;
}

export function requirementsForDay(day: DayPlan, ctx: Ctx, co: ChooseOpts = {}, into: Map<string, ReqLine> = new Map()): Map<string, ReqLine> {
  for (const s of servingsForDay(day, ctx).values()) {
    const recipe = ctx.recipes.get(s.recipeId);
    if (!recipe) continue;
    recipeRequirement(recipe, s.adultUnits, s.childPortions, ctx, co, into);
  }
  // nasi dewasa (beras polos)
  const beras = ctx.ingredients.get('beras');
  if (beras) addLine(into, beras, adultRiceMealsExact(day) * ctx.prefs.adultRiceGPerMeal, 'nasi-dewasa');
  return into;
}

export function requirementsForDays(days: DayPlan[], ctx: Ctx, co: ChooseOpts = {}): Map<string, ReqLine> {
  const m = new Map<string, ReqLine>();
  for (const d of days) requirementsForDay(d, ctx, co, m);
  return m;
}

export { totalUnits };
