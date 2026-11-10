import type { Ingredient, IngredientCategory, Unit, GlutenStatus, ProteinType, FishSpecies } from '../types';

export const PRICE_DATE = '2026-11-10';
export const PRICE_SOURCE =
  'Estimasi awal pengembang (BUKAN harga pasar terverifikasi). Ubah sesuai harga di pasar/warung Tangerang Selatan.';
export const PRICE_LOCATION = 'Kota Tangerang Selatan, Banten';

interface Opt {
  protein?: ProteinType;
  species?: FishSpecies;
  tags?: string[];
  gluten?: GlutenStatus;
  budget?: boolean;
  shelf?: Ingredient['shelfDays'];
  note?: string;
  buyable?: boolean;
  gpp?: number;
}

function ing(
  id: string,
  name: string,
  category: IngredientCategory,
  unit: Unit,
  packSize: number,
  packPrice: number | null,
  ediblePct: number,
  o: Opt = {},
): Ingredient {
  const budgetCats: IngredientCategory[] = ['ayam_daging', 'ikan_seafood', 'telur', 'sayur', 'santan'];
  return {
    id,
    name,
    category,
    unit,
    packSize,
    packPrice,
    priceStatus: packPrice === null ? 'kosong' : 'estimasi',
    priceLocation: PRICE_LOCATION,
    priceSource: packPrice === null ? 'Belum diisi pengguna' : PRICE_SOURCE,
    priceUpdated: PRICE_DATE,
    ediblePct,
    inBudget: o.budget ?? budgetCats.includes(category),
    gluten: o.gluten ?? 'SAFE',
    protein: o.protein,
    species: o.species,
    tags: o.tags ?? [],
    shelfDays: o.shelf,
    note: o.note,
    buyable: o.buyable ?? true,
    gramsPerPcs: o.gpp,
  };
}

const MEAT_SHELF = { kulkas: 2, freezer: 90 };
const FISH_SHELF = { kulkas: 1, freezer: 60 };
const VEG_SHELF = { kulkas: 4, pantry: 2 };

export const BASE_INGREDIENTS: Ingredient[] = [
  // ---- Ayam & daging (masuk budget) ----
  ing('ayam_potong', 'Ayam potong / parting / utuh', 'ayam_daging', 'g', 250, 9500, 0.7, { protein: 'ayam', shelf: MEAT_SHELF, gpp: 150, note: '1 pcs parting ≈ 150 g (estimasi, bisa diedit).' }),
  ing('paha_atas', 'Paha atas ayam', 'ayam_daging', 'g', 250, 10500, 0.78, { protein: 'ayam', shelf: MEAT_SHELF }),
  ing('fillet_dada', 'Fillet dada ayam', 'ayam_daging', 'g', 250, 13000, 0.97, { protein: 'ayam', shelf: MEAT_SHELF }),
  ing('hati_ayam', 'Hati ayam', 'ayam_daging', 'g', 250, 7500, 0.95, { protein: 'hati', tags: ['hati'], shelf: MEAT_SHELF }),
  ing('ampela_ayam', 'Ampela ayam', 'ayam_daging', 'g', 250, 8000, 0.9, { protein: 'hati', tags: ['ampela'], shelf: MEAT_SHELF }),
  ing('sapi_daging', 'Daging sapi (sengkel/has)', 'ayam_daging', 'g', 250, 35000, 0.95, { protein: 'sapi', shelf: MEAT_SHELF }),
  ing('sapi_cincang', 'Daging sapi cincang', 'ayam_daging', 'g', 250, 37500, 0.98, { protein: 'sapi', shelf: { kulkas: 1, freezer: 90 } }),

  // ---- Telur ----
  ing('telur', 'Telur ayam', 'telur', 'pcs', 1, 1950, 1, { protein: 'telur', tags: ['telur'], shelf: { kulkas: 21, pantry: 7 } }),

  // ---- Ikan & seafood ----
  ing('ikan_lele', 'Ikan lele', 'ikan_seafood', 'g', 250, 7500, 0.6, { protein: 'ikan', species: 'lele', shelf: FISH_SHELF }),
  ing('ikan_nila', 'Ikan nila', 'ikan_seafood', 'g', 250, 9500, 0.5, { protein: 'ikan', species: 'nila', shelf: FISH_SHELF }),
  ing('ikan_kembung', 'Ikan kembung', 'ikan_seafood', 'g', 250, 10000, 0.6, { protein: 'ikan', species: 'kembung', shelf: FISH_SHELF }),
  ing('ikan_layang', 'Ikan layang', 'ikan_seafood', 'g', 250, 8750, 0.6, { protein: 'ikan', species: 'layang', shelf: FISH_SHELF, gpp: 120 }),
  ing('ikan_patin', 'Ikan patin', 'ikan_seafood', 'g', 250, 10000, 0.6, { protein: 'ikan', species: 'patin', shelf: FISH_SHELF }),
  ing('bandeng_presto', 'Bandeng presto', 'ikan_seafood', 'g', 250, 16250, 0.85, { protein: 'ikan', species: 'bandeng_presto', shelf: { kulkas: 3, freezer: 60 }, note: 'Khusus suami (default). Periksa sisa duri.' }),
  ing('ikan_bandeng', 'Bandeng (non-presto)', 'ikan_seafood', 'g', 250, 11000, 0.6, { protein: 'ikan', species: 'bandeng', shelf: FISH_SHELF, note: 'Tidak otomatis diperbolehkan. Banyak duri halus.' }),
  ing('ikan_tongkol', 'Ikan tongkol (DILARANG)', 'ikan_seafood', 'g', 250, null, 0.6, { protein: 'ikan', species: 'tongkol', buyable: false }),
  ing('ikan_asap', 'Ikan asap (DILARANG)', 'ikan_seafood', 'g', 250, null, 0.9, { protein: 'ikan', species: 'ikan_asap', buyable: false }),
  ing('udang', 'Udang segar', 'ikan_seafood', 'g', 250, 20000, 0.55, { protein: 'udang', tags: ['seafood', 'udang'], shelf: { kulkas: 1, freezer: 60 } }),
  ing('cumi', 'Cumi segar', 'ikan_seafood', 'g', 250, 18750, 0.75, { protein: 'cumi', tags: ['seafood', 'cumi'], shelf: { kulkas: 1, freezer: 60 } }),
  ing('cumi_frozen_porsi', 'Cumi frozen siap saji (porsi anak)', 'ikan_seafood', 'pcs', 1, null, 1, { protein: 'cumi', tags: ['seafood', 'cumi'], gluten: 'NEEDS_VERIFICATION', shelf: { freezer: 60 }, note: 'Produk olahan: periksa label gluten-free.' }),

  // ---- Tahu / tempe (pendamping) ----
  ing('tempe', 'Tempe', 'ayam_daging', 'g', 250, 5000, 1, { protein: 'tahu_tempe', tags: ['tahu_tempe'], shelf: { kulkas: 3 } }),
  ing('tahu', 'Tahu', 'ayam_daging', 'g', 250, 5000, 1, { protein: 'tahu_tempe', tags: ['tahu_tempe'], shelf: { kulkas: 2 } }),

  // ---- Sayuran (masuk budget) ----
  ing('bayam', 'Bayam', 'sayur', 'g', 250, 3000, 0.85, { shelf: VEG_SHELF }),
  ing('kangkung', 'Kangkung', 'sayur', 'g', 250, 3000, 0.8, { shelf: VEG_SHELF }),
  ing('wortel', 'Wortel', 'sayur', 'g', 250, 4000, 0.9, { shelf: { kulkas: 10, pantry: 4 } }),
  ing('buncis', 'Buncis', 'sayur', 'g', 250, 5000, 0.9, { shelf: VEG_SHELF }),
  ing('labu_siam', 'Labu siam', 'sayur', 'g', 250, 2500, 0.85, { shelf: { kulkas: 7, pantry: 3 } }),
  ing('sawi_hijau', 'Sawi hijau', 'sayur', 'g', 250, 3000, 0.85, { shelf: VEG_SHELF }),
  ing('sawi_putih', 'Sawi putih', 'sayur', 'g', 250, 3000, 0.9, { shelf: VEG_SHELF, note: 'Sawi putih BUKAN kol/kubis.' }),
  ing('jagung_manis', 'Jagung manis (bonggol)', 'sayur', 'pcs', 1, 4000, 1, { shelf: { kulkas: 4, pantry: 2 } }),
  ing('tauge', 'Tauge', 'sayur', 'g', 250, 2500, 0.95, { shelf: { kulkas: 2 } }),
  ing('kentang', 'Kentang', 'sayur', 'g', 250, 4500, 0.85, { shelf: { pantry: 14, kulkas: 21 } }),
  ing('kol', 'Kol / kubis (DILARANG)', 'sayur', 'g', 250, null, 0.85, { tags: ['kol'], buyable: false }),
  ing('oyong', 'Oyong (DILARANG untuk anak)', 'sayur', 'g', 250, null, 0.8, { tags: ['oyong'], buyable: false }),
  ing('pare', 'Pare (DILARANG untuk anak)', 'sayur', 'g', 250, null, 0.85, { tags: ['pare'], buyable: false }),

  // ---- Santan (masuk budget) ----
  ing('santan', 'Santan kemasan', 'santan', 'ml', 65, 5000, 1, { shelf: { pantry: 30, kulkas: 2 }, note: 'Cek label bila ada bahan tambahan.' }),

  // ---- Bumbu (di luar budget) ----
  ing('bawang_merah', 'Bawang merah', 'bumbu', 'g', 100, 3500, 0.95, { shelf: { pantry: 14, kulkas: 21 } }),
  ing('bawang_putih', 'Bawang putih', 'bumbu', 'g', 100, 3800, 0.9, { shelf: { pantry: 14, kulkas: 21 } }),
  ing('kunyit', 'Kunyit', 'bumbu', 'g', 50, 1000, 0.9, { shelf: { kulkas: 7, pantry: 3 } }),
  ing('jahe', 'Jahe', 'bumbu', 'g', 50, 1500, 0.9, { shelf: { kulkas: 10, pantry: 4 } }),
  ing('lengkuas', 'Lengkuas', 'bumbu', 'g', 50, 1000, 0.9, { shelf: { kulkas: 10, pantry: 4 } }),
  ing('serai', 'Serai', 'bumbu', 'pcs', 1, 500, 1, { shelf: { kulkas: 10, pantry: 3 } }),
  ing('daun_jeruk', 'Daun jeruk', 'bumbu', 'pcs', 5, 1000, 1, { shelf: { kulkas: 7, freezer: 60 } }),
  ing('daun_salam', 'Daun salam', 'bumbu', 'pcs', 5, 1000, 1, { shelf: { kulkas: 7, pantry: 5 } }),
  ing('daun_bawang', 'Daun bawang', 'bumbu', 'g', 50, 2000, 0.9, { shelf: { kulkas: 5 } }),
  ing('kemiri', 'Kemiri', 'bumbu', 'g', 50, 4000, 1, { shelf: { pantry: 90 } }),
  ing('ketumbar', 'Ketumbar bubuk', 'bumbu', 'g', 20, 2000, 1, { shelf: { pantry: 180 }, note: 'Pakai rempah murni; hindari bumbu instan campuran.' }),
  ing('lada', 'Lada', 'bumbu', 'g', 20, 3000, 1, { shelf: { pantry: 180 }, note: 'Pakai rempah murni.' }),
  ing('tomat', 'Tomat', 'bumbu', 'g', 250, 3500, 0.95, { shelf: { kulkas: 5, pantry: 3 } }),
  ing('cabai_merah', 'Cabai merah', 'bumbu', 'g', 100, 5000, 0.95, { tags: ['pedas'], shelf: { kulkas: 7, pantry: 2 } }),
  ing('kluwek', 'Kluwek matang siap pakai', 'bumbu', 'g', 100, 5000, 1, { shelf: { pantry: 30, kulkas: 14 }, note: 'Pakai kluwek yang sudah matang/siap pakai.' }),
  ing('asam_jawa', 'Asam jawa', 'bumbu', 'g', 50, 2500, 1, { shelf: { pantry: 90 } }),
  ing('gula_merah', 'Gula merah', 'bumbu', 'g', 100, 3000, 1, { shelf: { pantry: 180 } }),

  // ---- Pantry staples (di luar budget) ----
  ing('beras', 'Beras', 'pantry', 'g', 1000, 15000, 1, { shelf: { pantry: 180 } }),
  ing('minyak', 'Minyak goreng', 'pantry', 'ml', 1000, 20000, 1, { shelf: { pantry: 180 } }),
  ing('butter', 'Butter / mentega', 'pantry', 'g', 200, 25000, 1, { shelf: { kulkas: 60 }, note: 'Butter murni umumnya bebas gluten; tetap cek label.' }),
  ing('garam', 'Garam', 'pantry', 'g', 250, 3000, 1, { shelf: { pantry: 365 } }),
  ing('gula', 'Gula pasir', 'pantry', 'g', 1000, 17000, 1, { shelf: { pantry: 365 } }),
  ing('kecap_manis', 'Kecap manis', 'pantry', 'ml', 275, 12000, 1, { gluten: 'NEEDS_VERIFICATION', tags: ['kecap'], shelf: { pantry: 180 }, note: 'Banyak kecap mengandung gandum. Periksa label gluten-free.' }),
  ing('tepung_gf', 'Tepung pelapis GF (beras/maizena)', 'pantry', 'g', 200, 8000, 1, { gluten: 'NEEDS_VERIFICATION', tags: ['tepung'], shelf: { pantry: 180 }, note: 'Periksa label gluten-free dan risiko kontaminasi silang.' }),
  ing('terigu', 'Tepung terigu (mengandung gluten)', 'pantry', 'g', 1000, 13000, 1, { gluten: 'NOT_SUITABLE', tags: ['gluten'], shelf: { pantry: 180 } }),
  ing('tepung_panir', 'Tepung panir / panko (mengandung gluten)', 'pantry', 'g', 200, 9000, 1, { gluten: 'NOT_SUITABLE', tags: ['gluten'], shelf: { pantry: 180 } }),
  ing('kaldu_bubuk', 'Kaldu bubuk / bumbu instan', 'pantry', 'g', 100, 8000, 1, { gluten: 'NEEDS_VERIFICATION', shelf: { pantry: 180 }, note: 'Produk olahan: periksa label gluten-free.' }),
];

export function ingredientMap(list: Ingredient[]): Map<string, Ingredient> {
  return new Map(list.map((i) => [i.id, i]));
}

export const CATEGORY_LABEL: Record<IngredientCategory, string> = {
  ayam_daging: 'Ayam & daging',
  ikan_seafood: 'Ikan & seafood',
  telur: 'Telur',
  sayur: 'Sayuran',
  santan: 'Santan',
  bumbu: 'Bumbu',
  pantry: 'Pantry',
};

export const CATEGORY_ORDER: IngredientCategory[] = [
  'ayam_daging',
  'ikan_seafood',
  'telur',
  'sayur',
  'santan',
  'bumbu',
  'pantry',
];
