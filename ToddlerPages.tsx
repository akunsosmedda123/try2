import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { JournalEntry, MealSlot, PortionEaten } from '../../types';
import { useApp } from '../../state/AppContext';
import { addDaysStr, shortDate, weekStart } from '../../engine/calendar';
import { actualSeafoodEvents, seafoodTracker, toddlerDay, weeklyReview } from '../../engine/toddler';
import { validatePlan } from '../../engine/validate';
import { Badge, Btn, Card, Empty, Field, GlutenBadge, PageHeader, Stat, StatusBadge } from '../components/kit';
import { uid } from '../helpers';

export function ToddlerHub() {
  const items = [['/balita/nutrisi', 'Nutrition', 'Menu anak, zat besi, daging, seafood'], ['/balita/nasi', 'Energy Rice', 'Nasi berenergi padat'], ['/balita/jurnal', 'Food Journal', 'Catat porsi yang dimakan'], ['/balita/tumbuh', 'Growth Tracker', 'Berat & tinggi badan']];
  return (
    <div>
      <PageHeader title="Balita" sub="Info umum, bukan pengganti saran dokter/ahli gizi" />
      <div className="grid grid-cols-2 gap-3">{items.map(([to, t, s]) => <Link key={to} to={to} className="card"><b className="text-sm">{t}</b><p className="text-xs text-charcoal/60">{s}</p></Link>)}</div>
    </div>
  );
}

export function NutritionPage() {
  const { plan, ctx, data, today } = useApp();
  const history = useMemo(() => actualSeafoodEvents(data.journal, ctx, data.seafood), [data, ctx]);
  const week = useMemo(() => weekStart(today), [today]);
  const review = useMemo(() => weeklyReview(data.journal, ctx, week), [data.journal, ctx, week]);
  if (!plan) return <Empty title="Belum ada rencana" />;
  const days = plan.days.filter((d) => d.date >= week && d.date <= addDaysStr(week, 6));
  const rep = validatePlan(days, ctx, { history });
  const sea = seafoodTracker(history, plan.days, ctx, today);
  const p = data.settings.profile.anak;
  return (
    <div className="space-y-3">
      <PageHeader title="Nutrition" sub={`${p.name} · gluten-free · tidak pedas`} />
      <Card title="Menu terencana minggu ini">
        <ul className="space-y-2 text-sm">{days.map((d) => {
          const t = toddlerDay(d, ctx);
          return <li key={d.date} className="border-b border-beige/60 pb-2 last:border-0"><div className="flex items-center justify-between"><b>{shortDate(d.date)}</b><StatusBadge status={t.status} /></div>
            <div className="text-xs text-charcoal/70">{t.meals.map((m) => m.lauk).filter((x, i, a) => a.indexOf(x) === i).join(' · ')} · {t.veg} · {t.rice}</div>
            <div className="mt-1 flex flex-wrap gap-1"><GlutenBadge status={t.gluten} />{t.ironRich && <Badge tone="info">Zat besi</Badge>}{t.beef && <Badge tone="info">Sapi</Badge>}{t.seafood && <Badge tone="info">{t.seafood}</Badge>}</div></li>;
        })}</ul>
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Zat besi minggu ini" value={rep.weeks.some((w) => w.ironRich) ? 'Ada ✓' : 'Belum'} />
        <Stat label="Seafood" value={sea.status} sub={sea.lastDate ? `Terakhir ${shortDate(sea.lastDate)}` : 'Belum ada catatan dimakan'} />
      </div>
      <Card title="Ulasan jurnal minggu ini">
        {review.entries === 0 ? <p className="text-sm text-charcoal/60">Belum ada catatan jurnal.</p> : (
          <ul className="text-sm"><li>{review.entries} catatan · rata-rata habis {Math.round(review.avgEaten * 100)}%</li><li>Protein: {review.proteins.join(', ') || '—'}</li><li>Sapi {review.beef}× · seafood {review.seafood}×</li>{review.leftovers.length > 0 && <li>Sering sisa: {review.leftovers.join(', ')}</li>}</ul>
        )}
      </Card>
      <p className="rounded-xl bg-cream p-3 text-xs text-charcoal/65">Alergi gluten dan riwayat seafood: pastikan label bebas gluten dan konsultasikan ke dokter. Aplikasi tidak memberi diagnosis, angka kalori, atau klaim medis.</p>
    </div>
  );
}

export function RicePage() {
  const { ctx } = useApp();
  const rice = [...ctx.recipes.values()].filter((r) => r.role === 'nasi');
  return (
    <div className="space-y-3">
      <PageHeader title="Energy Rice" sub="Variasi nasi padat energi untuk anak" />
      {rice.map((r) => (
        <Card key={r.id} title={r.name}>
          <p className="text-xs text-charcoal/60">{r.note}</p>
          <ul className="mt-1 text-sm">{r.ingredients.map((i, k) => <li key={k}>{ctx.ingredients.get(i.ingredientId)?.name} {i.amount} {ctx.ingredients.get(i.ingredientId)?.unit}</li>)}</ul>
          <div className="mt-1 flex gap-1"><GlutenBadge status={'SAFE'} /><Link className="text-xs underline" to={`/dapur/resep/${r.id}`}>Detail & langkah</Link></div>
        </Card>
      ))}
      <p className="text-xs text-charcoal/60">Tidak menampilkan angka kalori karena bergantung pada bahan dan ukuran porsi aktual.</p>
    </div>
  );
}

const PORTIONS: PortionEaten[] = ['habis', '3/4', '1/2', '1/4', 'tidak'];
export function JournalPage() {
  const { ctx, data, today, save, remove } = useApp();
  const [f, setF] = useState<Omit<JournalEntry, 'id'>>({ date: today, slot: 'siang', menu: '', recipeId: undefined, served: 'habis', eaten: 'habis', protein: '', veg: '', rice: '', extraFat: '', tasteNote: '', textureNote: '' });
  const lauk = [...ctx.recipes.values()].filter((r) => r.role === 'lauk');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const entries = [...data.journal].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
  return (
    <div className="space-y-3">
      <PageHeader title="Food Journal" sub="Yang dicatat di sini dihitung sebagai 'dimakan'" />
      <Card title="Catat makan">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tanggal"><input type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
          <Field label="Waktu"><select className="input" value={f.slot} onChange={(e) => set('slot', e.target.value as MealSlot | 'camilan')}>{['sarapan', 'siang', 'malam', 'camilan'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        </div>
        <div className="mt-2 space-y-2">
          <Field label="Lauk"><select className="input" value={f.recipeId ?? ''} onChange={(e) => { const r = ctx.recipes.get(e.target.value); setF((x) => ({ ...x, recipeId: e.target.value || undefined, menu: r?.name ?? x.menu, protein: r && r.protein !== 'none' ? r.protein : x.protein })); }}><option value="">— tulis sendiri —</option>{lauk.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
          <Field label="Nama menu"><input className="input" value={f.menu} onChange={(e) => set('menu', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Disajikan"><select className="input" value={f.served} onChange={(e) => set('served', e.target.value as PortionEaten)}>{PORTIONS.map((p) => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Dimakan"><select aria-label="Dimakan" className="input" value={f.eaten} onChange={(e) => set('eaten', e.target.value as PortionEaten)}>{PORTIONS.map((p) => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Sayur"><input className="input" value={f.veg} onChange={(e) => set('veg', e.target.value)} /></Field>
            <Field label="Nasi"><input className="input" value={f.rice} onChange={(e) => set('rice', e.target.value)} /></Field>
          </div>
          <Field label="Lemak tambahan"><input className="input" value={f.extraFat} onChange={(e) => set('extraFat', e.target.value)} /></Field>
          <Field label="Catatan rasa / tekstur"><input className="input" value={f.tasteNote} onChange={(e) => set('tasteNote', e.target.value)} /></Field>
        </div>
        <Btn className="mt-3 w-full" disabled={!f.menu.trim()} onClick={async () => { await save('journal', { ...f, id: uid('j'), menu: f.menu.trim() }); setF({ ...f, menu: '', recipeId: undefined, tasteNote: '' }); }}>Simpan catatan</Btn>
      </Card>
      <Card title="Riwayat">
        {entries.length === 0 ? <p className="text-sm text-charcoal/60">Belum ada.</p> : <ul className="divide-y divide-beige/60 text-sm">{entries.map((e) => <li key={e.id} className="flex items-center justify-between gap-2 py-1.5"><span>{shortDate(e.date)} · {e.slot} · <b>{e.menu}</b> · {e.eaten}</span><Btn size="sm" variant="ghost" onClick={() => remove('journal', e.id)}>Hapus</Btn></li>)}</ul>}
      </Card>
    </div>
  );
}

export function GrowthPage() {
  const { data, today, save, remove } = useApp();
  const [date, setDate] = useState(today);
  const [w, setW] = useState('');
  const [h, setH] = useState('');
  const [note, setNote] = useState('');
  const rows = [...data.growth].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="space-y-3">
      <PageHeader title="Growth Tracker" sub="Hanya mencatat; tanpa kurva/diagnosis" />
      <Card title="Catat">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Tanggal"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Berat (kg)"><input aria-label="Berat" type="number" step="0.1" className="input" value={w} onChange={(e) => setW(e.target.value)} /></Field>
          <Field label="Tinggi (cm)"><input aria-label="Tinggi" type="number" step="0.1" className="input" value={h} onChange={(e) => setH(e.target.value)} /></Field>
        </div>
        <Field label="Catatan dokter"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Btn className="mt-2 w-full" disabled={!w && !h} onClick={async () => { await save('growth', { id: uid('gr'), date, weightKg: w ? Number(w) : null, heightCm: h ? Number(h) : null, doctorNote: note }); setW(''); setH(''); setNote(''); }}>Simpan</Btn>
      </Card>
      {rows.length >= 2 ? (
        <Card title="Grafik">
          <div className="h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows.map((r) => ({ d: shortDate(r.date), kg: r.weightKg, cm: r.heightCm }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="d" fontSize={11} /><YAxis yAxisId="l" fontSize={11} /><YAxis yAxisId="r" orientation="right" fontSize={11} /><Tooltip /><Line yAxisId="l" type="monotone" dataKey="kg" name="Berat (kg)" stroke="#7A9278" connectNulls /><Line yAxisId="r" type="monotone" dataKey="cm" name="Tinggi (cm)" stroke="#C88469" connectNulls /></LineChart></ResponsiveContainer></div>
          <p className="mt-1 text-[11px] text-charcoal/55">Tidak ada data standar WHO yang dimasukkan; bandingkan dengan kurva resmi bersama tenaga kesehatan.</p>
        </Card>
      ) : <Empty title="Grafik muncul setelah 2 pencatatan" />}
      <Card title="Riwayat">
        <ul className="divide-y divide-beige/60 text-sm">{[...rows].reverse().map((r) => <li key={r.id} className="flex items-center justify-between py-1.5"><span>{shortDate(r.date)} · {r.weightKg ?? '—'} kg · {r.heightCm ?? '—'} cm{r.doctorNote ? ` · ${r.doctorNote}` : ''}</span><Btn size="sm" variant="ghost" onClick={() => remove('growth', r.id)}>Hapus</Btn></li>)}</ul>
      </Card>
    </div>
  );
}
