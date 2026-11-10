import { useMemo, useState } from 'react';
import type { MealPlan } from '../../types';
import { useApp } from '../../state/AppContext';
import { addDaysStr, longDate, weekStart } from '../../engine/calendar';
import { generatePlan, suggestReplacements } from '../../engine/generator';
import { Badge, Btn, Sheet } from './kit';
import { rp } from '../helpers';
import { usePlanActions } from '../planActions';

export default function ReplaceSheet({ plan, date, slot, onClose }: { plan: MealPlan; date: string; slot: 'mainA' | 'mainB'; onClose: () => void }) {
  const { ctx, data, today } = useApp();
  const { commit } = usePlanActions();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const options = useMemo(() => suggestReplacements(plan.days, date, slot, ctx, { pantry: data.pantry, history: data.seafood, seed: 7 }).slice(0, 14), [plan, date, slot, ctx, data.pantry, data.seafood]);

  const replaceMeal = async (id: string) => {
    await commit({ ...plan, source: plan.source === 'seed' ? 'manual' : plan.source, days: plan.days.map((d) => (d.date === date ? { ...d, [slot]: id } : d)) }, 'Menu diganti');
    onClose();
  };

  // Replace This Day / Regenerate This Week: planner dijalankan hanya untuk tanggal terkait, hari lain dipertahankan.
  const regen = async (dates: string[], label: string) => {
    setBusy(true);
    setMsg('');
    await new Promise((r) => setTimeout(r, 30));
    const target = dates.filter((d) => plan.days.some((x) => x.date === d && !x.locked));
    const fixed = plan.days.filter((d) => !target.includes(d.date));
    const res = generatePlan({ ctx, dates: target, fixed, mode: 'VARIASI_BARU', seed: Math.floor(Math.random() * 1e6), pantry: data.pantry, history: data.seafood, today });
    const merged = res.days.filter((d) => plan.days.some((x) => x.date === d.date));
    const hardErrors = res.report.errors;
    if (hardErrors > 0 && !window.confirm(`Hasil ${label} masih memiliki ${hardErrors} pelanggaran aturan. Tetap simpan?`)) { setBusy(false); setMsg('Dibatalkan. Coba lagi untuk hasil lain.'); return; }
    await commit({ ...plan, source: 'manual', days: merged }, `${label} selesai`);
    setBusy(false);
    onClose();
  };

  const week = Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart(date), i)).filter((d) => plan.days.some((x) => x.date === d));
  return (
    <Sheet open onClose={onClose} title={`Ganti menu — ${longDate(date)} (${slot === 'mainA' ? 'lauk A/pagi-siang' : 'lauk malam'})`}>
      <p className="mb-2 text-xs text-charcoal/60">Alternatif sudah disaring: alergi, pantangan, porsi, dan jadwal masak. Biaya = estimasi linear bahan dalam budget.</p>
      <ul className="space-y-2">
        {options.map((o) => (
          <li key={o.recipeId} className="flex items-center justify-between gap-2 rounded-xl border border-beige bg-white p-2.5">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{o.name}</div>
              <div className="text-xs text-charcoal/60">Awal {rp(o.originalCost)} → baru {rp(o.newCost)} · <b className={o.diff > 0 ? 'text-terra-dark' : 'text-sage-dark'}>{o.diff > 0 ? '+' : ''}{rp(o.diff)}</b></div>
              {o.errors > 0 && <Badge tone="bad">Melanggar: {o.newIssues[0]?.slice(0, 70)}</Badge>}
            </div>
            <Btn size="sm" variant="soft" disabled={o.errors > 0} onClick={() => replaceMeal(o.recipeId)}>Pilih</Btn>
          </li>
        ))}
        {options.length === 0 && <li className="text-sm text-charcoal/60">Tidak ada alternatif yang memenuhi aturan.</li>}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Btn variant="ghost" disabled={busy} onClick={() => regen([date], 'Ganti hari ini')}>Replace This Day</Btn>
        <Btn variant="ghost" disabled={busy} onClick={() => regen(week, 'Regenerate minggu ini')}>Regenerate This Week</Btn>
      </div>
      {busy && <p className="mt-2 text-sm text-charcoal/60">Menyusun ulang…</p>}
      {msg && <p className="mt-2 text-sm text-terra-dark">{msg}</p>}
    </Sheet>
  );
}
