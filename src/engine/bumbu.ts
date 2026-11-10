import type { BumbuId, DayPlan, SpiceBatch, StorageLocation, Unit } from '../types';
import { BUMBU_CONTAINER_G, BUMBU_DEFS, BUMBU_SHELF } from '../data/bumbu';
import { addDaysStr, shortDate } from './calendar';
import type { Ctx } from './context';
import { servingsForDay, totalUnits } from './portions';

export interface BumbuNeed {
  bumbuId: BumbuId;
  label: string;
  spicy: boolean;
  needGrams: number; // total bumbu jadi yang dibutuhkan di rentang
  stockGrams: number; // stok bumbu terkonfirmasi & belum kedaluwarsa
  prepGrams: number; // yang masih harus dibuat
  containers: number; // jumlah wadah @100 g untuk kebutuhan
  split: { recipeId: string; recipeName: string; grams: number }[];
  raw: { ingredientId: string; name: string; amount: number; unit: Unit }[]; // bahan mentah untuk prepGrams
  firstDate: string; // tanggal pertama bumbu dipakai
}

export interface PrepLabel {
  bumbuId: BumbuId;
  label: string;
  text: string;
  containers: number;
  gramsPerContainer: number;
  location: StorageLocation;
  madeDate: string;
  useBy: string;
}

/** Kebutuhan bumbu dasar dari takaran resep sebenarnya, dikurangi stok bumbu terkonfirmasi. */
export function bumbuNeeds(days: DayPlan[], ctx: Ctx, stock: SpiceBatch[], today: string): BumbuNeed[] {
  const acc = new Map<BumbuId, { grams: number; split: Map<string, number>; firstDate: string }>();
  for (const day of days) {
    for (const s of servingsForDay(day, ctx).values()) {
      const recipe = ctx.recipes.get(s.recipeId);
      if (!recipe || !recipe.bumbu.length) continue;
      const ratio = totalUnits(s, recipe, ctx) / recipe.serves;
      for (const b of recipe.bumbu) {
        const grams = b.grams * ratio;
        if (grams <= 0) continue;
        const a = acc.get(b.type) ?? { grams: 0, split: new Map<string, number>(), firstDate: day.date };
        a.grams += grams;
        a.split.set(recipe.id, (a.split.get(recipe.id) ?? 0) + grams);
        if (day.date < a.firstDate) a.firstDate = day.date;
        acc.set(b.type, a);
      }
    }
  }

  const out: BumbuNeed[] = [];
  for (const [bumbuId, a] of acc) {
    const def = BUMBU_DEFS[bumbuId];
    if (!def) continue;
    const stockGrams = stock
      .filter((b) => b.bumbuId === bumbuId && b.confirmed && b.useBy >= today)
      .reduce((sum, b) => sum + b.grams, 0);
    const prepGrams = Math.max(0, a.grams - stockGrams);
    const raw = def.base
      .map((base) => {
        const ing = ctx.ingredients.get(base.ingredientId);
        return {
          ingredientId: base.ingredientId,
          name: ing?.name ?? base.ingredientId,
          amount: (base.amount / 100) * prepGrams,
          unit: (ing?.unit ?? 'g') as Unit,
        };
      })
      .filter((r) => r.amount > 0);
    out.push({
      bumbuId,
      label: def.label,
      spicy: def.spicy,
      needGrams: a.grams,
      stockGrams,
      prepGrams,
      containers: Math.max(1, Math.ceil(a.grams / BUMBU_CONTAINER_G)),
      split: [...a.split].map(([recipeId, grams]) => ({ recipeId, recipeName: ctx.recipes.get(recipeId)?.name ?? recipeId, grams })),
      raw,
      firstDate: a.firstDate,
    });
  }
  return out.sort((x, y) => x.firstDate.localeCompare(y.firstDate) || x.label.localeCompare(y.label));
}

/** Checklist & label wadah untuk bumbu yang masih perlu dibuat. */
export function prepChecklist(needs: BumbuNeed[], today: string, useWithinDays: number): PrepLabel[] {
  const location: StorageLocation = useWithinDays <= BUMBU_SHELF.kulkas ? 'kulkas' : 'freezer';
  const shelf = BUMBU_SHELF[location];
  const useBy = addDaysStr(today, shelf);
  return needs
    .filter((n) => n.prepGrams > 0)
    .map((n) => {
      const containers = Math.max(1, Math.ceil(n.prepGrams / BUMBU_CONTAINER_G));
      const gramsPerContainer = Math.round(n.prepGrams / containers);
      const where = location === 'kulkas' ? 'Kulkas' : 'Freezer';
      return {
        bumbuId: n.bumbuId,
        label: n.label,
        text: `${n.label}${n.spicy ? ' (PEDAS – dewasa)' : ''} · dibuat ${shortDate(today)} · ${where} · pakai sebelum ${shortDate(useBy)}`,
        containers,
        gramsPerContainer,
        location,
        madeDate: today,
        useBy,
      };
    });
}

/** Catat label yang sudah dibuat sebagai stok bumbu terkonfirmasi. */
export function newBatchFromLabel(l: PrepLabel, grams: number): SpiceBatch {
  return {
    id: `spice-${l.bumbuId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    bumbuId: l.bumbuId,
    grams,
    madeDate: l.madeDate,
    location: l.location,
    useBy: l.useBy,
    confirmed: true,
    label: l.text,
  };
}
