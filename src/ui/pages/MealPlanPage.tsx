import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDaysStr, dayName, groupByWeek, shortDate } from '../../engine/calendar';
import { useApp } from '../../state/AppContext';
import DayDetail from '../components/DayDetail';
import GenerateSheet from '../components/GenerateSheet';
import ReplaceSheet from '../components/ReplaceSheet';
import ValidationPanel from '../components/ValidationPanel';
import { Btn, Card, Empty, PageHeader, Tabs } from '../components/kit';
import { proteinIcon, useFocus } from '../helpers';

type View = 'hari' | 'minggu' | 'bulan' | 'validasi';

export default function MealPlanPage() {
  const { plan, ctx, data, today } = useApp();
  const focus = useFocus();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>('hari');
  const [date, setDate] = useState(focus.date);
  const [gen, setGen] = useState(false);
  const [rep, setRep] = useState<{ date: string; slot: 'mainA' | 'mainB' } | null>(null);

  useEffect(() => {
    if (params.get('generate')) { setGen(true); params.delete('generate'); setParams(params, { replace: true }); }
  }, [params, setParams]);
  useEffect(() => { if (plan && !plan.days.some((d) => d.date === date)) setDate(focus.date); }, [plan, date, focus.date]);

  const weeks = useMemo(() => (plan ? groupByWeek(plan.days.map((d) => d.date)) : []), [plan]);
  const day = plan?.days.find((d) => d.date === date);
  const weekOf = weeks.find((w) => w.dates.includes(date));

  if (!plan) {
    return (
      <div>
        <PageHeader title="Meal Plan" />
        <Empty title="Belum ada rencana aktif" hint="Buat rencana 30 hari otomatis sesuai aturan keluarga." action={<Btn onClick={() => setGen(true)}>Generate Menu</Btn>} />
        {gen && <GenerateSheet onClose={() => setGen(false)} />}
      </div>
    );
  }

  const cell = (d: string) => {
    const x = plan.days.find((p) => p.date === d);
    if (!x) return null;
    const a = ctx.recipes.get(x.mainA); const b = ctx.recipes.get(x.mainB);
    return (
      <button key={d} type="button" onClick={() => { setDate(d); setView('hari'); }} className={`w-full rounded-xl border p-2 text-left text-xs ${d === today ? 'border-sage bg-sage-light/40' : 'border-beige bg-white'}`}>
        <div className="font-bold">{dayName(d).slice(0, 3)} {d.slice(8)}{x.locked ? ' 🔒' : ''}</div>
        <div className="truncate">{a ? proteinIcon[a.protein] : ''} {a?.name}</div>
        <div className="truncate text-charcoal/60">{b ? proteinIcon[b.protein] : ''} {b?.name}</div>
      </button>
    );
  };

  return (
    <div>
      <PageHeader title="Meal Plan" sub={`${plan.name} · ${data.plans.filter((p) => p.status === 'arsip').length} arsip`} action={<Btn size="sm" onClick={() => setGen(true)}>Generate</Btn>} />
      <Tabs<View> tabs={[{ id: 'hari', label: 'Hari' }, { id: 'minggu', label: 'Minggu' }, { id: 'bulan', label: 'Bulan' }, { id: 'validasi', label: 'Validasi' }]} value={view} onChange={setView} />
      <div className="mt-3 space-y-3">
        {view === 'hari' && day && (
          <>
            <div className="no-print flex items-center justify-between">
              <Btn size="sm" variant="ghost" disabled={date <= plan.start} onClick={() => setDate(addDaysStr(date, -1))}>‹ Kemarin</Btn>
              <input aria-label="Pilih tanggal" type="date" className="input !w-auto" min={plan.start} max={plan.end} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
              <Btn size="sm" variant="ghost" disabled={date >= plan.end} onClick={() => setDate(addDaysStr(date, 1))}>Besok ›</Btn>
            </div>
            <DayDetail plan={plan} day={day} onReplace={(slot) => setRep({ date, slot })} />
          </>
        )}
        {view === 'minggu' && weekOf && (
          <Card title={`Minggu ${shortDate(weekOf.dates[0])} – ${shortDate(weekOf.dates[weekOf.dates.length - 1])}${weekOf.partial ? ' (parsial)' : ''}`}>
            <div className="grid grid-cols-2 gap-2">{weekOf.dates.map(cell)}</div>
            <div className="mt-3 flex justify-between"><Btn size="sm" variant="ghost" onClick={() => setDate(addDaysStr(weekOf.dates[0], -1))} disabled={weekOf.dates[0] <= plan.start}>‹ Minggu lalu</Btn><Btn size="sm" variant="ghost" onClick={() => setDate(addDaysStr(weekOf.dates[weekOf.dates.length - 1], 1))} disabled={weekOf.dates[weekOf.dates.length - 1] >= plan.end}>Minggu depan ›</Btn></div>
          </Card>
        )}
        {view === 'bulan' && weeks.map((w) => (
          <Card key={w.start} title={`${shortDate(w.dates[0])} – ${shortDate(w.dates[w.dates.length - 1])}${w.partial ? ' (parsial)' : ''}`}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{w.dates.map(cell)}</div>
          </Card>
        ))}
        {view === 'validasi' && <ValidationPanel plan={plan} />}
      </div>
      {gen && <GenerateSheet plan={plan} onClose={() => setGen(false)} />}
      {rep && <ReplaceSheet plan={plan} date={rep.date} slot={rep.slot} onClose={() => setRep(null)} />}
    </div>
  );
}
