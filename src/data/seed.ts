import type { DayPlan, MealPlan, PantryItem, Settings, RequiredDishConfig } from '../types';

export const SEED_VERSION = 1;
export const SEED_PLAN_ID = 'plan-2026-11-09';

export const DEFAULT_REQUIRED: RequiredDishConfig[] = [
  { id: 'rawon', label: 'Rawon daging sapi', minPerCycle: 1 },
  { id: 'kentaki', label: 'Ayam goreng kentaki', minPerCycle: 1 },
  { id: 'ungkep', label: 'Ayam goreng ungkep', minPerCycle: 1 },
  { id: 'balado', label: 'Ikan balado', minPerCycle: 1 },
  { id: 'katsu', label: 'Ayam katsu', minPerCycle: 1 },
  { id: 'sambal_goreng', label: 'Sambal goreng ati ampela kentang tidak pedas', minPerCycle: 1 },
];

export const DEFAULT_SETTINGS: Settings = {
  profile: {
    ibu: { name: 'Ibu' },
    ayah: { name: 'Ayah' },
    anak: {
      name: 'Anak',
      birthDate: '2023-05-10',
      birthDateApprox: true, // perkiraan dari usia 3 th 6 bln; ubah ke tanggal lahir sebenarnya
      allergies: ['gluten'],
      dislikes: ['oyong', 'kol/kubis', 'pare'],
      favorites: [],
      doctorNotes: '',
    },
    childPortionFactor: 0.5,
    seafoodKnownSafe: { udang: false, cumi: false },
  },
  prefs: {
    motherBreakfastEggs: 1,
    budgetMode: 'HEMAT',
    weeklyBudget: 300000,
    budgetStrategy: 'FIXED_WEEKLY',
    beefReserveOn: true,
    location: 'Kota Tangerang Selatan, Banten',
    maxWeekendSessionMin: 180,
    adultRiceGPerMeal: 80,
    requiredDishes: DEFAULT_REQUIRED,
    cycleMode: 'siklus30',
  },
  cash: { amount: 0, updated: '' },
  seedVersion: SEED_VERSION,
};

export const BUDGET_PRESETS = { HEMAT: 300000, NORMAL: 350000, FLEKSIBEL: 400000 } as const;

type Rice = [string, string?];
const ALT = 'ayam-suwir';

// [tanggal, lauk A / pagi-siang anak, lauk B / malam, ibu siang, sayur, nasi(+catatan), tambahan]
type Row = [string, string, string, 'F' | 'A', string, Rice, string?, string[]?];

const ROWS: Row[] = [
  ['2026-11-09', 'telur-dadar-daun-bawang', 'ayam-ungkep-kuning', 'A', 'bening-bayam-jagung', ['nasi-butter']],
  ['2026-11-10', 'kembung-kuah-kuning', 'hati-ayam-kecap', 'F', 'sop-wortel-buncis', ['nasi-uduk-santan'], 'Hati anak dalam porsi kecil.'],
  ['2026-11-11', 'udang-bawang-putih', 'lele-goreng-kunyit', 'A', 'tumis-labu-siam', ['nasi-kaldu-ayam', '+ minyak'], 'Seafood anak periode pertama.'],
  ['2026-11-12', 'telur-orak-arik', 'semur-ayam', 'A', 'tumis-sawi-hijau', ['nasi-daun-jeruk', '+ butter']],
  ['2026-11-13', 'ayam-suwir-bawang', 'nila-goreng', 'F', 'tumis-wortel-jagung', ['nasi-gurih-bawang']],
  ['2026-11-14', 'ayam-kentaki-gf', 'ayam-semur-bawang-gf', 'F', 'sawi-putih-kuah', ['nasi-butter'], 'Satu sesi memasak.'],
  ['2026-11-15', 'pepes-kembung', 'semur-telur', 'F', 'tumis-kangkung', ['nasi-gurih-minyak'], 'Ibu sesekali boleh mengikuti menu telur keluarga pada malam hari. Satu sesi memasak.'],
  ['2026-11-16', 'telur-dadar', 'lele-goreng', 'A', 'bening-bayam-wortel', ['nasi-butter']],
  ['2026-11-17', 'ayam-suwir-jahe', 'kembung-balado', 'F', 'tumis-buncis-wortel', ['nasi-daun-jeruk'], 'Anak: versi tanpa cabai.'],
  ['2026-11-18', 'ayam-suwir-bawang', 'ayam-kuah-jahe', 'F', 'tumis-labu-siam', ['nasi-kaldu-ayam', 'gurih kaldu']],
  ['2026-11-19', 'telur-orak-arik', 'rawon-sapi', 'A', 'tumis-tauge', ['nasi-kuning'], 'Daging sapi keluarga dan daging sapi anak pertama.'],
  ['2026-11-20', 'ayam-goreng-lengkuas', 'nila-kukus-jahe', 'F', 'sawi-putih-kuah', ['nasi-bawang-putih', '+ minyak']],
  ['2026-11-21', 'ayam-teriyaki-gf', 'kembung-goreng-kunyit', 'F', 'sop-wortel-buncis', ['nasi-butter'], 'Satu sesi memasak.'],
  ['2026-11-22', 'ayam-panggang-kecap-gf', 'semur-telur', 'F', 'tumis-kangkung', ['nasi-gurih-minyak'], 'Tambahan dewasa: tempe pendamping. Satu sesi memasak.', ['tempe-goreng']],
  ['2026-11-23', 'telur-dadar', 'kembung-goreng-kunyit', 'A', 'bening-bayam-wortel', ['nasi-kuning']],
  ['2026-11-24', 'ayam-suwir-kunyit', 'lele-goreng', 'F', 'tumis-buncis-wortel', ['nasi-butter']],
  ['2026-11-25', 'cumi-cincang-bawang-putih', 'ayam-kecap', 'A', 'sop-wortel-jagung', ['nasi-kaldu-ayam', '+ minyak'], 'Cumi khusus anak, weekday. Seafood periode kedua.'],
  ['2026-11-26', 'telur-orak-arik', 'nila-kuah-kuning', 'A', 'tumis-labu-siam', ['nasi-daun-jeruk']],
  ['2026-11-27', 'ayam-cincang-bawang-putih', 'sambal-goreng-ati-ampela-kentang', 'F', 'sawi-putih-kuah', ['nasi-mentega-bawang'], 'Menu wajib bulanan. Hati + ampela + kentang, tanpa cabai.'],
  ['2026-11-28', 'ayam-bakar', 'kembung-kuah-asam', 'F', 'sop-wortel-buncis', ['nasi-santan-gurih'], 'Satu sesi memasak.'],
  ['2026-11-29', 'ayam-bumbu-jahe', 'semur-telur', 'F', 'tumis-kangkung', ['nasi-gurih-minyak'], 'Tambahan dewasa: tempe pendamping. Satu sesi memasak.', ['tempe-goreng']],
  ['2026-11-30', 'telur-dadar', 'ayam-katsu-gf', 'A', 'bening-bayam-wortel', ['nasi-butter']],
  ['2026-12-01', 'kembung-bumbu-kuning', 'semur-ayam', 'F', 'tumis-buncis-wortel', ['nasi-kuning']],
  ['2026-12-02', 'sapi-cincang-mentega', 'lele-goreng', 'F', 'tumis-labu-siam', ['nasi-daun-jeruk', '+ minyak'], 'Daging sapi anak kedua.'],
  ['2026-12-03', 'telur-ceplok', 'nila-goreng-bawang', 'A', 'tumis-sawi-hijau', ['nasi-bawang-putih']],
  ['2026-12-04', 'ayam-cincang-mentega', 'telur-dadar-keluarga', 'F', 'sop-wortel-jagung', ['nasi-kaldu-ayam', '+ minyak'], 'Ibu boleh ikut menu telur keluarga.'],
  ['2026-12-05', 'ayam-goreng-kremes-gf', 'nila-bakar-bumbu-kuning', 'F', 'sawi-putih-kuah', ['nasi-butter'], 'Satu sesi memasak.'],
  ['2026-12-06', 'kembung-kuah-asam', 'semur-telur', 'F', 'tumis-kangkung', ['nasi-gurih-minyak'], 'Ayah memiliki menu telur Jumat dan Minggu, tidak berturut-turut. Satu sesi memasak.'],
  ['2026-12-07', 'telur-dadar', 'kembung-kuah-kuning', 'A', 'sop-wortel-buncis', ['nasi-butter']],
  ['2026-12-08', 'ayam-suwir', 'lele-goreng', 'F', 'tumis-labu-siam', ['nasi-daun-jeruk']],
];

export function buildSeedDays(): DayPlan[] {
  return ROWS.map(([date, a, b, lunch, veg, rice, note, sides]) => ({
    date,
    mainA: a,
    mainB: b,
    motherLunch: lunch === 'F' ? { mode: 'follow' as const } : { mode: 'alt' as const, recipeId: ALT },
    veg,
    rice: rice[0],
    riceNote: rice[1],
    sides: sides ?? [],
    locked: false,
    note,
  }));
}

export function buildSeedPlan(now = new Date().toISOString()): MealPlan {
  return {
    id: SEED_PLAN_ID,
    name: 'Menu 9 November – 8 Desember 2026 (seed awal)',
    start: '2026-11-09',
    end: '2026-12-08',
    status: 'aktif',
    createdAt: now,
    source: 'seed',
    days: buildSeedDays(),
  };
}

// Contoh stok yang pernah dilaporkan (Nov 2026). TIDAK aktif sampai pengguna mengonfirmasi.
export function buildSampleStock(): PantryItem[] {
  const mk = (id: string, ingredientId: string, name: string, qty: number, unit: PantryItem['unit'], location: PantryItem['location'], note = ''): PantryItem => ({
    id: `sample-${id}`, ingredientId, name, qty, unit, location, purchasedDate: '', condition: 'mentah',
    safety: 'periksa', price: null, useBy: '', confirmed: false, note: `Contoh stok (dilaporkan Nov 2026). Konfirmasi dulu. ${note}`.trim(),
  });
  return [
    mk('hati', 'hati_ayam', 'Hati ayam', 1000, 'g', 'freezer'),
    mk('paha', 'paha_atas', 'Paha atas ayam', 1000, 'g', 'freezer'),
    mk('parting', 'ayam_potong', 'Ayam parting', 4, 'pcs', 'freezer', '1 pcs ≈ 150 g (estimasi).'),
    mk('telur', 'telur', 'Telur', 16, 'pcs', 'kulkas'),
    mk('udang', 'udang', 'Udang', 500, 'g', 'freezer'),
    mk('cumi', 'cumi', 'Cumi (khusus anak, weekday)', 500, 'g', 'freezer'),
    mk('cumi-frozen', 'cumi_frozen_porsi', 'Cumi frozen siap saji (porsi anak)', 3, 'pcs', 'freezer', 'Periksa label gluten-free.'),
    mk('layang', 'ikan_layang', 'Ikan layang', 1, 'pcs', 'kulkas', '1 ekor ≈ 120 g (estimasi).'),
  ];
}

export const SAMPLE_CASH = 125000;
