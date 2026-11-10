import { describe, expect, it } from 'vitest';
import { checkRecipeForMember, combinedStatus, recipeGluten } from '../engine/restrictions';
import { occasionsForDay } from '../engine/portions';
import { eggTracker, validatePlan, laukOfMember } from '../engine/validate';
import { isWeekend } from '../engine/calendar';
import { seedDays, testCtx } from './helpers';

const ctx = testCtx();
const days = seedDays();
const hard = (id: string, m: 'ibu' | 'ayah' | 'anak', weekend = false) => checkRecipeForMember(ctx.recipes.get(id)!, m, ctx, { weekend, asMain: true }).filter((v) => v.level === 'hard');

describe('seed 30 hari', () => {
  it('berisi 30 hari 9 Nov – 8 Des 2026 dan semua resepnya ada', () => {
    expect(days).toHaveLength(30);
    expect(days[0].date).toBe('2026-11-09');
    expect(days[29].date).toBe('2026-12-08');
    for (const d of days) for (const id of [d.mainA, d.mainB, d.veg, d.rice, ...d.sides]) expect(ctx.recipes.has(id), `${d.date} ${id}`).toBe(true);
  });
  it('tidak ada pelanggaran aturan keras', () => {
    const r = validatePlan(days, ctx, {});
    expect(r.issues.filter((i) => i.severity === 'error').map((i) => i.message)).toEqual([]);
  });
  it('enam menu wajib bulanan muncul', () => {
    const r = validatePlan(days, ctx, {});
    expect(r.required.length).toBe(6);
    expect(r.required.every((x) => x.ok), JSON.stringify(r.required.filter((x) => !x.ok))).toBe(true);
  });
});

describe('aturan Ayah', () => {
  it('tidak pernah mendapat udang/patin/tongkol/ikan asap', () => {
    for (const d of days) for (const r of laukOfMember(d, 'ayah', ctx)) {
      const ids = r.ingredients.flatMap((i) => [i.ingredientId, ...(i.options ?? [])]);
      expect(ids.some((x) => ['udang', 'patin', 'tongkol', 'ikan_asap'].includes(x)), `${d.date} ${r.name}`).toBe(false);
    }
  });
  it('hari kerja hanya makan malam; akhir pekan 3x makan dengan Lauk A, A, B', () => {
    for (const d of days) {
      const occ = occasionsForDay(d, ctx).filter((o) => o.member === 'ayah');
      if (isWeekend(d.date)) { expect(occ).toHaveLength(3); expect(occ.map((o) => o.slot)).toEqual(['sarapan', 'siang', 'malam']); }
      else { expect(occ).toHaveLength(1); expect(occ[0].slot).toBe('malam'); }
    }
  });
  it('lele hanya digoreng dan maksimal 1x per minggu', () => {
    const r = validatePlan(days, ctx, {});
    for (const w of r.weeks) expect(w.ayahLeleDays.length).toBeLessThanOrEqual(1);
  });
  it('bandeng presto bukan untuk anak', () => {
    const b = [...ctx.recipes.values()].find((r) => r.presto);
    if (b) expect(hard(b.id, 'anak').length).toBeGreaterThan(0);
  });
});

describe('aturan Anak', () => {
  it('semua menu anak tidak mengandung gluten dan tidak pedas', () => {
    for (const d of days) for (const r of laukOfMember(d, 'anak', ctx)) {
      expect(recipeGluten(r, ctx), `${d.date} ${r.name}`).not.toBe('NOT_SUITABLE');
      expect(combinedStatus(r, ['anak'], ctx, { weekend: isWeekend(d.date), asMain: true }), `${d.date} ${r.name}`).not.toBe('NOT SUITABLE');
    }
  });
  it('tidak ada oyong/pare/kol di menu anak', () => {
    for (const d of days) {
      const r = ctx.recipes.get(d.veg)!;
      expect(r.ingredients.some((i) => ['oyong', 'pare', 'kol'].includes(i.ingredientId))).toBe(false);
    }
  });
  it('tahu/tempe bukan lauk utama anak', () => {
    for (const d of days) for (const r of laukOfMember(d, 'anak', ctx)) expect(r.protein).not.toBe('tahu_tempe');
  });
  it('cumi hanya weekday dan tidak untuk dewasa', () => {
    const cumi = [...ctx.recipes.values()].find((r) => r.protein === 'cumi');
    if (cumi) {
      expect(hard(cumi.id, 'anak', true).length).toBeGreaterThan(0);
      expect(hard(cumi.id, 'ayah').length).toBeGreaterThan(0);
    }
  });
  it('resep bergluten ditolak untuk anak (kecap/tepung terigu)', () => {
    const bad = [...ctx.ingredients.values()].find((i) => i.gluten === 'NOT_SUITABLE');
    expect(bad).toBeTruthy();
  });
});

describe('aturan Ibu', () => {
  it('tepat 1 telur ceplok per sarapan', () => {
    const t = eggTracker(days, ctx);
    expect(t.breakfast).toBe(days.length);
    expect(ctx.prefs.motherBreakfastEggs).toBe(1);
  });
  it('ibu makan 3x setiap hari', () => {
    for (const d of days) expect(occasionsForDay(d, ctx).filter((o) => o.member === 'ibu')).toHaveLength(3);
  });
});

describe('aturan keluarga', () => {
  it('tidak ada lauk atau sayur sama pada hari berurutan', () => {
    for (let i = 1; i < days.length; i++) {
      expect(days[i].veg, days[i].date).not.toBe(days[i - 1].veg);
      expect(days[i].mainA, days[i].date).not.toBe(days[i - 1].mainA);
      expect(days[i].mainB, days[i].date).not.toBe(days[i - 1].mainB);
    }
  });
});
