import { useMemo } from 'react';
import type { MealPlan } from '../../types';
import { useApp } from '../../state/AppContext';
import { budgetReport } from '../../engine/budget';
import { shortDate } from '../../engine/calendar';
import { actualSeafoodEvents, seafoodTracker } from '../../engine/toddler';
import { eggTracker, validatePlan } from '../../engine/validate';
import { Badge, Card, Progress } from './kit';
import { rp } from '../helpers';

const Y = ({ ok }: { ok: boolean }) => <span className={ok ? 'text-sage-dark' : 'text-terra-dark'}>{ok ? '✓' : '✗'}</span>;

export default function ValidationPanel({ plan }: { plan: MealPlan }) {
  const { ctx, data, today } = useApp();
  const history = useMemo(() => actualSeafoodEvents(data.journal, ctx, data.seafood), [data.journal, data.seafood, ctx]);
  const rep = useMemo(() => validatePlan(plan.days, ctx, { history }), [plan, ctx, history]);
  const bud = useMemo(() => budgetReport(plan.days, ctx, data.pantry, today), [plan, ctx, data.pantry, today]);
  const eaten = useMemo(() => Object.fromEntries(data.eggLog.map((e) => [e.id, e.eaten])), [data.eggLog]);
  const egg = useMemo(() => eggTracker(plan.days, ctx, eaten), [plan, ctx, eaten]);
  const sea = useMemo(() => seafoodTracker(history, plan.days, ctx, today), [history, plan, ctx, today]);
  const errs = rep.issues.filter((i) => i.severity === 'error');
  const warns = rep.issues.filter((i) => i.severity === 'warning');
  const seaTone = sea.status === 'OVERDUE' ? 'bad' : sea.status === 'DUE SOON' ? 'warn' : sea.status === 'NO HISTORY' ? 'muted' : 'ok';

  return (
    <div className="space-y-4">
      <Card title="Ringkasan validasi">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={rep.ok ? 'ok' : 'bad'}>{rep.ok ? 'Tidak ada pelanggaran aturan' : `${rep.errors} pelanggaran`}</Badge>
          <Badge tone={rep.warnings ? 'warn' : 'ok'}>{rep.warnings} perlu verifikasi/peringatan</Badge>
        </div>
        {errs.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-terra-dark">{errs.map((i, k) => <li key={k}>{i.message}</li>)}</ul>}
        {warns.length > 0 && <details className="mt-2 text-sm"><summary className="cursor-pointer font-semibold">Lihat peringatan ({warns.length})</summary><ul className="mt-1 list-disc pl-5 text-xs text-charcoal/75">{warns.map((i, k) => <li key={k}>{i.message}</li>)}</ul></details>}
      </Card>

      <Card title="Menu wajib bulanan">
        <ul className="space-y-1 text-sm">{rep.required.map((r) => <li key={r.id} className="flex justify-between gap-2"><span><Y ok={r.ok} /> {r.label}</span><span className="text-charcoal/60">{r.count}/{r.min}{r.dates.length ? ` · ${r.dates.map(shortDate).join(', ')}` : ''}</span></li>)}</ul>
      </Card>

      <Card title="Checklist mingguan (Senin–Minggu)">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-charcoal/60"><th className="py-1">Minggu</th><th>Ayam</th><th>Telur</th><th>Ikan</th><th>Zat besi</th><th>Hati anak</th></tr></thead>
            <tbody>{rep.weeks.map((w) => (
              <tr key={w.start} className="border-t border-beige">
                <td className="py-1">{shortDate(w.start)}{w.partial ? ' (parsial)' : ''}</td>
                <td><Y ok={w.ayam} /></td><td><Y ok={w.telurIbu || w.telurLain} /></td><td><Y ok={w.ikan} /></td><td><Y ok={w.ironRich} /></td><td>{w.hatiAnak}</td>
              </tr>))}</tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-charcoal/55">Minggu parsial dinilai proporsional; ✗ pada minggu parsial belum tentu pelanggaran.</p>
      </Card>

      <Card title="Daging sapi anak">
        <p className="text-sm"><b>{rep.sapiAnakDates.length}</b> kali untuk anak (target ≥ 2 per siklus){rep.sapiAnakDates.length < 2 ? <Badge tone="bad" className="ml-2">Kurang</Badge> : <Badge tone="ok" className="ml-2">Terpenuhi</Badge>}</p>
        <p className="text-xs text-charcoal/60">{rep.sapiAnakDates.map(shortDate).join(', ') || '—'}</p>
      </Card>

      <Card title="Udang / cumi anak (maks. 14 hari sekali)">
        <div className="flex flex-wrap items-center gap-2 text-sm"><Badge tone={seaTone}>{sea.status}</Badge>
          {sea.lastDate && <span>Terakhir {shortDate(sea.lastDate)} ({sea.lastType}) · jatuh tempo {sea.nextDue ? shortDate(sea.nextDue) : '—'}</span>}</div>
        <p className="mt-1 text-xs text-charcoal/60">Menu terjadwal: {sea.plannedNext ? `${sea.plannedNext.type} pada ${shortDate(sea.plannedNext.date)}` : 'belum ada'}. Yang dihitung "dimakan" hanya dari Food Journal / catatan manual.</p>
        {!data.settings.profile.seafoodKnownSafe.udang && <p className="mt-1 text-xs text-amber-800">Udang belum ditandai aman untuk anak (alergi/riwayat) — verifikasi dulu di Pengaturan.</p>}
      </Card>

      <Card title="Telur ibu">
        <p className="text-sm">Sarapan: <b>{egg.breakfast}</b> · tambahan dari menu keluarga: <b>{egg.extra}</b> · total terencana <b>{egg.planned}</b> · tercatat dimakan <b>{egg.actual}</b></p>
        <p className="text-xs text-charcoal/60">Aturan: 1 telur ceplok tiap sarapan (bukan 2/hari).</p>
      </Card>

      <Card title="Budget (estimasi)">
        <div className="mb-2 flex flex-wrap gap-1.5"><Badge tone={bud.status === 'OK' ? 'ok' : bud.status === 'PRICE INCOMPLETE' ? 'warn' : 'bad'}>{bud.status}</Badge><Badge>{bud.strategy === 'FIXED_WEEKLY' ? 'Tetap per minggu' : 'Rata-rata bulanan'}</Badge></div>
        <ul className="space-y-2 text-sm">{bud.weeks.map((w) => (
          <li key={w.start}>
            <div className="flex justify-between"><span>{shortDate(w.start)}{w.partial ? ' (parsial)' : ''}</span><span className={w.over ? 'font-bold text-terra-dark' : ''}>{rp(w.effective)} / {rp(w.target)}</span></div>
            <Progress value={w.effective} max={w.target} tone={w.over ? 'bad' : w.effective > w.target * 0.9 ? 'warn' : 'ok'} />
            {w.unknownPriceItems.length > 0 && <p className="text-[11px] text-amber-800">Harga kosong: {w.unknownPriceItems.join(', ')}</p>}
          </li>))}</ul>
        <p className="mt-2 text-[11px] text-charcoal/55">Beras, minyak, bumbu, kecap, tepung dll. tidak dihitung. Harga = estimasi pengembang yang bisa Anda ubah di Pengaturan.</p>
      </Card>
    </div>
  );
}
