import { Lock, Pencil, Repeat, Unlock, Youtube } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DayPlan, MealPlan } from '../../types';
import { useApp } from '../../state/AppContext';
import { dayCost } from '../../engine/budget';
import { isWeekend, longDate } from '../../engine/calendar';
import { cookingSessions } from '../../engine/cooking';
import { recipeGluten } from '../../engine/restrictions';
import { toddlerDay } from '../../engine/toddler';
import { validatePlan } from '../../engine/validate';
import { Badge, Btn, Card, Field, GlutenBadge, Sheet, StatusBadge } from './kit';
import { proteinIcon, rn, rp, youtubeSearchUrl } from '../helpers';
import { usePlanActions } from '../planActions';

export default function DayDetail({ plan, day, onReplace }: { plan: MealPlan; day: DayPlan; onReplace: (slot: 'mainA' | 'mainB') => void }) {
  const { ctx, data, save, today } = useApp();
  const { commit } = usePlanActions();
  const [edit, setEdit] = useState(false);
  const weekend = isWeekend(day.date);
  const cost = useMemo(() => dayCost(day, ctx), [day, ctx]);
  const toddler = useMemo(() => toddlerDay(day, ctx), [day, ctx]);
  const sessions = useMemo(() => cookingSessions(day, ctx), [day, ctx]);
  const eggEaten = data.eggLog.find((e) => e.id === day.date)?.eaten ?? 0;
  const A = ctx.recipes.get(day.mainA);
  const B = ctx.recipes.get(day.mainB);

  const row = (label: string, id: string, extra?: string, slot?: 'mainA' | 'mainB') => {
    const r = ctx.recipes.get(id);
    return (
      <li className="flex items-start justify-between gap-2 border-b border-beige/60 py-2 last:border-0">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-charcoal/50">{label}</div>
          <div className="text-sm font-semibold">
            {r ? <Link to={`/dapur/resep/${r.id}`} className="hover:underline">{proteinIcon[r.protein]} {r.name}</Link> : <span className="text-terra-dark">Resep tidak ditemukan</span>}
            {extra && <span className="ml-1 font-normal text-charcoal/60">{extra}</span>}
          </div>
          {r && <div className="mt-1 flex flex-wrap gap-1"><GlutenBadge status={recipeGluten(r, ctx)} />{r.ironRich && <Badge tone="info">Zat besi</Badge>}{r.requiredDish && <Badge tone="ok">Menu wajib</Badge>}{r.spice === 'hot' && <Badge tone="warn">Pedas (anak: tanpa cabai)</Badge>}</div>}
        </div>
        <div className="flex shrink-0 gap-1">
          {r && <a aria-label={`Tutorial ${r.name}`} className="btn btn-ghost btn-sm" href={youtubeSearchUrl(data.recipeQueries.find((q) => q.id === r.id)?.query ?? r.youtubeQuery)} target="_blank" rel="noreferrer"><Youtube size={14} /></a>}
          {slot && !day.locked && <Btn size="sm" variant="ghost" aria-label="Ganti menu" onClick={() => onReplace(slot)}><Repeat size={14} /></Btn>}
        </div>
      </li>
    );
  };

  const toggleLock = async () => commit({ ...plan, days: plan.days.map((d) => (d.date === day.date ? { ...d, locked: !d.locked } : d)) }, day.locked ? 'Menu dibuka' : 'Menu dikunci');

  return (
    <Card
      title={longDate(day.date)}
      action={<div className="flex items-center gap-1.5">{weekend && <Badge tone="info">Weekend • 1 sesi</Badge>}<Btn size="sm" variant="ghost" onClick={toggleLock} aria-label={day.locked ? 'Buka kunci' : 'Kunci menu'}>{day.locked ? <Lock size={14} /> : <Unlock size={14} />}</Btn></div>}
    >
      <ul>
        <li className="flex items-center justify-between border-b border-beige/60 py-2">
          <div><div className="text-[11px] font-semibold uppercase tracking-wide text-charcoal/50">Sarapan ibu (pribadi)</div><div className="text-sm font-semibold">🥚 {ctx.prefs.motherBreakfastEggs} telur ceplok matang</div></div>
          <label className="flex items-center gap-1 text-xs">Dimakan
            <input aria-label="Telur dimakan" type="number" min={0} max={6} className="input !min-h-0 !w-14 !py-1" value={eggEaten} onChange={(e) => void save('eggLog', { id: day.date, eaten: Math.max(0, Number(e.target.value) || 0) })} />
          </label>
        </li>
        {row(weekend ? 'Lauk A — sarapan & makan siang (ayah, anak, ibu siang)' : 'Lauk pagi/siang anak', day.mainA, undefined, 'mainA')}
        {!weekend && (
          <li className="border-b border-beige/60 py-2 text-sm"><div className="text-[11px] font-semibold uppercase tracking-wide text-charcoal/50">Makan siang ibu</div>
            <b>{day.motherLunch.mode === 'follow' ? `Ikut lauk anak (${rn(ctx, day.mainA)})` : `${rn(ctx, day.motherLunch.recipeId ?? 'ayam-suwir')} — alternatif dari food prep`}</b></li>
        )}
        {row(weekend ? 'Lauk B — makan malam keluarga' : 'Lauk makan malam keluarga', day.mainB, undefined, 'mainB')}
        {row('Sayur (satu masakan, dipakai lagi malam hari)', day.veg)}
        {row('Nasi anak', day.rice, day.riceNote)}
        {day.sides.map((s) => <li key={s} className="border-b border-beige/60 py-2 text-sm"><span className="text-[11px] font-semibold uppercase tracking-wide text-charcoal/50">Pendamping dewasa</span><br /><b>{rn(ctx, s)}</b></li>)}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone="muted">Estimasi bahan ±{rp(cost.cost)}{cost.unknown ? ' (ada harga kosong)' : ''}</Badge>
        <StatusBadge status={toddler.status} />
        {B?.protein === 'sapi' || A?.protein === 'sapi' ? <Badge tone="info">🥩 Daging sapi</Badge> : null}
        <Badge>{sessions.map((s) => `${s.title} ±${s.minutes}m`).join(' • ')}</Badge>
      </div>
      {day.note && <p className="mt-2 rounded-xl bg-cream p-2 text-xs text-charcoal/70">{day.note}</p>}
      <div className="no-print mt-3 flex gap-2">
        <Btn variant="soft" className="flex-1" disabled={day.locked} onClick={() => setEdit(true)}><Pencil size={14} /> Edit menu</Btn>
        <Link className="btn btn-ghost flex-1" to={`/dapur/masak?date=${day.date}`}>Mulai masak</Link>
      </div>
      {today === day.date && <p className="mt-2 text-xs text-sage-dark">Ini menu hari ini.</p>}
      <EditSheet open={edit} onClose={() => setEdit(false)} plan={plan} day={day} />
    </Card>
  );
}

function EditSheet({ open, onClose, plan, day }: { open: boolean; onClose: () => void; plan: MealPlan; day: DayPlan }) {
  const { ctx, data } = useApp();
  const { commit } = usePlanActions();
  const [draft, setDraft] = useState<DayPlan>(day);
  const all = [...ctx.recipes.values()];
  const lauk = all.filter((r) => r.role === 'lauk' || r.id === 'telur-ceplok');
  const sayur = all.filter((r) => r.role === 'sayur');
  const nasi = all.filter((r) => r.role === 'nasi');
  const side = all.filter((r) => r.role === 'pendamping' && r.category === 'tahu_tempe');
  const baseline = useMemo(() => new Set(validatePlan(plan.days, ctx, { history: data.seafood }).issues.filter((i) => i.severity === 'error').map((i) => i.message)), [plan, ctx, data.seafood]);
  const trial = useMemo(() => validatePlan(plan.days.map((d) => (d.date === day.date ? draft : d)), ctx, { history: data.seafood }), [plan, draft, day.date, ctx, data.seafood]);
  const fresh = trial.issues.filter((i) => i.severity === 'error' && !baseline.has(i.message));
  const warns = trial.issues.filter((i) => i.severity === 'warning' && i.date === day.date);
  const sel = (v: string, on: (v: string) => void, list: typeof all) => (
    <select className="input" value={v} onChange={(e) => on(e.target.value)}>{list.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
  );
  const weekend = isWeekend(day.date);
  return (
    <Sheet open={open} onClose={onClose} title={`Edit menu — ${longDate(day.date)}`}>
      <div className="space-y-3">
        <Field label={weekend ? 'Lauk A (sarapan & siang)' : 'Lauk pagi/siang anak'}>{sel(draft.mainA, (v) => setDraft({ ...draft, mainA: v }), lauk)}</Field>
        <Field label={weekend ? 'Lauk B (malam)' : 'Lauk makan malam'}>{sel(draft.mainB, (v) => setDraft({ ...draft, mainB: v }), lauk)}</Field>
        <Field label="Sayur harian">{sel(draft.veg, (v) => setDraft({ ...draft, veg: v }), sayur)}</Field>
        <Field label="Nasi anak">{sel(draft.rice, (v) => setDraft({ ...draft, rice: v }), nasi)}</Field>
        {!weekend && (
          <Field label="Makan siang ibu">
            <select className="input" value={draft.motherLunch.mode === 'follow' ? 'follow' : draft.motherLunch.recipeId ?? 'ayam-suwir'} onChange={(e) => setDraft({ ...draft, motherLunch: e.target.value === 'follow' ? { mode: 'follow' } : { mode: 'alt', recipeId: e.target.value } })}>
              <option value="follow">Ikut lauk anak</option>
              {lauk.filter((r) => ['ayam', 'ikan', 'telur'].includes(r.category)).map((r) => <option key={r.id} value={r.id}>Alternatif: {r.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Tahu/tempe pendamping (dewasa)">
          <select className="input" value={draft.sides[0] ?? ''} onChange={(e) => setDraft({ ...draft, sides: e.target.value ? [e.target.value] : [] })}><option value="">Tidak ada</option>{side.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        </Field>
        <Field label="Catatan"><input className="input" value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
        {fresh.length > 0 && <div className="rounded-xl bg-terra-light p-3 text-sm text-terra-dark"><b>Tidak dapat disimpan — melanggar aturan:</b><ul className="mt-1 list-disc pl-5">{fresh.map((i, k) => <li key={k}>{i.message}</li>)}</ul></div>}
        {warns.length > 0 && <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><b>Perlu dicek:</b><ul className="mt-1 list-disc pl-5">{warns.map((i, k) => <li key={k}>{i.message}</li>)}</ul></div>}
        <Btn className="w-full" disabled={fresh.length > 0} onClick={async () => { await commit({ ...plan, source: plan.source === 'seed' ? 'manual' : plan.source, days: plan.days.map((d) => (d.date === day.date ? draft : d)) }); onClose(); }}>Simpan perubahan</Btn>
      </div>
    </Sheet>
  );
}
