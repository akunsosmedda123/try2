import type { BumbuId, Method, Recipe, RecipeIngredient } from '../types';

export const I = (ingredientId: string, amount: number, options?: string[]): RecipeIngredient => ({
  ingredientId,
  amount,
  ...(options ? { options } : {}),
});
export const B = (type: BumbuId, grams: number) => ({ type, grams });

const DEFAULT_STEPS: Record<Method, string[]> = {
  goreng: [
    'Cuci bahan, tiriskan, lalu lumuri bumbu dan diamkan 15–30 menit.',
    'Panaskan minyak, goreng dengan api sedang sampai matang sempurna.',
    'Tiriskan. Bagi per waktu makan, dinginkan cepat, lalu simpan di wadah tertutup.',
  ],
  tumis: [
    'Tumis bumbu sampai harum.',
    'Masukkan bahan utama, masak sampai matang dan bumbu meresap.',
    'Koreksi rasa. Untuk porsi anak: tidak pedas dan tekstur sesuai kemampuan mengunyah.',
  ],
  kuah: [
    'Haluskan bumbu dan tumis sampai harum.',
    'Tambahkan air, didihkan, lalu masukkan bahan utama.',
    'Masak sampai matang dan empuk. Periksa duri bila memakai ikan.',
  ],
  bakar: [
    'Lumuri bahan dengan bumbu, diamkan minimal 30 menit.',
    'Bakar/panggang sambil dioles bumbu sampai matang sempurna.',
    'Simpan sisa porsi dengan aman, jangan dibiarkan di suhu ruang.',
  ],
  kukus: [
    'Campur bahan dengan bumbu, bungkus daun atau taruh di wadah tahan panas.',
    'Kukus sampai matang sempurna.',
    'Periksa duri/tekstur sebelum disajikan untuk anak.',
  ],
  rebus: [
    'Rebus bahan sampai matang sempurna.',
    'Tiriskan, lalu bumbui sesuai resep.',
  ],
  panggang: [
    'Lumuri bahan dengan bumbu dan diamkan 30 menit.',
    'Panggang dalam oven/teflon tertutup sampai matang sempurna.',
  ],
  semur: [
    'Tumis bumbu semur sampai harum.',
    'Masukkan bahan utama, kecap, dan air secukupnya.',
    'Masak dengan api kecil sampai bumbu meresap dan bahan empuk.',
  ],
  suwir: [
    'Rebus ayam sampai matang, tiriskan dan suwir-suwir.',
    'Tumis bumbu sampai harum, masukkan suwiran ayam, masak sampai bumbu meresap.',
    'Bagi porsi; simpan sebagian sebagai stok food prep.',
  ],
  dadar: [
    'Kocok telur dengan bumbu.',
    'Panaskan sedikit minyak, tuang telur, masak sampai matang di kedua sisi.',
  ],
  tanak: [
    'Cuci beras, masukkan bumbu dan lemak sesuai resep.',
    'Masak dengan rice cooker/akhirnya sampai matang. Aduk, sajikan hangat.',
  ],
  lainnya: ['Siapkan bahan.', 'Masak sampai matang sempurna.', 'Sajikan dan simpan sisa dengan aman.'],
};

type Base = Pick<Recipe, 'id' | 'name' | 'category' | 'protein' | 'serves' | 'ingredients'>;

export function R(b: Base & Partial<Recipe>): Recipe {
  const method: Method = b.method ?? 'lainnya';
  return {
    role: 'lauk',
    bumbu: [],
    method,
    isFried: method === 'goreng',
    spice: 'none',
    ironRich: false,
    weekendOk: true,
    prepAhead: true,
    prepMin: 10,
    cookMin: 25,
    steps: b.steps ?? DEFAULT_STEPS[method],
    youtubeQuery: `resep ${b.name.toLowerCase()}`,
    favorite: false,
    ...b,
  } as Recipe;
}
