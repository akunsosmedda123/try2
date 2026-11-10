import { BASE_INGREDIENTS } from '../data/ingredients';
import { LAUK_RECIPES } from '../data/recipes';
import { BUMBU_RECIPES, NASI_RECIPES, SAYUR_RECIPES } from '../data/recipes2';
import { DEFAULT_SETTINGS, SEED_VERSION, buildSeedPlan } from '../data/seed';
import type { Recipe, Settings } from '../types';
import { type HomeTableDB, getSettings, putSettings } from './db';

export const BUILTIN_RECIPES: Recipe[] = [...LAUK_RECIPES, ...SAYUR_RECIPES, ...NASI_RECIPES, ...BUMBU_RECIPES];

/**
 * Pertama kali: isi katalog, pengaturan default, dan menu seed.
 * Pembaruan aplikasi: hanya MENAMBAH bahan/resep baru yang belum ada. Data pengguna tidak pernah ditimpa/dihapus.
 */
export async function ensureSeed(db: HomeTableDB): Promise<{ firstRun: boolean }> {
  const existing = await getSettings(db);
  if (!existing) {
    await db.transaction('rw', db.tables, async () => {
      await db.ingredients.bulkPut(BASE_INGREDIENTS);
      await db.recipes.bulkPut(BUILTIN_RECIPES);
      await db.plans.put(buildSeedPlan());
      await putSettings(db, structuredClone(DEFAULT_SETTINGS));
    });
    return { firstRun: true };
  }
  if ((existing.seedVersion ?? 0) < SEED_VERSION) {
    await db.transaction('rw', db.tables, async () => {
      const haveI = new Set((await db.ingredients.toCollection().primaryKeys()) as string[]);
      const haveR = new Set((await db.recipes.toCollection().primaryKeys()) as string[]);
      await db.ingredients.bulkAdd(BASE_INGREDIENTS.filter((i) => !haveI.has(i.id)));
      await db.recipes.bulkAdd(BUILTIN_RECIPES.filter((r) => !haveR.has(r.id)));
      await putSettings(db, { ...existing, seedVersion: SEED_VERSION } as Settings);
    });
  }
  return { firstRun: false };
}

/** Kosongkan semua data lalu isi ulang katalog + menu demo seed. */
export async function resetDemoData(db: HomeTableDB): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.ingredients.bulkPut(BASE_INGREDIENTS);
    await db.recipes.bulkPut(BUILTIN_RECIPES);
    await db.plans.put(buildSeedPlan());
    await putSettings(db, structuredClone(DEFAULT_SETTINGS));
  });
}

/** Hapus SEMUA data pengguna (jurnal, pertumbuhan, stok, menu, riwayat). Katalog bawaan dipulihkan; tanpa menu seed. */
export async function clearUserData(db: HomeTableDB): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.ingredients.bulkPut(BASE_INGREDIENTS);
    await db.recipes.bulkPut(BUILTIN_RECIPES);
    await putSettings(db, structuredClone(DEFAULT_SETTINGS));
  });
}
