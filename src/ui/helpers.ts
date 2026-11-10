import { useMemo } from 'react';
import type { DayPlan, ProteinType } from '../types';
import type { Ctx } from '../engine/context';
import { rupiah } from '../engine/units';
import { useApp } from '../state/AppContext';

/** Format Rupiah singkat untuk UI. */
export const rp = (n: number | null | undefined): string => rupiah(n);

/** Nama resep dari id (fallback ke id bila tidak ditemukan). */
export const rn = (ctx: Ctx, id: string | null | undefined): string =>
  id ? ctx.recipes.get(id)?.name ?? id : '—';

export const proteinIcon: Record<ProteinType, string> = {
  ayam: '🍗',
  telur: '🥚',
  ikan: '🐟',
  sapi: '🥩',
  hati: '🫀',
  udang: '🦐',
  cumi: '🦑',
  tahu_tempe: '🟫',
  none: '🥬',
};

/** Id unik lokal dengan prefiks. */
export function uid(prefix = 'id'): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}

export const youtubeSearchUrl = (query: string): string =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

/** Unduh teks sebagai file (tanpa server). */
export function downloadText(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Hari fokus: hari ini bila ada di rencana aktif, jika tidak hari pertama rencana. */
export function useFocus(): { date: string; day: DayPlan | undefined; inPlan: boolean } {
  const { plan, today } = useApp();
  return useMemo(() => {
    const todayDay = plan?.days.find((d) => d.date === today);
    if (todayDay) return { date: today, day: todayDay, inPlan: true };
    const first = plan?.days[0];
    return { date: first?.date ?? today, day: first, inPlan: false };
  }, [plan, today]);
}
