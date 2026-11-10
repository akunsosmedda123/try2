import type { DayPlan, GroceryItem, GroceryList, Ingredient, PantryItem } from '../types';
import { CATEGORY_LABEL, CATEGORY_ORDER } from '../data/ingredients';
import type { Ctx } from './context';
import { stockByIngredient } from './pantry';
import { requirementsForDays } from './requirements';
import { fmtQty, rupiah, roundUpToPack } from './units';

export interface BuiltItems {
  items: GroceryItem[];
  stockUsed: Map<string, number>;
}

export const unitPrice = (ing: Ingredient): number | null => (ing.packPrice === null ? null : ing.packPrice / ing.packSize);

/** Hitung item belanja dari kebutuhan bahan. `stock` DIKURANGI in-place sesuai stok yang dipakai. */
export function buildGroceryItems(days: DayPlan[], ctx: Ctx, stock: Map<string, number>, idPrefix = 'g'): BuiltItems {
  const reqs = requirementsForDays(days, ctx, { stock });
  const items: GroceryItem[] = [];
  const stockUsed = new Map<string, number>();
  for (const line of reqs.values()) {
    const ing = ctx.ingredients.get(line.ingredientId);
    if (!ing) continue;
    const have = stock.get(ing.id) ?? 0;
    const used = Math.min(have, line.gross);
    if (used > 0) {
      stock.set(ing.id, have - used);
      stockUsed.set(ing.id, used);
    }
    const toBuy = line.gross - used;
    const { qty, packs } = roundUpToPack(toBuy, ing.packSize);
    const price = ing.packPrice;
    items.push({
      id: `${idPrefix}-${ing.id}`,
      ingredientId: ing.id,
      name: ing.name,
      category: ing.category,
      unit: ing.unit,
      need: line.gross,
      stock: used,
      buyQty: qty,
      packs,
      estUnitPrice: price,
      actualPrice: null,
      subtotal: packs === 0 ? 0 : price === null ? null : packs * price,
      checked: false,
      status: packs === 0 ? 'available' : 'to_buy',
      inBudget: ing.inBudget,
    });
  }
  items.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name));
  return { items, stockUsed };
}

export function buildGroceryList(
  planId: string,
  days: DayPlan[],
  ctx: Ctx,
  pantry: PantryItem[],
  onDate: string,
  now = new Date().toISOString(),
): GroceryList {
  const stock = stockByIngredient(pantry, ctx, onDate);
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const { items } = buildGroceryItems(sorted, ctx, stock);
  return {
    id: `gl-${planId}-${sorted[0]?.date ?? ''}-${sorted[sorted.length - 1]?.date ?? ''}`,
    planId,
    rangeStart: sorted[0]?.date ?? '',
    rangeEnd: sorted[sorted.length - 1]?.date ?? '',
    createdAt: now,
    items,
  };
}

/** Hitung ulang subtotal setelah pengguna mengubah jumlah atau harga. Harga kosong ≠ nol. */
export function recalcItem(item: GroceryItem, ing?: Ingredient): GroceryItem {
  const packSize = ing?.packSize ?? 1;
  const packs = packSize > 0 ? item.buyQty / packSize : 0;
  const subtotal = item.buyQty <= 0 ? 0 : item.estUnitPrice === null ? null : Math.round(packs * item.estUnitPrice);
  return { ...item, packs, subtotal, status: item.status === 'purchased' ? 'purchased' : item.buyQty <= 0 ? 'available' : 'to_buy' };
}

export function effectiveCost(item: GroceryItem): number | null {
  return item.actualPrice !== null ? item.actualPrice : item.subtotal;
}

export function groceryTotals(items: GroceryItem[]) {
  let budget = 0;
  let outside = 0;
  const unknown: string[] = [];
  let cashSpent = 0;
  for (const it of items) {
    if (it.status === 'purchased' && it.actualPrice !== null) cashSpent += it.actualPrice;
    if (it.buyQty <= 0 && it.status !== 'purchased') continue;
    const c = effectiveCost(it);
    if (c === null) { unknown.push(it.name); continue; }
    if (it.inBudget) budget += c; else outside += c;
  }
  const checked = items.filter((i) => i.checked).length;
  return { budget, outside, unknown, cashSpent, checked, total: items.length };
}

/** Pertahankan centang/harga aktual/edit manual saat daftar dibuat ulang. */
export function mergeWithPrevious(fresh: GroceryList, prev?: GroceryList): GroceryList {
  if (!prev) return fresh;
  const prevById = new Map(prev.items.map((i) => [i.id, i]));
  const merged = fresh.items.map((i) => {
    const p = prevById.get(i.id);
    return p && p.status === 'purchased' ? { ...i, checked: p.checked, actualPrice: p.actualPrice, status: 'purchased' as const } : p ? { ...i, checked: p.checked } : i;
  });
  const manual = prev.items.filter((i) => i.manual);
  return { ...fresh, items: [...merged, ...manual] };
}

export function whatsappText(list: GroceryList): string {
  const lines: string[] = [`*Daftar Belanja HOME TABLE*`, `${list.rangeStart} s/d ${list.rangeEnd}`, ''];
  for (const cat of CATEGORY_ORDER) {
    const rows = list.items.filter((i) => i.category === cat && i.buyQty > 0);
    if (!rows.length) continue;
    lines.push(`*${CATEGORY_LABEL[cat]}*`);
    for (const r of rows) lines.push(`${r.checked ? '☑' : '☐'} ${r.name} — ${fmtQty(r.buyQty, r.unit)}${r.subtotal !== null ? ` (±${rupiah(r.subtotal)})` : ''}`);
    lines.push('');
  }
  const t = groceryTotals(list.items);
  lines.push(`Estimasi dalam budget: ${rupiah(t.budget)}`, `Di luar budget: ${rupiah(t.outside)}`);
  if (t.unknown.length) lines.push(`Harga belum diisi: ${t.unknown.join(', ')}`);
  return lines.join('\n');
}
