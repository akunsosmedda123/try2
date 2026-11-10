import type { Ingredient } from '../types';

export type InputUnit = 'g' | 'kg' | 'ons' | 'ml' | 'l' | 'pcs';

/** Konversi ke unit dasar bahan (g / ml / pcs). Mengembalikan null bila konversi tidak diketahui. */
export function toBase(qty: number, unit: InputUnit, ing?: Pick<Ingredient, 'unit' | 'gramsPerPcs'>): number | null {
  const base = ing?.unit;
  let v: number;
  switch (unit) {
    case 'kg': v = qty * 1000; unit = 'g'; break;
    case 'ons': v = qty * 100; unit = 'g'; break;
    case 'l': v = qty * 1000; unit = 'ml'; break;
    default: v = qty;
  }
  if (!base) return v;
  if (unit === base) return v;
  if (unit === 'pcs' && base === 'g') return ing?.gramsPerPcs ? v * ing.gramsPerPcs : null;
  if (unit === 'g' && base === 'pcs') return ing?.gramsPerPcs ? v / ing.gramsPerPcs : null;
  return null;
}

export function roundUpToPack(qty: number, packSize: number): { qty: number; packs: number } {
  if (qty <= 1e-9) return { qty: 0, packs: 0 };
  const packs = Math.ceil(qty / packSize - 1e-9);
  return { qty: packs * packSize, packs };
}

export function fmtQty(qty: number, unit: string): string {
  if (unit === 'g' && qty >= 1000) return `${(qty / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg`;
  if (unit === 'ml' && qty >= 1000) return `${(qty / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} l`;
  const r = Math.round(qty * 10) / 10;
  return `${r.toLocaleString('id-ID')} ${unit}`;
}

export const rupiah = (n: number | null | undefined): string =>
  n === null || n === undefined ? 'harga kosong' : 'Rp' + Math.round(n).toLocaleString('id-ID');
