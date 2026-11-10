import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  CookProgress, EggLog, FavoriteVideo, GroceryList, GrowthEntry, Ingredient, JournalEntry, MealPlan,
  PantryItem, PrepState, Recipe, RecipeQuery, SeafoodEvent, Settings, SpiceBatch,
} from '../types';
import { HomeTableDB, getSettings, putSettings, type TableName } from '../db/db';
import { ensureSeed } from '../db/seedDb';
import { makeCtx, type Ctx } from '../engine/context';
import { today as todayStr } from '../engine/calendar';

export interface AppData {
  settings: Settings;
  ingredients: Ingredient[];
  recipes: Recipe[];
  plans: MealPlan[];
  groceryLists: GroceryList[];
  pantry: PantryItem[];
  spice: SpiceBatch[];
  prep: PrepState[];
  cook: CookProgress[];
  videos: FavoriteVideo[];
  recipeQueries: RecipeQuery[];
  eggLog: EggLog[];
  journal: JournalEntry[];
  growth: GrowthEntry[];
  seafood: SeafoodEvent[];
}
type RowTable = Exclude<keyof AppData, 'settings'>;

export const defaultDb = new HomeTableDB();

interface AppApi {
  db: HomeTableDB;
  data: AppData;
  ctx: Ctx;
  today: string;
  plan: MealPlan | undefined; // rencana aktif
  save: <K extends RowTable>(table: K, row: AppData[K][number]) => Promise<void>;
  saveMany: <K extends RowTable>(table: K, rows: AppData[K]) => Promise<void>;
  remove: (table: RowTable, id: string) => Promise<void>;
  saveSettings: (patch: (s: Settings) => Settings) => Promise<void>;
  reload: () => Promise<void>;
  toast: (msg: string) => void;
  toastMsg: string;
}

const Ctx_ = createContext<AppApi | null>(null);

async function loadAll(db: HomeTableDB): Promise<AppData> {
  const settings = (await getSettings(db)) as Settings;
  const [ingredients, recipes, plans, groceryLists, pantry, spice, prep, cook, videos, recipeQueries, eggLog, journal, growth, seafood] = await Promise.all([
    db.ingredients.toArray(), db.recipes.toArray(), db.plans.toArray(), db.groceryLists.toArray(), db.pantry.toArray(),
    db.spice.toArray(), db.prep.toArray(), db.cook.toArray(), db.videos.toArray(), db.recipeQueries.toArray(),
    db.eggLog.toArray(), db.journal.toArray(), db.growth.toArray(), db.seafood.toArray(),
  ]);
  return { settings, ingredients, recipes, plans, groceryLists, pantry, spice, prep, cook, videos, recipeQueries, eggLog, journal, growth, seafood };
}

export function AppProvider({ children, database = defaultDb }: { children: ReactNode; database?: HomeTableDB }) {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string>('');
  const [toastMsg, setToastMsg] = useState('');
  const timer = useRef<number>();

  const reload = useCallback(async () => {
    try {
      await ensureSeed(database);
      setData(await loadAll(database));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [database]);

  useEffect(() => { void reload(); }, [reload]);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastMsg(''), 3200);
  }, []);

  const save: AppApi['save'] = useCallback(async (table, row) => {
    await database.table(table as TableName).put(row);
    setData((d) => {
      if (!d) return d;
      const list = d[table] as { id: string }[];
      const id = (row as { id: string }).id;
      const next = list.some((x) => x.id === id) ? list.map((x) => (x.id === id ? (row as { id: string }) : x)) : [...list, row as { id: string }];
      return { ...d, [table]: next };
    });
  }, [database]);

  const saveMany: AppApi['saveMany'] = useCallback(async (table, rows) => {
    await database.table(table as TableName).bulkPut(rows as never[]);
    setData((d) => {
      if (!d) return d;
      const list = d[table] as { id: string }[];
      const map = new Map(list.map((x) => [x.id, x]));
      for (const r of rows as unknown as { id: string }[]) map.set(r.id, r);
      return { ...d, [table]: [...map.values()] };
    });
  }, [database]);

  const remove: AppApi['remove'] = useCallback(async (table, id) => {
    await database.table(table as TableName).delete(id);
    setData((d) => (d ? { ...d, [table]: (d[table] as { id: string }[]).filter((x) => x.id !== id) } : d));
  }, [database]);

  const saveSettings: AppApi['saveSettings'] = useCallback(async (patch) => {
    const cur = (await getSettings(database)) as Settings;
    const next = patch(structuredClone(cur));
    await putSettings(database, next);
    setData((d) => (d ? { ...d, settings: next } : d));
  }, [database]);

  const api = useMemo<AppApi | null>(() => {
    if (!data) return null;
    const ctx = makeCtx(data.ingredients, data.recipes, data.settings.profile, data.settings.prefs);
    const plan = [...data.plans].filter((p) => p.status === 'aktif').sort((a, b) => b.start.localeCompare(a.start))[0];
    return { db: database, data, ctx, today: todayStr(), plan, save, saveMany, remove, saveSettings, reload, toast, toastMsg };
  }, [data, database, save, saveMany, remove, saveSettings, reload, toast, toastMsg]);

  if (error) {
    return (
      <div className="p-6 text-charcoal">
        <h1 className="text-lg font-bold">Penyimpanan lokal tidak dapat dibuka</h1>
        <p className="mt-2 text-sm">{error}</p>
        <p className="mt-2 text-sm">HOME TABLE memakai IndexedDB di browser. Pastikan mode privat/penyimpanan tidak diblokir.</p>
      </div>
    );
  }
  if (!api) return <div className="p-6 text-sm text-charcoal/70">Memuat HOME TABLE…</div>;
  return <Ctx_.Provider value={api}>{children}</Ctx_.Provider>;
}

export function useApp(): AppApi {
  const v = useContext(Ctx_);
  if (!v) throw new Error('useApp harus dipakai di dalam AppProvider');
  return v;
}
