import { beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { HomeTableDB, getSettings, SCHEMA_VERSION } from '../db/db';
import { ensureSeed, resetDemoData, clearUserData } from '../db/seedDb';
import { exportAll, importAll, validateBackup } from '../db/backup';
import { buildGroceryList, mergeWithPrevious } from '../engine/grocery';
import { budgetReport } from '../engine/budget';
import { bumbuNeeds } from '../engine/bumbu';
import { eachDate } from '../engine/calendar';
import { generatePlan } from '../engine/generator';
import { makeCtx } from '../engine/context';
import { validatePlan } from '../engine/validate';
import type { MealPlan, Settings } from '../types';
import { dayAfter } from './helpers';

let n = 0;
let db: HomeTableDB;
beforeEach(async () => { db = new HomeTableDB(`t-${++n}-${Math.random()}`); await db.open(); });

describe('IndexedDB', () => {
  it('seed pertama kali: 30 hari, 1 rencana aktif, stok contoh tidak aktif', async () => {
    const r = await ensureSeed(db);
    expect(r.firstRun).toBe(true);
    const plans = await db.plans.toArray();
    expect(plans).toHaveLength(1);
    expect(plans[0].days).toHaveLength(30);
    expect(plans[0].status).toBe('aktif');
    expect(await db.pantry.count()).toBe(0);
  });
  it('seed kedua tidak menimpa data pengguna', async () => {
    await ensureSeed(db);
    await db.journal.put({ id: 'j1', date: '2026-11-10', slot: 'siang', menu: 'x', served: 'habis', eaten: 'habis', protein: '', veg: '', rice: '', extraFat: '', tasteNote: '', textureNote: '' });
    const s = (await getSettings(db)) as Settings;
    s.cash.amount = 77000;
    await db.kv.put({ key: 'settings', value: s });
    const r = await ensureSeed(db);
    expect(r.firstRun).toBe(false);
    expect(await db.journal.count()).toBe(1);
    expect(((await getSettings(db)) as Settings).cash.amount).toBe(77000);
  });
  it('data bertahan setelah database dibuka ulang (reload)', async () => {
    await ensureSeed(db);
    await db.growth.put({ id: 'g1', date: '2026-11-10', weightKg: 14.2, heightCm: 98, doctorNote: '' });
    const name = db.name;
    db.close();
    const again = new HomeTableDB(name);
    await again.open();
    expect((await again.growth.get('g1'))?.weightKg).toBe(14.2);
    again.close();
  });
  it('clearUserData menghapus data pribadi dan resetDemoData memulihkan seed', async () => {
    await ensureSeed(db);
    await db.growth.put({ id: 'g1', date: '2026-11-10', weightKg: 1, heightCm: 1, doctorNote: '' });
    await clearUserData(db);
    expect(await db.growth.count()).toBe(0);
    expect(await db.plans.count()).toBe(0);
    await resetDemoData(db);
    expect(await db.plans.count()).toBe(1);
  });
});

describe('backup & restore', () => {
  it('export → validasi → import mengembalikan data persis', async () => {
    await ensureSeed(db);
    await db.journal.put({ id: 'j1', date: '2026-11-10', slot: 'siang', menu: 'ayam', served: 'habis', eaten: '1/2', protein: '', veg: '', rice: '', extraFat: '', tasteNote: '', textureNote: '' });
    const b = await exportAll(db);
    expect(b.schemaVersion).toBe(SCHEMA_VERSION);
    const chk = validateBackup(JSON.parse(JSON.stringify(b)));
    expect(chk.ok, chk.errors.join(';')).toBe(true);
    await clearUserData(db);
    await importAll(db, chk.backup!);
    expect((await db.journal.get('j1'))?.eaten).toBe('1/2');
    expect((await db.plans.toArray())[0].days).toHaveLength(30);
  });
  it('backup rusak / bukan home-table / versi lebih baru ditolak TANPA mengubah data', async () => {
    await ensureSeed(db);
    expect(validateBackup({ foo: 1 }).ok).toBe(false);
    expect(validateBackup('x').ok).toBe(false);
    const b = await exportAll(db);
    expect(validateBackup({ ...b, schemaVersion: 99 }).ok).toBe(false);
    const bad = JSON.parse(JSON.stringify(b));
    bad.tables.plans[0].days = 'bukan array';
    expect(validateBackup(bad).ok).toBe(false);
    expect(await db.plans.count()).toBe(1);
  });
});

describe('integrasi: generate → optimizer → preview → belanja → budget → bumbu → simpan → muat ulang → bulan depan', () => {
  it('alur lengkap', async () => {
    await ensureSeed(db);
    const settings = (await getSettings(db)) as Settings;
    const ingredients = await db.ingredients.toArray();
    const recipes = await db.recipes.toArray();
    const ctx = makeCtx(ingredients, recipes, settings.profile, settings.prefs);
    const [cur] = await db.plans.toArray();

    // generate bulan depan
    const start = dayAfter(cur.end, 1);
    const dates = eachDate(start, dayAfter(start, 29));
    const gen = generatePlan({ ctx, dates, mode: 'VARIASI_BARU', seed: 21, prevDays: cur.days.slice(-2), history: [], today: start });
    expect(gen.days).toHaveLength(30);
    expect(gen.report.errors).toBe(0);
    expect(gen.optimizerSteps).toBeInstanceOf(Array);

    // belanja, budget, bumbu
    const wk = gen.days.slice(0, 7);
    const list = buildGroceryList('x', wk, ctx, [], start);
    expect(list.items.length).toBeGreaterThan(0);
    expect(budgetReport(gen.days, ctx, [], start).weeks.length).toBeGreaterThan(0);
    expect(bumbuNeeds(wk, ctx, [], start).length).toBeGreaterThan(0);

    // simpan (arsipkan lama), muat ulang
    const next: MealPlan = { id: 'plan-next', name: 'Bulan depan', start, end: dates[29], status: 'aktif', createdAt: new Date().toISOString(), source: 'generator', generatorMode: 'VARIASI_BARU', days: gen.days };
    await db.plans.put({ ...cur, status: 'arsip' });
    await db.plans.put(next);
    await db.groceryLists.put(mergeWithPrevious(list));
    const name = db.name;
    db.close();
    const re = new HomeTableDB(name);
    await re.open();
    const plans = await re.plans.toArray();
    expect(plans.filter((p) => p.status === 'aktif')).toHaveLength(1);
    expect(plans.find((p) => p.status === 'arsip')?.days).toHaveLength(30);
    const loaded = plans.find((p) => p.id === 'plan-next')!;
    expect(validatePlan(loaded.days, ctx, { history: [] }).errors).toBe(0);
    expect(await re.groceryLists.count()).toBe(1);
    re.close();
  });
});
