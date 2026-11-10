import Dexie, { type Table } from 'dexie';
import type {
  CookProgress, EggLog, FavoriteVideo, GroceryList, GrowthEntry, Ingredient, JournalEntry, MealPlan,
  PantryItem, PrepState, Recipe, RecipeQuery, SeafoodEvent, Settings, SpiceBatch,
} from '../types';

/** Versi skema backup/DB. Naikkan bila struktur berubah dan tambahkan migrasi di backup.ts. */
export const SCHEMA_VERSION = 1;

export interface KV { key: string; value: unknown }

export const TABLE_NAMES = [
  'kv', 'ingredients', 'recipes', 'plans', 'groceryLists', 'pantry', 'spice', 'prep', 'cook',
  'videos', 'recipeQueries', 'eggLog', 'journal', 'growth', 'seafood',
] as const;
export type TableName = (typeof TABLE_NAMES)[number];

export class HomeTableDB extends Dexie {
  kv!: Table<KV, string>;
  ingredients!: Table<Ingredient, string>;
  recipes!: Table<Recipe, string>;
  plans!: Table<MealPlan, string>;
  groceryLists!: Table<GroceryList, string>;
  pantry!: Table<PantryItem, string>;
  spice!: Table<SpiceBatch, string>;
  prep!: Table<PrepState, string>;
  cook!: Table<CookProgress, string>;
  videos!: Table<FavoriteVideo, string>;
  recipeQueries!: Table<RecipeQuery, string>;
  eggLog!: Table<EggLog, string>;
  journal!: Table<JournalEntry, string>;
  growth!: Table<GrowthEntry, string>;
  seafood!: Table<SeafoodEvent, string>;

  constructor(name = 'home-table') {
    super(name);
    // Versi 1. Perubahan skema berikutnya = this.version(2).stores({...}).upgrade(...) — hanya menambah/mengubah,
    // tidak pernah menghapus database pengguna.
    this.version(1).stores({
      kv: 'key',
      ingredients: 'id',
      recipes: 'id, category',
      plans: 'id, start, status',
      groceryLists: 'id, planId',
      pantry: 'id, ingredientId, location',
      spice: 'id, bumbuId',
      prep: 'id',
      cook: 'id',
      videos: 'id, recipeId',
      recipeQueries: 'id',
      eggLog: 'id',
      journal: 'id, date',
      growth: 'id, date',
      seafood: 'id, date',
    });
  }
}

export const SETTINGS_KEY = 'settings';

export async function getSettings(db: HomeTableDB): Promise<Settings | undefined> {
  return (await db.kv.get(SETTINGS_KEY))?.value as Settings | undefined;
}
export async function putSettings(db: HomeTableDB, s: Settings): Promise<void> {
  await db.kv.put({ key: SETTINGS_KEY, value: s });
}
