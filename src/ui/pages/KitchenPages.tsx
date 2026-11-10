import { ChefHat, ClipboardList, Flame, Package, Refrigerator, Search, Soup } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { PantryItem } from '../../types';
import { useApp } from '../../state/AppContext';
import { buildSampleStock } from '../../data/seed';
import { addDaysStr, groupByWeek, shortDate, weekStart } from '../../engine/calendar';
import { bumbuNeeds, newBatchFromLabel, prepChecklist } from '../../engine/bumbu';
import { cookingSessions, foodPrepTasks, prepContainers, suggestedOrder } from '../../engine/cooking';
import { consumeStock, defaultUseBy, expired, expiringSoon, fefo, isUsable } from '../../engine/pantry';
import { recipeRequirement } from '../../engine/requirements';
import { servingsForDay } from '../../engine/portions';
import { fmtQty } from '../../engine/units';
import { Badge, Btn, Card, Empty, Field, PageHeader, Sheet } from '../components/kit';
import { uid } from '../helpers';

export function KitchenHub() {
  const items = [
    { to: '/dapur/resep', icon: <Soup />, label: 'Recipe Library', sub: 'Resep, status aman, tutorial YouTube' },
    { to: '/dapur/bumbu', icon: <Flame />, label: 'Smart Bumbu Prep', sub: 'Kebutuhan bumbu dasar & label' },
    { to: '/dapur/prep', icon: <ClipboardList />, label: 'Food Prep', sub: 'Checklist prep mingguan' },
    { to: '/dapur/pantry', icon: <Refrigerator />, label: 'Pantry', sub: 'Stok, FEFO, tanggal pakai' },
    { to: '/dapur/masak-dari-stok', icon: <Search />, label: 'Cook With What I Have', sub: 'Masak dari bahan yang ada' },
    { to: '/dapur/masak', icon: <ChefHat />, label: 'Cooking Assistant', sub: 'Langkah masak hari ini' },
    { to: '/balita', icon: <Soup />, label: 'Balita', sub: 'Nutrition, Energy Rice, Jurnal, Growth' },
  ];
  return (
    <div>
      <PageHeader title="Kitchen" />
      <div className="grid grid-cols-2 gap-3">
        {items.map((i) => (
          <Link key={i.to} to={i.to} className="card flex flex-col gap-1 hover:shadow-soft">
            <span className="text-sage-dark">{i.icon}</span><b className="text-sm">{i.label}</b><span className="text-xs text-charcoal/60">{i.sub}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ================= Smart Bumbu Prep ================= */
export function BumbuPage() {
  const { plan, ctx, data, today, save, remove, toast } = useApp();
  const [days, setDays] = useState(7);
  const [useWithin, setUseWithin] = useState(3);
  const range = useMemo(() => (plan ? plan.days.filter((d) => d.date >= today && d.date <= addDaysStr(today, days - 1)) : []), [plan, today, days]);
  const needs = useMemo(() => bumbuNeeds(range, ctx, data.spice, today), [range, ctx, data.spice, today]);
  const labels = useMemo(() => prepChecklist(needs, today, useWithin), [needs, today, useWithin]);
  if (!plan) return <Empty title="Belum ada rencana" />;
  return (
    <div className="space-y-3">
      <PageHeader title="Smart Bumbu Prep" sub="Dihitung dari takaran resep sebenarnya" />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Untuk berapa hari ke depan"><select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[3, 5, 7, 14].map((n) => <option key={n} value={n}>{n} hari</option>)}</select></Field>
        <Field label="Habis dipakai dalam"><select className="input" value={useWithin} onChange={(e) => setUseWithin(Number(e.target.value))}><option value={3}>≤ 3 hari (kulkas)</option><option value={14}>lebih lama (freezer)</option></select></Field>
      </div>
      {needs.length === 0 && <Empty title="Tidak ada kebutuhan bumbu dasar di rentang ini" />}
      {needs.map((n) => (
        <Card key={n.bumbuId} title={n.label} action={<Badge tone={n.prepGrams > 0 ? 'warn' : 'ok'}>{n.prepGrams > 0 ? `Siapkan ${Math.round(n.prepGrams)} g` : 'Stok cukup'}</Badge>}>
          <p className="text-sm">Butuh {Math.round(n.needGrams)} g · stok {Math.round(n.stockGrams)} g · wadah {n.containers}×100 g</p>
          <ul className="mt-1 text-xs text-charcoal/65">{n.split.map((s) => <li key={s.recipeId}>{s.recipeName}: {Math.round(s.grams)} g</li>)}</ul>
          {n.prepGrams > 0 && <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Bahan mentah untuk membuat</summary><ul className="mt-1 list-disc pl-5">{n.raw.map((r) => <li key={r.ingredientId}>{r.name}: {fmtQty(r.amount, r.unit)}</li>)}</ul></details>}
        </Card>
      ))}
      {labels.length > 0 && (
        <Card title="Checklist & label wadah">
          <ul className="space-y-2 text-sm">{labels.map((l) => (
            <li key={l.bumbuId} className="rounded-xl bg-cream p-2">
              <div className="font-semibold">{l.text}</div>
              <div className="text-xs text-charcoal/60">{l.containers} wadah × ±{l.gramsPerContainer} g</div>
              <Btn size="sm" variant="soft" className="mt-1" onClick={async () => { const n = needs.find((x) => x.bumbuId === l.bumbuId)!; await save('spice', newBatchFromLabel(l, Math.round(n.prepGrams))); toast(`${l.label} dicatat sebagai stok bumbu.`); }}>Tandai sudah dibuat</Btn>
            </li>))}</ul>
          <p className="mt-2 text-[11px] text-charcoal/55">Masa simpan konservatif: kulkas 3 hari, freezer 30 hari. Cium & lihat sebelum dipakai; buang jika ragu.</p>
        </Card>
      )}
      <Card title="Stok bumbu tercatat">
        {data.spice.length === 0 ? <p className="text-sm text-charcoal/60">Belum ada.</p> : (
          <ul className="space-y-1 text-sm">{data.spice.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2"><span>{b.label || b.bumbuId} · {b.grams} g {b.useBy < today && <Badge tone="bad">Kedaluwarsa</Badge>}</span><Btn size="sm" variant="ghost" onClick={() => remove('spice', b.id)}>Hapus</Btn></li>))}</ul>
        )}
      </Card>
    </div>
  );
}

/* ================= Food Prep ================= */
export function FoodPrepPage() {
  const { plan, ctx, data, today, save } = useApp();
  const weeks = useMemo(() => (plan ? groupByWeek(plan.days.map((d) => d.date)) : []), [plan]);
  const [wk, setWk] = useState(plan ? weekStart(plan.days.some((d) => d.date === today) ? today : plan.start) : '');
  if (!plan) return <Empty title="Belum ada rencana" />;
  const w = weeks.find((x) => x.start === wk) ?? weeks[0];
  const days = plan.days.filter((d) => w.dates.includes(d.date));
  const tasks = foodPrepTasks(days, ctx);
  const containers = prepContainers(days, ctx);
  const state = data.prep.find((p) => p.id === w.start) ?? { id: w.start, checks: {} };
  const toggle = (k: string) => save('prep', { ...state, checks: { ...state.checks, [k]: !state.checks[k] } });
  const done = tasks.filter((t) => state.checks[t.id]).length;
  return (
    <div className="space-y-3">
      <PageHeader title="Food Prep" sub="Tugas prep bukan sesi masak harian" />
      <select aria-label="Minggu" className="input" value={w.start} onChange={(e) => setWk(e.target.value)}>{weeks.map((x) => <option key={x.start} value={x.start}>{shortDate(x.dates[0])}–{shortDate(x.dates[x.dates.length - 1])}{x.partial ? ' (parsial)' : ''}</option>)}</select>
      <Card title={`Checklist (${done}/${tasks.length})`}>
        <ul className="space-y-2">{tasks.map((t) => (
          <li key={t.id}><label className="flex items-start gap-2"><input type="checkbox" className="mt-1 h-5 w-5 accent-sage" checked={!!state.checks[t.id]} onChange={() => toggle(t.id)} /><span><b className="text-sm">{t.label}</b><br /><span className="text-xs text-charcoal/60">{t.detail}</span></span></label></li>))}</ul>
      </Card>
      <Card title="Wadah protein (mentah)">
        {containers.length === 0 ? <p className="text-sm text-charcoal/60">Tidak ada.</p> : (
          <ul className="divide-y divide-beige/60 text-sm">{containers.map((c, i) => (
            <li key={i} className="flex justify-between py-1.5"><span>{c.ingredient} {c.grams} {c.unit}<br /><span className="text-xs text-charcoal/60">{c.menu}</span></span><span className="text-xs text-charcoal/60">{shortDate(c.date)} · {c.location} · {c.condition}</span></li>))}</ul>
        )}
      </Card>
    </div>
  );
}

/* ================= Pantry ================= */
export function PantryPage() {
  const { ctx, data, today, save, saveMany, remove, toast } = useApp();
  const [add, setAdd] = useState(false);
  const sorted = fefo(data.pantry);
  const soon = expiringSoon(data.pantry, today);
  const gone = expired(data.pantry, today);
  const hasSample = data.pantry.some((p) => p.id.startsWith('sample-'));

  const importSample = async () => {
    if (!window.confirm('Impor contoh stok? Item masuk sebagai BELUM terkonfirmasi (tidak dihitung) sampai Anda memeriksa & mengonfirmasi tiap item.')) return;
    await saveMany('pantry', buildSampleStock());
    toast('Contoh stok diimpor (belum aktif).');
  };
  const confirmItem = async (p: PantryItem) => {
    const date = p.purchasedDate || today;
    const ing = ctx.ingredients.get(p.ingredientId);
    await save('pantry', { ...p, confirmed: true, safety: 'aman', purchasedDate: date, useBy: p.useBy || defaultUseBy(ing, p.location, date, p.condition) });
  };
  return (
    <div className="space-y-3">
      <PageHeader title="Pantry" sub="Hanya stok terkonfirmasi, aman, mentah & belum kedaluwarsa yang dihitung" action={<Btn size="sm" onClick={() => setAdd(true)}>+ Stok</Btn>} />
      {(soon.length > 0 || gone.length > 0) && (
        <Card title="Perhatian">
          {soon.length > 0 && <p className="text-sm text-amber-800">Segera habis masa pakai: {soon.map((s) => s.name).join(', ')}</p>}
          {gone.length > 0 && <p className="text-sm text-terra-dark">Kedaluwarsa (tidak dipakai): {gone.map((s) => s.name).join(', ')}</p>}
        </Card>
      )}
      {!hasSample && data.pantry.length === 0 && <Empty title="Pantry kosong" hint="Anda bisa mengisi manual atau mengimpor contoh stok (tidak akan aktif otomatis)." action={<Btn variant="soft" onClick={importSample}>Impor contoh stok</Btn>} />}
      <ul className="space-y-2">{sorted.map((p) => {
        const usable = isUsable(p, today);
        return (
          <li key={p.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <div><div className="font-semibold">{p.name}</div><div className="text-xs text-charcoal/60">{fmtQty(p.qty, p.unit)} · {p.location} · {p.condition} · pakai sebelum {p.useBy || '—'}</div></div>
              <div className="flex flex-col items-end gap-1"><Badge tone={usable ? 'ok' : p.confirmed ? 'bad' : 'warn'}>{usable ? 'Dihitung sebagai stok' : p.confirmed ? 'Tidak dipakai' : 'Belum dikonfirmasi'}</Badge><Badge tone={p.safety === 'aman' ? 'ok' : p.safety === 'periksa' ? 'warn' : 'bad'}>{p.safety}</Badge></div>
            </div>
            {p.note && <p className="mt-1 text-xs text-charcoal/60">{p.note}</p>}
            <div className="mt-2 flex gap-2">
              {!p.confirmed && <Btn size="sm" variant="soft" onClick={() => confirmItem(p)}>Konfirmasi (sudah saya cek, aman)</Btn>}
              <Btn size="sm" variant="ghost" onClick={() => remove('pantry', p.id)}>Hapus</Btn>
            </div>
          </li>
        );
      })}</ul>
      {hasSample && <p className="text-xs text-charcoal/55">Contoh stok hanya contoh; cek tanggal beli/bekukan dan kondisi sebelum konfirmasi.</p>}
      {add && <AddStock onClose={() => setAdd(false)} />}
    </div>
  );
}

function AddStock({ onClose }: { onClose: () => void }) {
  const { ctx, data, today, save } = useApp();
  const list = [...ctx.ingredients.values()].filter((i) => i.buyable !== false);
  const [ingId, setIngId] = useState(list[0]?.id ?? '');
  const [qty, setQty] = useState(500);
  const [loc, setLoc] = useState<PantryItem['location']>('kulkas');
  const [cond, setCond] = useState<PantryItem['condition']>('mentah');
  const [bought, setBought] = useState(today);
  const ing = ctx.ingredients.get(ingId);
  void data;
  return (
    <Sheet open onClose={onClose} title="Tambah stok">
      <div className="space-y-3">
        <Field label="Bahan"><select className="input" value={ingId} onChange={(e) => setIngId(e.target.value)}>{list.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={`Jumlah (${ing?.unit ?? 'g'})`}><input type="number" min={0} className="input" value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} /></Field>
          <Field label="Tanggal beli"><input type="date" className="input" value={bought} onChange={(e) => setBought(e.target.value)} /></Field>
          <Field label="Lokasi"><select className="input" value={loc} onChange={(e) => setLoc(e.target.value as PantryItem['location'])}><option value="kulkas">Kulkas</option><option value="freezer">Freezer</option><option value="pantry">Pantry</option></select></Field>
          <Field label="Kondisi"><select className="input" value={cond} onChange={(e) => setCond(e.target.value as PantryItem['condition'])}><option value="mentah">Mentah</option><option value="matang">Matang</option></select></Field>
        </div>
        <Btn className="w-full" disabled={!ing || qty <= 0} onClick={async () => { await save('pantry', { id: uid('pt'), ingredientId: ingId, name: ing!.name, qty, unit: ing!.unit, location: loc, purchasedDate: bought, condition: cond, safety: 'aman', price: null, useBy: defaultUseBy(ing, loc, bought, cond), confirmed: true }); onClose(); }}>Simpan (saya konfirmasi aman)</Btn>
      </div>
    </Sheet>
  );
}

/* ================= Cooking Assistant ================= */
export function CookPage() {
  const { plan, ctx, data, today, save, saveMany, toast } = useApp();
  const [params] = useSearchParams();
  const date = params.get('date') ?? (plan?.days.some((d) => d.date === today) ? today : plan?.start ?? today);
  const day = plan?.days.find((d) => d.date === date);
  const sessions = useMemo(() => (day ? cookingSessions(day, ctx) : []), [day, ctx]);
  if (!plan || !day) return <Empty title="Tidak ada menu untuk tanggal ini" />;

  const finish = async (sid: string, recipeIds: string[]) => {
    if (!window.confirm('Tandai selesai masak? Stok pantry yang terkonfirmasi akan dikurangi (FEFO).')) return;
    let items = data.pantry;
    const servings = servingsForDay(day, ctx);
    let shortfall = 0;
    for (const rid of recipeIds) {
      const r = ctx.recipes.get(rid); const s = servings.get(rid);
      if (!r || !s) continue;
      for (const l of recipeRequirement(r, s.adultUnits, s.childPortions, ctx, {}, new Map(), false).values()) {
        const res = consumeStock(items, l.ingredientId, l.gross, ctx, today);
        items = res.items; shortfall += res.shortfall > 0 ? 1 : 0;
      }
    }
    await saveMany('pantry', items);
    const prev = data.cook.find((c) => c.id === `${date}|${sid}`) ?? { id: `${date}|${sid}`, checks: {}, done: false };
    await save('cook', { ...prev, done: true });
    toast(shortfall ? `Selesai. ${shortfall} bahan tidak seluruhnya ada di stok (tidak dikurangi dari kas).` : 'Selesai. Stok dikurangi.');
  };

  return (
    <div className="space-y-3">
      <PageHeader title="Cooking Assistant" sub={date} />
      {sessions.map((s) => {
        const key = `${date}|${s.id}`;
        const prog = data.cook.find((c) => c.id === key) ?? { id: key, checks: {}, done: false };
        const order = suggestedOrder(s);
        return (
          <Card key={s.id} title={`${s.title} · ±${s.minutes} menit`} action={prog.done ? <Badge tone="ok">Selesai</Badge> : undefined}>
            <p className="mb-2 text-xs text-charcoal/60">Urutan disarankan: {order.map((t) => t.label).join(' → ')}</p>
            <ul className="space-y-1">{s.tasks.map((t) => (
              <li key={t.id}><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-sage" checked={!!prog.checks[t.id]} onChange={() => save('cook', { ...prog, checks: { ...prog.checks, [t.id]: !prog.checks[t.id] } })} />{t.label} <span className="text-xs text-charcoal/50">{t.minutes}m</span></label></li>))}</ul>
            {[...new Set(s.tasks.map((t) => t.recipeId).filter((x): x is string => !!x))].map((rid) => {
              const r = ctx.recipes.get(rid);
              return r ? <details key={rid} className="mt-2 rounded-xl bg-cream p-2 text-sm"><summary className="cursor-pointer font-semibold">{r.name}</summary><ol className="mt-1 list-decimal pl-5 text-xs">{r.steps.map((st, i) => <li key={i}>{st}</li>)}</ol></details> : null;
            })}
            {!prog.done && <Btn className="mt-3 w-full" onClick={() => finish(s.id, [...new Set(s.tasks.map((t) => t.recipeId).filter((x): x is string => !!x))])}>Selesai masak</Btn>}
          </Card>
        );
      })}
      <p className="text-[11px] text-charcoal/55"><Package size={11} className="inline" /> Stok hanya berkurang saat Anda menekan "Selesai masak", bukan saat menu dijadwalkan.</p>
    </div>
  );
}
