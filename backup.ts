import { z } from 'zod';
import type { BackupFile } from '../types';
import { SCHEMA_VERSION, TABLE_NAMES, type HomeTableDB, type TableName } from './db';

const str = z.string();
const num = z.number();
const portion = z.enum(['habis', '3/4', '1/2', '1/4', 'tidak']);

const dayPlan = z.object({
  date: str, mainA: str, mainB: str, veg: str, rice: str,
  motherLunch: z.object({ mode: z.enum(['follow', 'alt']), recipeId: str.optional() }),
  sides: z.array(str), locked: z.boolean(),
}).passthrough();

// Skema minimal per tabel: kunci wajib & tipe inti. Sisanya dibiarkan (passthrough) agar kompatibel ke depan.
const ROW_SCHEMAS: Record<TableName, z.ZodTypeAny> = {
  kv: z.object({ key: str, value: z.unknown() }),
  ingredients: z.object({ id: str, name: str, unit: z.enum(['g', 'ml', 'pcs']), packSize: num, packPrice: num.nullable(), ediblePct: num, inBudget: z.boolean(), gluten: z.enum(['SAFE', 'NEEDS_VERIFICATION', 'NOT_SUITABLE']) }).passthrough(),
  recipes: z.object({ id: str, name: str, category: str, serves: num, ingredients: z.array(z.object({ ingredientId: str, amount: num }).passthrough()) }).passthrough(),
  plans: z.object({ id: str, start: str, end: str, status: z.enum(['aktif', 'arsip']), days: z.array(dayPlan) }).passthrough(),
  groceryLists: z.object({ id: str, planId: str, items: z.array(z.object({ id: str, name: str, buyQty: num }).passthrough()) }).passthrough(),
  pantry: z.object({ id: str, ingredientId: str, qty: num, unit: z.enum(['g', 'ml', 'pcs']), confirmed: z.boolean() }).passthrough(),
  spice: z.object({ id: str, bumbuId: str, grams: num }).passthrough(),
  prep: z.object({ id: str, checks: z.record(z.boolean()) }).passthrough(),
  cook: z.object({ id: str, checks: z.record(z.boolean()), done: z.boolean() }).passthrough(),
  videos: z.object({ id: str, recipeId: str, url: str }).passthrough(),
  recipeQueries: z.object({ id: str, query: str }),
  eggLog: z.object({ id: str, eaten: num }),
  journal: z.object({ id: str, date: str, slot: str, eaten: portion, served: portion }).passthrough(),
  growth: z.object({ id: str, date: str, weightKg: num.nullable(), heightCm: num.nullable() }).passthrough(),
  seafood: z.object({ id: str, date: str, type: z.enum(['udang', 'cumi']) }).passthrough(),
};

const backupShape = z.object({
  app: z.literal('home-table'),
  schemaVersion: z.number().int().min(1),
  exportedAt: str,
  tables: z.record(z.array(z.unknown())),
});

export interface BackupCheck {
  ok: boolean;
  errors: string[];
  backup?: BackupFile;
  counts: Record<string, number>;
}

export async function exportAll(db: HomeTableDB): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  for (const name of TABLE_NAMES) tables[name] = await db.table(name).toArray();
  return { app: 'home-table', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), tables };
}

/** Migrasi dari versi lama ke SCHEMA_VERSION. Saat ini hanya v1; tambahkan langkah di sini saat skema berubah. */
export function migrateBackup(b: BackupFile): BackupFile {
  const out = { ...b };
  // contoh: if (out.schemaVersion < 2) { ...ubah tabel...; out.schemaVersion = 2; }
  return out;
}

/** Validasi file backup SEBELUM menimpa data apa pun. */
export function validateBackup(raw: unknown): BackupCheck {
  const errors: string[] = [];
  const head = backupShape.safeParse(raw);
  if (!head.success) {
    return { ok: false, errors: ['Bukan file backup HOME TABLE yang valid: ' + head.error.issues.slice(0, 3).map((i) => `${i.path.join('.')} ${i.message}`).join('; ')], counts: {} };
  }
  const file = head.data as BackupFile;
  if (file.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, errors: [`File backup dibuat oleh versi aplikasi yang lebih baru (skema ${file.schemaVersion} > ${SCHEMA_VERSION}). Perbarui aplikasi terlebih dahulu.`], counts: {} };
  }
  const counts: Record<string, number> = {};
  for (const [name, rows] of Object.entries(file.tables)) {
    if (!(TABLE_NAMES as readonly string[]).includes(name)) { errors.push(`Tabel tidak dikenal: ${name}`); continue; }
    const schema = ROW_SCHEMAS[name as TableName];
    counts[name] = rows.length;
    rows.forEach((row, i) => {
      const r = schema.safeParse(row);
      if (!r.success && errors.length < 12) errors.push(`${name}[${i}]: ${r.error.issues[0].path.join('.')} ${r.error.issues[0].message}`);
    });
  }
  const settings = (file.tables.kv ?? []).find((r) => (r as { key?: string }).key === 'settings') as { value?: { profile?: unknown; prefs?: unknown } } | undefined;
  if (!settings?.value?.profile || !settings.value.prefs) errors.push('Pengaturan keluarga (profil/preferensi) tidak ada di backup.');
  return { ok: errors.length === 0, errors, backup: errors.length === 0 ? migrateBackup(file) : undefined, counts };
}

/** Timpa SEMUA data dengan isi backup yang sudah tervalidasi (dalam satu transaksi: gagal = tidak ada perubahan). */
export async function importAll(db: HomeTableDB, backup: BackupFile): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const name of TABLE_NAMES) {
      const t = db.table(name);
      await t.clear();
      const rows = backup.tables[name] ?? [];
      if (rows.length) await t.bulkPut(rows);
    }
  });
}

export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `home-table-backup-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}
