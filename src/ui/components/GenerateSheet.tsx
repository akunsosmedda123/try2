import { useMemo, useState } from 'react';
import type { GeneratorMode, MealPlan } from '../../types';
import { useApp } from '../../state/AppContext';
import { addDaysStr, eachDate, longDate, shortDate } from '../../engine/calendar';
import { generatePlan, type GenResult } from '../../engine/generator';
import { actualSeafoodEvents } from '../../engine/toddler';
import { Badge, Btn, Field, Sheet } from './kit';
import { usePlanActions } from '../planActions';
import { rp } from '../helpers';

const MODES: { id: GeneratorMode; label: string; hint: string }[] = [
  { id: 'VARIASI_BARU', label: 'Variasi Baru', hint: 'Menu berbeda dari periode sebelumnya, tetap memenuhi semua aturan.' },
  { id: 'PALING_HEMAT', label: 'Paling Hemat', hint: 'Prioritaskan bahan murah tanpa mengurangi porsi anak.' },
  { id: 'MENU_FAVORIT', label: 'Menu Favorit', hint: 'Lebih sering memakai menu favorit anak yang aman.' },
  { id: 'HABISKAN_STOK', label: 'Habiskan Stok', hint: 'Prioritaskan bahan pantry yang sudah dikonfirmasi aman (FEFO).' },
];

export default function GenerateSheet({ plan, onClose, startNext }: { plan?: MealPlan; onClose: () => void; startNext?: boolean }) {
  const { ctx, data, today, saveMany } = useApp();
  const { commit } = usePlanActions();
  const defaultStart = plan ? addDaysStr(plan.end, 1) : today;
  const [start, setStart] = useState(defaultStart);
  const [len, setLen] = useState(30);
  const [mode, setMode] = useState<GeneratorMode>('VARIASI_BARU');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [res, setRes] = useState<GenResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  void startNext;
  const end = addDaysStr(start, len - 1);
  const overlap = plan && start <= plan.end;

  const run = async (nextSeed?: number) => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30));
    const s = nextSeed ?? seed;
    const history = actualSeafoodEvents(data.journal, ctx, data.seafood);
    const prevDays = plan ? plan.days.filter((d) => d.date < start) : [];
    const favorites = data.settings.profile.anak.favorites.filter((f) => ctx.recipes.has(f));
    const out = generatePlan({ ctx, dates: eachDate(start, end), mode, seed: s, pantry: data.pantry, history, prevDays, favorites, today });
    setRes(out);
    setBusy(false);
  };

  const approve = async () => {
    if (!res) return;
    if (!res.feasible && !window.confirm('Rencana ini BELUM memenuhi semua aturan/budget. Tetap simpan sebagai rencana aktif? (Anda bisa mengeditnya.)')) return;
    setSaving(true);
    const id = `plan-${start}-${Date.now().toString(36)}`;
    const next: MealPlan = { id, name: `Menu ${shortDate(start)} – ${shortDate(end)}`, start, end, status: 'aktif', createdAt: new Date().toISOString(), source: 'generator', generatorMode: mode, days: res.days.filter((d) => d.date >= start && d.date <= end) };
    // Rencana lama diarsipkan (tidak dihapus); jika periode baru tumpang tindih, rencana lama tetap utuh sebagai arsip.
    const archived = data.plans.filter((p) => p.status === 'aktif').map((p) => ({ ...p, status: 'arsip' as const }));
    if (archived.length) await saveMany('plans', archived);
    await commit(next, 'Rencana baru disimpan & menjadi aktif');
    setSaving(false);
    onClose();
  };

  const bad = res?.report.issues.filter((i) => i.severity === 'error') ?? [];
  const warn = res?.report.issues.filter((i) => i.severity === 'warning') ?? [];
  const cur = useMemo(() => MODES.find((m) => m.id === mode)!, [mode]);

  return (
    <Sheet open onClose={onClose} title="Generate Menu">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Mulai"><input type="date" className="input" value={start} onChange={(e) => { setStart(e.target.value); setRes(null); }} /></Field>
          <Field label="Jumlah hari"><input type="number" min={7} max={31} className="input" value={len} onChange={(e) => { setLen(Math.min(31, Math.max(7, Number(e.target.value) || 30))); setRes(null); }} /></Field>
        </div>
        <p className="text-xs text-charcoal/60">Periode: {longDate(start)} → {longDate(end)}.</p>
        {overlap && <p className="rounded-xl bg-amber-50 p-2 text-xs text-amber-900">Periode tumpang tindih dengan rencana aktif; rencana lama akan diarsipkan, bukan dihapus.</p>}
        <Field label="Mode" hint={cur.hint}>
          <select className="input" value={mode} onChange={(e) => { setMode(e.target.value as GeneratorMode); setRes(null); }}>{MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
        </Field>
        <Btn className="w-full" disabled={busy} onClick={() => run()}>{busy ? 'Menyusun menu…' : res ? 'Susun ulang (seed sama)' : 'Buat pratinjau'}</Btn>

        {res && (
          <div className="space-y-3" data-testid="gen-preview">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={res.feasible ? 'ok' : 'bad'}>{res.feasible ? 'Memenuhi aturan & budget' : 'NO FULLY FEASIBLE PLAN'}</Badge>
              <Badge tone={res.report.errors ? 'bad' : 'ok'}>{res.report.errors} pelanggaran</Badge>
              <Badge tone={res.report.warnings ? 'warn' : 'ok'}>{res.report.warnings} peringatan</Badge>
              <Badge tone={res.budget.status === 'OK' ? 'ok' : res.budget.status === 'PRICE INCOMPLETE' ? 'warn' : 'bad'}>{res.budget.status}</Badge>
            </div>
            <div className="rounded-xl bg-cream p-3 text-sm">
              <div>Estimasi total belanja: <b>{rp(res.budget.totalEstimate)}</b> dari target {rp(res.budget.totalTarget)}</div>
              <div className="text-xs text-charcoal/60">Rata-rata/minggu {rp(res.budget.average)} · harga adalah ESTIMASI, bukan harga pasar real-time.</div>
            </div>
            <table className="w-full text-xs"><thead><tr className="text-left text-charcoal/60"><th>Minggu</th><th>Estimasi</th><th>Target</th><th /></tr></thead>
              <tbody>{res.budget.weeks.map((w) => <tr key={w.start} className="border-t border-beige"><td className="py-1">{shortDate(w.start)}{w.partial ? ' (parsial)' : ''}</td><td>{rp(w.effective)}</td><td>{rp(w.target)}</td><td>{w.over ? <Badge tone="bad">Lewat</Badge> : <Badge tone="ok">OK</Badge>}</td></tr>)}</tbody></table>
            {bad.length > 0 && <ul className="list-disc rounded-xl bg-terra-light p-3 pl-7 text-xs text-terra-dark">{bad.slice(0, 8).map((i, k) => <li key={k}>{i.message}</li>)}</ul>}
            {res.infeasible && (
              <div className="rounded-xl border border-terra/40 bg-terra-light/50 p-3 text-xs">
                <b>{res.infeasible.title}</b>
                <ul className="mt-1 list-disc pl-5">{res.infeasible.reasons.slice(0, 6).map((r, k) => <li key={k}>{r}</li>)}</ul>
                <b className="mt-2 block">Alternatif:</b><ul className="list-disc pl-5">{res.infeasible.alternatives.map((r, k) => <li key={k}>{r}</li>)}</ul>
                <b className="mt-2 block">Penyesuaian yang perlu persetujuan Anda:</b><ul className="list-disc pl-5">{res.infeasible.adjustments.map((r, k) => <li key={k}>{r}</li>)}</ul>
              </div>
            )}
            {warn.length > 0 && <details className="text-xs"><summary className="cursor-pointer font-semibold">Peringatan ({warn.length})</summary><ul className="list-disc pl-5">{warn.slice(0, 20).map((i, k) => <li key={k}>{i.message}</li>)}</ul></details>}
            {res.optimizerSteps.length > 0 && <details className="text-xs"><summary className="cursor-pointer font-semibold">Langkah Budget Optimizer ({res.optimizerSteps.length})</summary><ul className="list-disc pl-5">{res.optimizerSteps.map((s, k) => <li key={k}>{s}</li>)}</ul></details>}
            <details className="text-xs"><summary className="cursor-pointer font-semibold">Pratinjau menu per hari</summary>
              <ul className="mt-1 space-y-1">{res.days.filter((d) => d.date >= start).map((d) => <li key={d.date}><b>{shortDate(d.date)}</b> · {ctx.recipes.get(d.mainA)?.name} / {ctx.recipes.get(d.mainB)?.name} · {ctx.recipes.get(d.veg)?.name}</li>)}</ul></details>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="ghost" disabled={busy} onClick={() => { const s = Math.floor(Math.random() * 1e6); setSeed(s); void run(s); }}>Variasi lain</Btn>
              <Btn disabled={saving} onClick={approve}>Setujui & simpan</Btn>
            </div>
            <p className="text-[11px] text-charcoal/55">Belum ada yang tersimpan sampai Anda menekan "Setujui & simpan".</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
