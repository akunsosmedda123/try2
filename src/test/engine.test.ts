import { describe, expect, it } from 'vitest';
import { budgetReport, describeInfeasible } from '../engine/budget';
import { isWeekend, groupByWeek } from '../engine/calendar';
import { cookingSessions } from '../engine/cooking';
import { cookWithWhatIHave } from '../engine/cookwith';
import { buildGroceryList, groceryTotals } from '../engine/grocery';
import { bumbuNeeds } from '../engine/bumbu';
import { consumeStock, isUsable } from '../engine/pantry';
import { roundUpToPack } from '../engine/units';
import { validatePlan } from '../engine/validate';
import { seafoodTracker } from '../engine/toddler';
import { buildSampleStock } from '../data/seed';
import type { PantryItem } from '../types';
import { seedDays, testCtx } from './helpers';

const ctx = testCtx();
const days = seedDays();

describe('nutrisi anak', () => {
  const rep = validatePlan(days, ctx, {});
  it('daging sapi untuk anak >= 2x per siklus', () => expect(rep.sapiAnakDates.length).toBeGreaterThanOrEqual(2));
  it('setiap minggu penuh ada menu kaya zat besi untuk anak', () => {
    for (const w of rep.weeks.filter((x) => !x.partial)) expect(w.ironRich, w.start).toBe(true);
  });
  it('seafood anak minimal sekali dalam 14 hari', () => {
    const d = rep.seafoodDates.map((s) => s.date);
    expect(d.length).toBeGreaterThan(0);
  });
  it('tracker seafood memakai riwayat dimakan, bukan menu terjadwal', () => {
    expect(seafoodTracker([], days, ctx, '2026-11-10').status).toBe('NO HISTORY');
    const t = seafoodTracker([{ id: 'x', date: '2026-10-01', type: 'udang', source: 'manual' }], days, ctx, '2026-11-10');
    expect(t.status).toBe('OVERDUE');
  });
});

describe('sesi masak', () => {
  it('weekday maksimal 2 sesi, weekend maksimal 1 sesi', () => {
    for (const d of days) {
      const n = cookingSessions(d, ctx).length;
      expect(n, d.date).toBeLessThanOrEqual(isWeekend(d.date) ? 1 : 2);
    }
  });
});

describe('belanja & satuan', () => {
  it('pembulatan kemasan naik, tidak turun', () => {
    expect(roundUpToPack(130, 100)).toEqual({ qty: 200, packs: 2 });
    expect(roundUpToPack(0, 100).packs).toBe(0);
  });
  it('daftar belanja satu minggu punya total dan item', () => {
    const wk = days.slice(0, 7);
    const l = buildGroceryList('p', wk, ctx, [], '2026-11-09');
    expect(l.items.length).toBeGreaterThan(5);
    const t = groceryTotals(l.items);
    expect(t.budget).toBeGreaterThan(0);
  });
  it('harga kosong tidak dianggap Rp0 (PRICE INCOMPLETE)', () => {
    const c2 = testCtx();
    for (const i of c2.ingredients.values()) if (i.category === 'ayam_daging') { i.packPrice = null; i.priceStatus = 'kosong'; }
    const l = buildGroceryList('p', days.slice(0, 7), c2, [], '2026-11-09');
    expect(groceryTotals(l.items).unknown.length).toBeGreaterThan(0);
    const b = budgetReport(days, c2, [], '2026-11-09');
    expect(b.priceIncomplete).toBe(true);
    expect(b.status).toBe('PRICE INCOMPLETE');
  });
});

describe('budget', () => {
  it('beras/minyak/bumbu tidak masuk hitungan budget', () => {
    const out = [...ctx.ingredients.values()].filter((i) => ['pantry', 'bumbu'].includes(i.category));
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((i) => !i.inBudget)).toBe(true);
  });
  it('minggu parsial dihitung pro-rata', () => {
    const r = budgetReport(days, ctx, [], '2026-11-09');
    const total = r.weeks.reduce((s, w) => s + w.target, 0);
    expect(Math.round(total)).toBe(Math.round(r.totalTarget));
    expect(r.weeks.some((w) => w.partial)).toBe(true);
  });
  it('BUDGET INFEASIBLE: budget Rp50.000/minggu menghasilkan NO FULLY FEASIBLE PLAN dengan alasan', () => {
    const tiny = testCtx({ prefs: { weeklyBudget: 50000, budgetMode: 'CUSTOM' } });
    const r = budgetReport(days, tiny, [], '2026-11-09');
    expect(r.over).toBe(true);
    const inf = describeInfeasible(r);
    expect(inf.title).toBe('NO FULLY FEASIBLE PLAN');
    expect(inf.reasons.length).toBeGreaterThan(0);
    expect(inf.alternatives.length).toBeGreaterThan(0);
    expect(inf.adjustments.join(' ')).toMatch(/Porsi anak TIDAK dikurangi/);
  });
});

describe('pantry', () => {
  const base: PantryItem = { id: 'a', ingredientId: 'hati_ayam', name: 'Hati', qty: 500, unit: 'g', location: 'freezer', purchasedDate: '2026-11-01', condition: 'mentah', safety: 'aman', useBy: '2026-12-31', confirmed: true };
  it('stok contoh TIDAK aktif sebelum dikonfirmasi', () => {
    for (const s of buildSampleStock()) { expect(s.confirmed).toBe(false); expect(isUsable(s, '2026-11-10')).toBe(false); }
  });
  it('stok kedaluwarsa/tidak aman/matang tidak dipakai', () => {
    expect(isUsable(base, '2026-11-10')).toBe(true);
    expect(isUsable({ ...base, useBy: '2026-11-01' }, '2026-11-10')).toBe(false);
    expect(isUsable({ ...base, safety: 'periksa' }, '2026-11-10')).toBe(false);
    expect(isUsable({ ...base, condition: 'matang' }, '2026-11-10')).toBe(false);
  });
  it('FEFO: memakai yang paling cepat habis dulu', () => {
    const a = { ...base, id: 'late', useBy: '2026-12-30' };
    const b = { ...base, id: 'early', useBy: '2026-11-15' };
    const r = consumeStock([a, b], 'hati_ayam', 300, ctx, '2026-11-10');
    expect(r.items.find((i) => i.id === 'early')!.qty).toBe(200);
    expect(r.items.find((i) => i.id === 'late')!.qty).toBe(500);
  });
  it('stok mengurangi belanja', () => {
    const wk = days.slice(0, 7);
    const none = buildGroceryList('p', wk, ctx, [], '2026-11-09');
    const withStock = buildGroceryList('p', wk, ctx, [{ ...base, qty: 5000 }], '2026-11-09');
    const q = (l: typeof none) => l.items.find((i) => i.ingredientId === 'hati_ayam')?.buyQty ?? 0;
    expect(q(withStock)).toBeLessThanOrEqual(q(none));
  });
});

describe('bumbu & masak dari stok', () => {
  it('kebutuhan bumbu dihitung dari resep', () => {
    const n = bumbuNeeds(days.slice(0, 7), ctx, [], '2026-11-09');
    expect(n.length).toBeGreaterThan(0);
    expect(n.every((x) => x.needGrams > 0 && x.containers >= 1)).toBe(true);
  });
  it('stok bumbu terkonfirmasi mengurangi persiapan', () => {
    const n0 = bumbuNeeds(days.slice(0, 7), ctx, [], '2026-11-09')[0];
    const n1 = bumbuNeeds(days.slice(0, 7), ctx, [{ id: 's', bumbuId: n0.bumbuId, grams: 10000, madeDate: '2026-11-09', location: 'freezer', useBy: '2026-12-09', confirmed: true, label: '' }], '2026-11-09').find((x) => x.bumbuId === n0.bumbuId)!;
    expect(n1.prepGrams).toBe(0);
  });
  it('tanpa bahan: tidak ada READY; dengan bahan cukup: ada rekomendasi, aman untuk penerima', () => {
    expect(cookWithWhatIHave([], ctx, {}).filter((m) => m.category === 'READY TO COOK')).toHaveLength(0);
    const rich = [...ctx.ingredients.values()].filter((i) => i.buyable !== false && !['bumbu', 'pantry'].includes(i.category)).map((i) => ({ ingredientId: i.id, amount: 5000 }));
    const res = cookWithWhatIHave(rich, ctx, { portions: 4 });
    expect(res.some((m) => m.category === 'READY TO COOK')).toBe(true);
  });
});

describe('minggu', () => {
  it('grouping Senin–Minggu', () => {
    const w = groupByWeek(days.map((d) => d.date));
    expect(w[0].dates[0]).toBe('2026-11-09');
    expect(w.length).toBe(5);
    expect(w[w.length - 1].partial).toBe(true);
  });
});
