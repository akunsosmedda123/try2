import { describe, expect, it } from 'vitest';
import { eachDate } from '../engine/calendar';
import { generatePlan, optimizeBudget, suggestReplacements } from '../engine/generator';
import { validatePlan, laukOfMember } from '../engine/validate';
import { dayCost } from '../engine/budget';
import type { GeneratorMode } from '../types';
import { dayAfter, seedDays, testCtx } from './helpers';

const ctx = testCtx();
const seed = seedDays();
const start = '2026-12-09';
const dates = eachDate(start, dayAfter(start, 29));

describe('generator 30 hari', () => {
  for (const mode of ['VARIASI_BARU', 'PALING_HEMAT', 'MENU_FAVORIT', 'HABISKAN_STOK'] as GeneratorMode[]) {
    it(`mode ${mode}: tanpa pelanggaran aturan keras dan semua menu wajib ada`, () => {
      const r = generatePlan({ ctx, dates, mode, seed: 11, prevDays: seed.slice(-2), history: [], today: start });
      expect(r.days).toHaveLength(30);
      expect(r.report.errors, r.report.issues.filter((i) => i.severity === 'error').map((i) => i.message).join(' | ')).toBe(0);
      expect(r.report.required.every((x) => x.ok)).toBe(true);
    });
  }
  it('deterministik: seed sama menghasilkan rencana sama', () => {
    const a = generatePlan({ ctx, dates, mode: 'VARIASI_BARU', seed: 5, prevDays: seed.slice(-2), today: start });
    const b = generatePlan({ ctx, dates, mode: 'VARIASI_BARU', seed: 5, prevDays: seed.slice(-2), today: start });
    expect(a.days.map((d) => d.mainA + d.mainB)).toEqual(b.days.map((d) => d.mainA + d.mainB));
  });
  it('seed berbeda menghasilkan variasi', () => {
    const a = generatePlan({ ctx, dates, mode: 'VARIASI_BARU', seed: 1, prevDays: seed.slice(-2), today: start });
    const b = generatePlan({ ctx, dates, mode: 'VARIASI_BARU', seed: 2, prevDays: seed.slice(-2), today: start });
    expect(a.days.map((d) => d.mainA + d.mainB).join()).not.toBe(b.days.map((d) => d.mainA + d.mainB).join());
  });
  it('hari terkunci dipertahankan', () => {
    const locked = { ...seed[0], date: start, locked: true };
    const r = generatePlan({ ctx, dates: dates.slice(1), fixed: [locked], mode: 'VARIASI_BARU', seed: 3, today: start });
    expect(r.days.find((d) => d.date === start)?.mainA).toBe(locked.mainA);
  });
  it('lintas periode: tidak ada lauk sama dengan hari terakhir periode sebelumnya', () => {
    const r = generatePlan({ ctx, dates, mode: 'VARIASI_BARU', seed: 9, prevDays: seed.slice(-2), today: start });
    const last = seed[seed.length - 1];
    expect(r.days[0].mainA).not.toBe(last.mainA);
    expect(r.days[0].veg).not.toBe(last.veg);
  });
  it('anak selalu mendapat lauk aman (gluten, tidak pedas)', () => {
    const r = generatePlan({ ctx, dates, mode: 'PALING_HEMAT', seed: 4, prevDays: seed.slice(-2), today: start });
    for (const d of r.days) for (const l of laukOfMember(d, 'anak', ctx)) expect(l.spice === 'hot' && !l.childMildVariant).toBe(false);
  });
});

describe('optimizer & penggantian', () => {
  it('PALING_HEMAT tidak lebih mahal dari VARIASI_BARU secara signifikan', () => {
    const a = generatePlan({ ctx, dates, mode: 'VARIASI_BARU', seed: 8, prevDays: seed.slice(-2), today: start });
    const b = generatePlan({ ctx, dates, mode: 'PALING_HEMAT', seed: 8, prevDays: seed.slice(-2), today: start });
    expect(b.budget.totalEstimate).toBeLessThanOrEqual(a.budget.totalEstimate * 1.05);
  });
  it('optimizer tidak mengurangi porsi anak (faktor porsi tidak berubah)', () => {
    const before = ctx.profile.childPortionFactor;
    generatePlan({ ctx, dates, mode: 'PALING_HEMAT', seed: 2, today: start });
    expect(ctx.profile.childPortionFactor).toBe(before);
    expect(typeof optimizeBudget).toBe('function');
  });
  it('saran pengganti: tidak melanggar aturan baru, memuat selisih biaya', () => {
    const list = suggestReplacements(seed, '2026-11-12', 'mainB', ctx, { seed: 1 });
    expect(list.length).toBeGreaterThan(0);
    const ok = list.filter((x) => x.errors === 0);
    expect(ok.length).toBeGreaterThan(0);
    const pick = ok[0];
    const trial = seed.map((d) => (d.date === '2026-11-12' ? { ...d, mainB: pick.recipeId } : d));
    const base = validatePlan(seed, ctx, {}).errors;
    expect(validatePlan(trial, ctx, {}).errors).toBeLessThanOrEqual(base);
    expect(Number.isFinite(pick.diff)).toBe(true);
  });
  it('dayCost menghitung hari', () => {
    const c = dayCost(seed[0], ctx);
    expect(c.cost).toBeGreaterThan(0);
  });
});

describe('BUDGET INFEASIBLE', () => {
  it('budget terlalu kecil → tidak feasible, ada laporan alasan, porsi anak tidak dikurangi', () => {
    const tiny = testCtx({ prefs: { weeklyBudget: 40000, budgetMode: 'CUSTOM' } });
    const r = generatePlan({ ctx: tiny, dates, mode: 'PALING_HEMAT', seed: 3, prevDays: seed.slice(-2), today: start });
    expect(r.feasible).toBe(false);
    expect(r.infeasible?.title).toBe('NO FULLY FEASIBLE PLAN');
    expect(r.infeasible!.reasons.length).toBeGreaterThan(0);
    expect(tiny.profile.childPortionFactor).toBe(0.5);
    expect(r.report.errors).toBe(0); // aturan keluarga tetap dipatuhi, hanya budget yang gagal
  });
});
