import type { BumbuId } from '../types';

export interface BumbuDef {
  id: BumbuId;
  label: string;
  spicy: boolean;
  // komposisi bahan mentah per 100 g bumbu jadi (dalam unit bahan)
  base: { ingredientId: string; amount: number }[];
  note?: string;
}

export const BUMBU_DEFS: Record<BumbuId, BumbuDef> = {
  kuning: {
    id: 'kuning', label: 'Bumbu kuning', spicy: false,
    base: [
      { ingredientId: 'bawang_merah', amount: 28 }, { ingredientId: 'bawang_putih', amount: 20 },
      { ingredientId: 'kunyit', amount: 22 }, { ingredientId: 'kemiri', amount: 10 },
      { ingredientId: 'ketumbar', amount: 3 }, { ingredientId: 'jahe', amount: 12 },
      { ingredientId: 'lengkuas', amount: 5 },
    ],
  },
  putih: {
    id: 'putih', label: 'Bumbu putih', spicy: false,
    base: [
      { ingredientId: 'bawang_merah', amount: 45 }, { ingredientId: 'bawang_putih', amount: 35 },
      { ingredientId: 'kemiri', amount: 15 }, { ingredientId: 'jahe', amount: 5 },
    ],
  },
  merah_tanpa_cabai: {
    id: 'merah_tanpa_cabai', label: 'Bumbu merah tanpa cabai', spicy: false,
    base: [
      { ingredientId: 'bawang_merah', amount: 40 }, { ingredientId: 'bawang_putih', amount: 20 },
      { ingredientId: 'tomat', amount: 37 }, { ingredientId: 'gula_merah', amount: 3 },
    ],
    note: 'Untuk balado anak dan sambal goreng ati ampela kentang.',
  },
  merah_pedas: {
    id: 'merah_pedas', label: 'Bumbu merah pedas (dewasa)', spicy: true,
    base: [
      { ingredientId: 'bawang_merah', amount: 35 }, { ingredientId: 'bawang_putih', amount: 15 },
      { ingredientId: 'cabai_merah', amount: 35 }, { ingredientId: 'tomat', amount: 15 },
    ],
    note: 'Hanya untuk dewasa. Jangan dicampur ke porsi anak.',
  },
  bawang_merah_cincang: {
    id: 'bawang_merah_cincang', label: 'Bawang merah cincang', spicy: false,
    base: [{ ingredientId: 'bawang_merah', amount: 100 }],
  },
  bawang_putih_cincang: {
    id: 'bawang_putih_cincang', label: 'Bawang putih cincang', spicy: false,
    base: [{ ingredientId: 'bawang_putih', amount: 100 }],
  },
  rawon: {
    id: 'rawon', label: 'Bumbu rawon', spicy: false,
    base: [
      { ingredientId: 'bawang_merah', amount: 25 }, { ingredientId: 'bawang_putih', amount: 12 },
      { ingredientId: 'kluwek', amount: 15 }, { ingredientId: 'kemiri', amount: 10 },
      { ingredientId: 'kunyit', amount: 8 }, { ingredientId: 'ketumbar', amount: 3 },
      { ingredientId: 'lengkuas', amount: 12 }, { ingredientId: 'serai', amount: 1 },
      { ingredientId: 'daun_jeruk', amount: 2 },
    ],
  },
  semur: {
    id: 'semur', label: 'Bumbu semur', spicy: false,
    base: [
      { ingredientId: 'bawang_merah', amount: 40 }, { ingredientId: 'bawang_putih', amount: 28 },
      { ingredientId: 'kemiri', amount: 10 }, { ingredientId: 'jahe', amount: 10 },
      { ingredientId: 'lada', amount: 2 }, { ingredientId: 'ketumbar', amount: 5 },
    ],
  },
  ungkep: {
    id: 'ungkep', label: 'Bumbu ungkep', spicy: false,
    base: [
      { ingredientId: 'bawang_merah', amount: 28 }, { ingredientId: 'bawang_putih', amount: 22 },
      { ingredientId: 'kunyit', amount: 18 }, { ingredientId: 'ketumbar', amount: 3 },
      { ingredientId: 'kemiri', amount: 8 }, { ingredientId: 'jahe', amount: 10 },
      { ingredientId: 'lengkuas', amount: 11 }, { ingredientId: 'daun_salam', amount: 1 },
    ],
  },
  bakar: {
    id: 'bakar', label: 'Bumbu bakar', spicy: false,
    base: [
      { ingredientId: 'bawang_merah', amount: 35 }, { ingredientId: 'bawang_putih', amount: 25 },
      { ingredientId: 'kemiri', amount: 10 }, { ingredientId: 'jahe', amount: 10 },
      { ingredientId: 'gula_merah', amount: 12 }, { ingredientId: 'ketumbar', amount: 3 },
      { ingredientId: 'asam_jawa', amount: 5 },
    ],
  },
  bawang_jahe: {
    id: 'bawang_jahe', label: 'Bumbu bawang-jahe', spicy: false,
    base: [
      { ingredientId: 'bawang_putih', amount: 45 }, { ingredientId: 'bawang_merah', amount: 25 },
      { ingredientId: 'jahe', amount: 30 },
    ],
  },
};

export const BUMBU_IDS = Object.keys(BUMBU_DEFS) as BumbuId[];

// Panduan penyimpanan umum yang konservatif (bukan klaim keamanan mutlak).
export const BUMBU_SHELF = { kulkas: 3, freezer: 30, pantry: 0 } as const;
export const BUMBU_CONTAINER_G = 100;
