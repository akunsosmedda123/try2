import type { DayPlan, GroceryItem, PantryItem } from '../types';
import type { Ctx } from './context';
import { groupByWeek, shortDate } from './calendar';
import { buildGroceryItems, unitPrice } from './grocery';
import { stockByIngredient } from './pantry';
import { requirementsForDays } from './requirements';

export interface WeekBudget {
  start: string;
  dates: string[];
  days: number;
  partial: boolean;
  target: number; // budget minggu itu (pro-rata untuk minggu parsial)
  budgetEstimate: number; // belanja bahan "masuk budget" (dibulatkan per kemasan)
  beefCost: number;
  beefReserveShare: number;
  effective: number; // dipakai untuk membandingkan dengan target
  excludedPantryCost: number; // bumbu/beras/minyak, dll. (di luar budget)
  consumedValue: number; // nilai bahan yang DIKONSUMSI (linear, termasuk dari stok)
  inventoryUsedValue: number; // bagian consumedValue yang berasal dari stok
  unknownPriceItems: string[];
  over: boolean;
  diff: number; // effective - target
  expensive: { name: string; cost: number }[];
  items: GroceryItem[];
}

export interface BudgetReport {
  weeks: WeekBudget[];
  weeklyBudget: number;
  totalEstimate: number;
  totalTarget: number;
  average: number; // rata-rata efektif per minggu (7 hari)
  beefReserveTotal: number;
  priceIncomplete: boolean;
  over: boolean;
  status: 'OK' | 'BUDGET OVER LIMIT' | 'PRICE INCOMPLETE';
  strategy: 'FIXED_WEEKLY' | 'MONTHLY_AVERAGE';
}

export function budgetReport(days: DayPlan[], ctx: Ctx, pantry: PantryItem[], onDate: string): BudgetReport {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const stock = stockByIngredient(pantry, ctx, onDate);
  const weeklyBudget = ctx.prefs.weeklyBudget;
  const groups = groupByWeek(sorted.map((d) => d.date));
  const totalDays = Math.max(1, sorted.length);

  const raw = groups.map((g) => {
    const wd = sorted.filter((d) => g.dates.includes(d.date));
    const reqs = requirementsForDays(wd, ctx, { stock });
    let consumedValue = 0;
    let inventoryUsedValue = 0;
    for (const l of reqs.values()) {
      const ing = ctx.ingredients.get(l.ingredientId);
      const up = ing ? unitPrice(ing) : null;
      if (!ing || up === null || !ing.inBudget) continue;
      consumedValue += l.gross * up;
      inventoryUsedValue += Math.min(stock.get(ing.id) ?? 0, l.gross) * up;
    }
    const { items } = buildGroceryItems(wd, ctx, stock, `w${g.start}`);
    return { g, wd, items, consumedValue, inventoryUsedValue };
  });

  let beefTotal = 0;
  const weeks: WeekBudget[] = raw.map(({ g, items, consumedValue, inventoryUsedValue }) => {
    let budgetEstimate = 0;
    let excluded = 0;
    let beef = 0;
    const unknown: string[] = [];
    const expensive: { name: string; cost: number }[] = [];
    for (const it of items) {
      if (it.buyQty <= 0) continue;
      if (it.subtotal === null) { unknown.push(it.name); continue; }
      if (it.inBudget) {
        budgetEstimate += it.subtotal;
        expensive.push({ name: it.name, cost: it.subtotal });
        if (ctx.ingredients.get(it.ingredientId ?? '')?.protein === 'sapi') beef += it.subtotal;
      } else {
        // di luar budget: tampilkan nilai pemakaian (linear), bukan seluruh kemasan
        const ing = ctx.ingredients.get(it.ingredientId ?? '');
        const up = ing ? unitPrice(ing) : null;
        excluded += up === null ? it.subtotal : Math.max(0, it.need - it.stock) * up;
      }
    }
    beefTotal += beef;
    expensive.sort((a, b) => b.cost - a.cost);
    return {
      start: g.start, dates: g.dates, days: g.dates.length, partial: g.partial,
      target: Math.round((weeklyBudget * g.dates.length) / 7),
      budgetEstimate, beefCost: beef, beefReserveShare: 0, effective: budgetEstimate,
      excludedPantryCost: Math.round(excluded), consumedValue: Math.round(consumedValue), inventoryUsedValue: Math.round(inventoryUsedValue),
      unknownPriceItems: unknown, over: false, diff: 0, expensive: expensive.slice(0, 4), items,
    };
  });

  for (const w of weeks) {
    w.beefReserveShare = ctx.prefs.beefReserveOn ? Math.round((beefTotal * w.days) / totalDays) : w.beefCost;
    w.effective = ctx.prefs.beefReserveOn ? w.budgetEstimate - w.beefCost + w.beefReserveShare : w.budgetEstimate;
    w.diff = Math.round(w.effective - w.target);
    w.over = w.diff > 0;
  }
  const totalEstimate = weeks.reduce((s, w) => s + w.effective, 0);
  const totalTarget = weeks.reduce((s, w) => s + w.target, 0);
  const average = Math.round((totalEstimate * 7) / totalDays);
  const priceIncomplete = weeks.some((w) => w.unknownPriceItems.length > 0);
  const over = ctx.prefs.budgetStrategy === 'FIXED_WEEKLY' ? weeks.some((w) => w.over) : average > weeklyBudget;
  return {
    weeks, weeklyBudget, totalEstimate: Math.round(totalEstimate), totalTarget, average,
    beefReserveTotal: Math.round(beefTotal), priceIncomplete, over,
    status: over ? 'BUDGET OVER LIMIT' : priceIncomplete ? 'PRICE INCOMPLETE' : 'OK',
    strategy: ctx.prefs.budgetStrategy,
  };
}

export interface Infeasible {
  title: 'NO FULLY FEASIBLE PLAN';
  reasons: string[];
  totalBudget: number;
  estimate: number;
  diff: number;
  missingIngredients: string[];
  expensive: { name: string; cost: number }[];
  alternatives: string[];
  adjustments: string[];
}

export function describeInfeasible(report: BudgetReport, extraReasons: string[] = []): Infeasible {
  const worst = [...report.weeks].sort((a, b) => b.diff - a.diff)[0];
  const reasons = [...extraReasons];
  for (const w of report.weeks.filter((x) => x.over)) {
    reasons.push(`Minggu ${shortDate(w.start)}: estimasi Rp${w.effective.toLocaleString('id-ID')} melebihi budget Rp${w.target.toLocaleString('id-ID')} (selisih Rp${w.diff.toLocaleString('id-ID')}).`);
  }
  const missing = [...new Set(report.weeks.flatMap((w) => w.unknownPriceItems))];
  if (missing.length) reasons.push(`Harga belum diisi untuk: ${missing.join(', ')}. Biaya sebenarnya tidak bisa dipastikan.`);
  const expensive = [...(worst?.expensive ?? [])];
  return {
    title: 'NO FULLY FEASIBLE PLAN',
    reasons,
    totalBudget: report.totalTarget,
    estimate: report.totalEstimate,
    diff: report.totalEstimate - report.totalTarget,
    missingIngredients: missing,
    expensive,
    alternatives: [
      'Habiskan stok aman yang ada (aktifkan stok di Pantry setelah dikonfirmasi).',
      'Geser menu premium (sapi/udang) ke minggu yang lebih longgar atau gunakan mode anggaran rata-rata bulanan.',
      'Ganti ikan/ayam ke pilihan yang lebih murah sesuai pantangan keluarga.',
      'Perbarui harga bahan sesuai harga pasar terbaru di Pengaturan > Harga bahan.',
    ],
    adjustments: [
      'Naikkan budget (mis. mode NORMAL Rp350.000 atau FLEKSIBEL Rp400.000) atas persetujuan Anda.',
      'Gunakan "Anggaran rata-rata bulanan" agar minggu rawon dan minggu hemat saling menyeimbangkan.',
      'Kurangi frekuensi menu wajib yang mahal (atas keputusan Anda). Porsi anak TIDAK dikurangi otomatis.',
    ],
  };
}

export function cashPlan(cash: number, items: GroceryItem[]) {
  let planned = 0;
  for (const it of items) {
    if (it.status === 'purchased' || it.buyQty <= 0) continue;
    if (it.subtotal !== null) planned += it.subtotal;
  }
  return { cash, planned, remaining: cash - planned };
}

/** Estimasi biaya bahan "masuk budget" untuk satu hari (linear, tanpa stok & tanpa pembulatan kemasan). */
export function dayCost(day: DayPlan, ctx: Ctx): { cost: number; unknown: boolean } {
  const reqs = requirementsForDays([day], ctx, {});
  let cost = 0;
  let unknown = false;
  for (const l of reqs.values()) {
    const ing = ctx.ingredients.get(l.ingredientId);
    if (!ing || !ing.inBudget) continue;
    const up = unitPrice(ing);
    if (up === null) { unknown = true; continue; }
    cost += l.gross * up;
  }
  return { cost: Math.round(cost), unknown };
}
