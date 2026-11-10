import type { Ingredient, PantryItem, StorageLocation } from '../types';
import { addDaysStr } from './calendar';
import type { Ctx } from './context';
import { toBase } from './units';

/** Stok hanya dihitung bila: sudah dikonfirmasi pengguna, aman, mentah, dan belum lewat tanggal pakai. */
export function isUsable(item: PantryItem, onDate: string): boolean {
  if (!item.confirmed) return false;
  if (item.safety !== 'aman') return false;
  if (item.condition !== 'mentah') return false;
  if (item.useBy && item.useBy < onDate) return false;
  return item.qty > 0;
}

export function itemBaseQty(item: PantryItem, ing: Ingredient | undefined): number | null {
  return toBase(item.qty, item.unit, ing);
}

/** Total stok (kotor, satuan dasar bahan) per bahan dari item yang dapat dipakai. */
export function stockByIngredient(items: PantryItem[], ctx: Ctx, onDate: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    if (!isUsable(it, onDate)) continue;
    const q = itemBaseQty(it, ctx.ingredients.get(it.ingredientId));
    if (q === null) continue;
    m.set(it.ingredientId, (m.get(it.ingredientId) ?? 0) + q);
  }
  return m;
}

/** FEFO: yang paling cepat habis masa pakainya dulu; tanpa tanggal ditaruh paling akhir. */
export function fefo(items: PantryItem[]): PantryItem[] {
  return [...items].sort((a, b) => {
    if (!a.useBy && !b.useBy) return 0;
    if (!a.useBy) return 1;
    if (!b.useBy) return -1;
    return a.useBy.localeCompare(b.useBy);
  });
}

export function defaultUseBy(ing: Ingredient | undefined, location: StorageLocation, fromDate: string, condition: 'mentah' | 'matang' = 'mentah'): string {
  if (condition === 'matang') return addDaysStr(fromDate, location === 'freezer' ? 30 : 2);
  const days = ing?.shelfDays?.[location];
  return days ? addDaysStr(fromDate, days) : '';
}

export function expiringSoon(items: PantryItem[], onDate: string, withinDays = 2): PantryItem[] {
  const limit = addDaysStr(onDate, withinDays);
  return items.filter((i) => i.confirmed && i.useBy && i.useBy >= onDate && i.useBy <= limit);
}

export function expired(items: PantryItem[], onDate: string): PantryItem[] {
  return items.filter((i) => i.useBy && i.useBy < onDate);
}

/**
 * Kurangi stok (FEFO) ketika masak SUDAH dilakukan/dikonfirmasi pengguna.
 * Tidak pernah dipanggil hanya karena menu dijadwalkan.
 */
export function consumeStock(
  items: PantryItem[],
  ingredientId: string,
  amount: number,
  ctx: Ctx,
  onDate: string,
): { items: PantryItem[]; consumed: number; shortfall: number } {
  const ing = ctx.ingredients.get(ingredientId);
  let left = amount;
  const byId = new Map(items.map((i) => [i.id, { ...i }]));
  const candidates = fefo(items.filter((i) => i.ingredientId === ingredientId && isUsable(i, onDate)));
  for (const c of candidates) {
    if (left <= 1e-9) break;
    const have = itemBaseQty(c, ing);
    if (have === null || have <= 0) continue;
    const take = Math.min(have, left);
    const ratio = take / have;
    const target = byId.get(c.id)!;
    target.qty = Math.max(0, +(c.qty * (1 - ratio)).toFixed(4));
    left -= take;
  }
  return { items: [...byId.values()], consumed: amount - left, shortfall: Math.max(0, left) };
}

/** Item stok yang dilarang dipakai: dibekukan/dibeli terlalu lama atau status tidak aman. */
export function unsafeItems(items: PantryItem[], onDate: string): PantryItem[] {
  return items.filter((i) => i.safety === 'tidak_aman' || (i.useBy && i.useBy < onDate));
}
