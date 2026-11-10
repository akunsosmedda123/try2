import type { Recipe, BumbuId } from '../types';
import { I, B, R } from './recipeKit';
import { BUMBU_DEFS, BUMBU_IDS } from './bumbu';

// ====== SAYUR (serves 4 porsi dewasa-ekuivalen, ±70 g bersih/porsi) ======
const sayur: Recipe[] = [
  R({ id: 'bening-bayam-jagung', name: 'Bening bayam jagung', category: 'sayuran', role: 'sayur', protein: 'none', serves: 4, method: 'kuah',
    ingredients: [I('bayam', 200), I('jagung_manis', 1), I('garam', 3)], bumbu: [B('bawang_putih_cincang', 15), B('bawang_merah_cincang', 15)], cookMin: 15 }),
  R({ id: 'bening-bayam-wortel', name: 'Bening bayam wortel', category: 'sayuran', role: 'sayur', protein: 'none', serves: 4, method: 'kuah',
    ingredients: [I('bayam', 200), I('wortel', 100), I('garam', 3)], bumbu: [B('bawang_putih_cincang', 15), B('bawang_merah_cincang', 15)], cookMin: 15 }),
  R({ id: 'sop-wortel-buncis', name: 'Sop wortel buncis', category: 'sayuran', role: 'sayur', protein: 'none', serves: 4, method: 'kuah',
    ingredients: [I('wortel', 150), I('buncis', 120), I('garam', 3), I('lada', 0.5)], bumbu: [B('bawang_putih_cincang', 15), B('bawang_merah_cincang', 15)], cookMin: 20 }),
  R({ id: 'sop-wortel-jagung', name: 'Sop wortel jagung', category: 'sayuran', role: 'sayur', protein: 'none', serves: 4, method: 'kuah',
    ingredients: [I('wortel', 150), I('jagung_manis', 1), I('garam', 3), I('lada', 0.5)], bumbu: [B('bawang_putih_cincang', 15), B('bawang_merah_cincang', 15)], cookMin: 20 }),
  R({ id: 'tumis-labu-siam', name: 'Tumis labu siam', category: 'sayuran', role: 'sayur', protein: 'none', serves: 4, method: 'tumis',
    ingredients: [I('labu_siam', 280), I('minyak', 15), I('garam', 3)], bumbu: [B('bawang_putih_cincang', 15), B('bawang_merah_cincang', 20)], cookMin: 15 }),
  R({ id: 'tumis-sawi-hijau', name: 'Tumis sawi hijau', category: 'sayuran', role: 'sayur', protein: 'none', serves: 4, method: 'tumis',
    ingredients: [I('sawi_hijau', 250), I('minyak', 15), I('garam', 3)], bumbu: [B('bawang_putih_cincang', 15), B('bawang_merah_cincang', 20)], cookMin: 10 }),
  R({ id: 'tumis-wortel-jagung', name: 'Tumis wortel jagung', category: 'sayuran', role: 'sayur', protein: 'none', serves: 4, method: 'tumis',
    ingredients: [I('wortel', 180), I('jagung_manis', 1), I('minyak', 15), I('garam', 3)], bumbu: [B('bawang_putih_cincang', 15), B('bawang_merah_cincang', 20)], cookMin: 15 }),
  R({ id: 'sawi-putih-kuah', name: 'Sawi putih kuah', category: 'sayuran', role: 'sayur', protein: 'none', serves: 4, method: 'kuah',
    ingredients: [I('sawi_putih', 250), I('garam', 3)], bumbu: [B('bawang_putih_cincang', 15), B('bawang_merah_cincang', 15)], cookMin: 12, note: 'Sawi putih bukan kol/kubis.' }),
  R({ id: 'tumis-kangkung', name: 'Tumis kangkung', category: 'sayuran', role: 'sayur', protein: 'none', serves: 4, method: 'tumis',
    ingredients: [I('kangkung', 250), I('minyak', 15), I('garam', 3)], bumbu: [B('bawang_putih_cincang', 15), B('bawang_merah_cincang', 20)], cookMin: 10 }),
  R({ id: 'tumis-buncis-wortel', name: 'Tumis buncis wortel', category: 'sayuran', role: 'sayur', protein: 'none', serves: 4, method: 'tumis',
    ingredients: [I('buncis', 150), I('wortel', 120), I('minyak', 15), I('garam', 3)], bumbu: [B('bawang_putih_cincang', 15), B('bawang_merah_cincang', 20)], cookMin: 15 }),
  R({ id: 'tumis-tauge', name: 'Tumis tauge', category: 'sayuran', role: 'sayur', protein: 'none', serves: 4, method: 'tumis',
    ingredients: [I('tauge', 250), I('daun_bawang', 10), I('minyak', 15), I('garam', 3)], bumbu: [B('bawang_putih_cincang', 15)], cookMin: 8 }),
];

// ====== NASI ANAK (serves = 1 porsi makan anak; childPortionFactor 1) ======
// Estimasi energi sengaja TIDAK ditampilkan: tidak ada data komposisi pangan tepercaya di dalam aplikasi.
const nasi = (id: string, name: string, fat: string, extra: Partial<Recipe> & Pick<Recipe, 'ingredients'>, bumbu: Recipe['bumbu'] = [], companion = ''): Recipe =>
  R({ id, name, category: 'nasi_anak', role: 'nasi', protein: 'none', serves: 1, method: 'tanak', childPortionFactor: 1, prepMin: 5, cookMin: 25,
    bumbu, note: `Jenis lemak: ${fat}.${companion ? ' Lauk pendamping: ' + companion + '.' : ''}`, ...extra });

const nasiList: Recipe[] = [
  nasi('nasi-butter', 'Nasi butter', 'butter', { ingredients: [I('beras', 45), I('butter', 6), I('garam', 0.3)] }, [], 'telur/ayam suwir'),
  nasi('nasi-uduk-santan', 'Nasi uduk santan', 'santan', { youtubeQuery: 'resep nasi uduk anak', ingredients: [I('beras', 45), I('santan', 30), I('daun_salam', 0.5), I('serai', 0.3), I('garam', 0.4)] }, [], 'ayam/ikan goreng'),
  nasi('nasi-kuning', 'Nasi kuning santan', 'santan', { ingredients: [I('beras', 45), I('santan', 30), I('kunyit', 3), I('daun_jeruk', 0.3), I('serai', 0.3), I('garam', 0.4)] }, [], 'telur/ayam'),
  nasi('nasi-daun-jeruk', 'Nasi daun jeruk', 'minyak/butter', { ingredients: [I('beras', 45), I('daun_jeruk', 0.6), I('serai', 0.3), I('minyak', 4), I('garam', 0.4)] }, [], 'ikan/ayam'),
  nasi('nasi-kaldu-ayam', 'Nasi kaldu ayam', 'minyak', { ingredients: [I('beras', 45), I('ayam_potong', 12, ['paha_atas']), I('minyak', 4), I('garam', 0.4)] }, [B('bawang_putih_cincang', 3)], 'lauk apa saja'),
  nasi('nasi-gurih-bawang', 'Nasi gurih bawang', 'minyak', { ingredients: [I('beras', 45), I('minyak', 5), I('garam', 0.4)] }, [B('bawang_merah_cincang', 5), B('bawang_putih_cincang', 3)]),
  nasi('nasi-santan-gurih', 'Nasi santan gurih', 'santan', { ingredients: [I('beras', 45), I('santan', 30), I('daun_salam', 0.5), I('garam', 0.4)] }, [B('bawang_putih_cincang', 3)]),
  nasi('nasi-ayam-cincang', 'Nasi ayam cincang', 'minyak', { ingredients: [I('beras', 45), I('ayam_potong', 15, ['fillet_dada']), I('minyak', 4), I('garam', 0.4)] }, [B('bawang_putih_cincang', 3)]),
  nasi('nasi-mentega-bawang', 'Nasi mentega bawang', 'butter', { ingredients: [I('beras', 45), I('butter', 6), I('garam', 0.3)] }, [B('bawang_putih_cincang', 4)]),
  nasi('nasi-gurih-minyak', 'Nasi gurih minyak', 'minyak', { ingredients: [I('beras', 45), I('minyak', 6), I('garam', 0.4)] }, [B('bawang_merah_cincang', 4)]),
  nasi('nasi-kaldu-daging', 'Nasi kaldu daging', 'minyak', { ingredients: [I('beras', 45), I('sapi_daging', 12), I('minyak', 4), I('garam', 0.4)] }, [B('bawang_putih_cincang', 3)]),
  nasi('nasi-bawang-putih', 'Nasi bawang putih', 'minyak', { ingredients: [I('beras', 45), I('minyak', 5), I('garam', 0.4)] }, [B('bawang_putih_cincang', 6)]),
];

export const NASI_RECIPES: Recipe[] = nasiList;

// ====== BUMBU DASAR sebagai resep (100 g) ======
export const BUMBU_RECIPES: Recipe[] = BUMBU_IDS.map((id: BumbuId) => {
  const d = BUMBU_DEFS[id];
  return R({
    id: `bumbu-${id}`, name: d.label, category: 'bumbu_dasar', role: 'pendamping', protein: 'none', serves: 1,
    method: 'lainnya', spice: d.spicy ? 'hot' : 'none', prepMin: 15, cookMin: 10, prepAhead: true, weekendOk: true,
    ingredients: d.base.map((b) => I(b.ingredientId, b.amount)),
    steps: ['Kupas dan cuci semua bahan.', 'Haluskan (blender/ulek) dengan sedikit minyak. Untuk bawang cincang, cincang halus saja.', 'Tumis sebentar sampai harum bila diinginkan.', 'Dinginkan, masukkan ke wadah bersih, beri label (nama, tanggal), simpan di kulkas/freezer.'],
    note: d.note ?? 'Takaran untuk ±100 g bumbu jadi.',
    youtubeQuery: `cara membuat ${d.label.toLowerCase()}`,
  });
});

export const SAYUR_RECIPES = sayur;
