import { Baby, CalendarDays, ChefHat, ClipboardList, Coins, Flame, PiggyBank, ShoppingBasket, Sparkles, Utensils, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../state/AppContext';
import { budgetReport } from '../../engine/budget';
import { cookingSessions } from '../../engine/cooking';
import { groceryTotals } from '../../engine/grocery';
import { expiringSoon } from '../../engine/pantry';
import { occasionsForDay } from '../../engine/portions';
import { actualSeafoodEvents, seafoodTracker, toddlerDay } from '../../engine/toddler';
import { dayName, isWeekend, longDate, weekStart } from '../../engine/calendar';
import { validatePlan } from '../../engine/validate';
import { Badge, Btn, Card, Empty, GlutenBadge, Progress, Stat } from '../components/kit';
import { rn, rp, useFocus } from '../helpers';

function greeting(): string {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat pagi!' : h < 15 ? 'Selamat siang!' : h < 19 ? 'Selamat sore!' : 'Selamat malam!';
}

export default function HomePage() {
  const { ctx, plan, data, today, saveSettings, toast } = useApp();
  const focus = useFocus();
  const [cashInput, setCashInput] = useState(String(data.settings.cash.amount || ''));
  const day = focus.day;

  const report = useMemo(() => (plan ? validatePlan(plan.days, ctx, { history: data.seafood }) : undefined), [plan, ctx, data.seafood]);
  const budget = useMemo(() => (plan ? budgetReport(plan.days, ctx, data.pantry, today) : undefined), [plan, ctx, data.pantry, today]);

  if (!plan || !day) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold">{greeting()}<br />Masak apa hari ini?</h1>
        <Empty title="Belum ada rencana menu aktif" hint="Buat menu dengan generator lokal atau reset ke data demo di Pengaturan." action={<Link className="btn btn-primary" to="/rencana">Buka Meal Plan</Link>} />
      </div>
    );
  }

  const wk = weekStart(day.date);
  const week = budget?.weeks.find((w) => w.start === wk);
  const weekReport = report?.weeks.find((w) => w.start === wk);
  const list = data.groceryLists.find((g) => g.planId === plan.id && g.rangeStart <= day.date && g.rangeEnd >= day.date) ?? data.groceryLists.find((g) => g.planId === plan.id);
  const totals = list ? groceryTotals(list.items) : undefined;
  const toddler = toddlerDay(day, ctx);
  const seafoodEv = actualSeafoodEvents(data.journal, ctx, data.seafood);
  const sea = seafoodTracker(seafoodEv, plan.days, ctx, today);
  const weekend = isWeekend(day.date);
  const prepKey = wk;
  const prepState = data.prep.find((p) => p.id === prepKey);
  const prepTotal = 9;
  const prepDone = prepState ? Object.values(prepState.checks).filter(Boolean).length : 0;
  const cashPlanned = totals ? totals.budget + totals.outside : 0;
  const cash = data.settings.cash.amount;
  const soon = expiringSoon(data.pantry, today, 2);
  const altDays = plan.days.filter((d) => weekStart(d.date) === wk && d.motherLunch.mode === 'alt').length;
  const premium = plan.days.filter((d) => weekStart(d.date) === wk).flatMap((d) => [d.mainA, d.mainB]).filter((id) => ['sapi', 'udang', 'cumi'].includes(ctx.recipes.get(id)?.protein ?? '')).length;
  const sessions = cookingSessions(day, ctx);
  const hour = new Date().getHours();
  const nextSlot = hour < 10 ? 'sarapan' : hour < 15 ? 'siang' : 'malam';
  const nextOcc = occasionsForDay(day, ctx).filter((o) => o.slot === nextSlot);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold leading-tight">{greeting()}<br />Masak apa hari ini?</h1>
        <p className="mt-1 text-sm text-charcoal/60">
          {longDate(focus.date)}
          {!focus.inPlan && <Badge tone="warn" className="ml-2">Di luar rencana — menampilkan hari pertama</Badge>}
        </p>
      </div>

      <Card title="Menu hari ini" icon={<Utensils size={16} />} action={<Link to="/rencana" className="text-xs font-semibold text-sage-dark">Lihat rencana</Link>}>
        <ul className="space-y-2 text-sm">
          <li><b>Sarapan ibu:</b> {ctx.prefs.motherBreakfastEggs} telur ceplok</li>
          <li><b>{weekend ? 'Lauk A (pagi & siang):' : 'Lauk pagi/siang:'}</b> {rn(ctx, day.mainA)}</li>
          {!weekend && <li><b>Makan siang ibu:</b> {day.motherLunch.mode === 'follow' ? 'ikut lauk anak' : rn(ctx, day.motherLunch.recipeId ?? 'ayam-suwir') + ' (food prep)'}</li>}
          <li><b>{weekend ? 'Lauk B (malam):' : 'Lauk malam:'}</b> {rn(ctx, day.mainB)}</li>
          <li><b>Sayur:</b> {rn(ctx, day.veg)}</li>
          <li><b>Nasi anak:</b> {rn(ctx, day.rice)} {day.riceNote}</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-2"><GlutenBadge status={toddler.gluten} />{day.sides.length > 0 && <Badge tone="info">Pendamping: {day.sides.map((s) => rn(ctx, s)).join(', ')}</Badge>}<Badge>{sessions.length} sesi masak</Badge></div>
        {day.note && <p className="mt-2 text-xs text-charcoal/60">{day.note}</p>}
      </Card>

      <Card title="Budget mingguan" icon={<Wallet size={16} />}>
        {week ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Budget" value={rp(week.target)} />
              <Stat label="Estimasi belanja" value={rp(week.effective)} sub={week.over ? 'melebihi budget' : 'dalam budget'} tone={week.over ? 'bad' : undefined} />
              <Stat label="Belanja aktual" value={rp(totals?.cashSpent ?? 0)} />
              <Stat label="Sisa budget" value={rp(week.target - week.effective)} tone={week.over ? 'bad' : undefined} />
            </div>
            <div className="mt-3"><Progress value={week.effective} max={week.target} tone={week.over ? 'bad' : 'ok'} /></div>
            {week.unknownPriceItems.length > 0 && <p className="mt-2 text-xs text-terra-dark">Harga belum diisi: {week.unknownPriceItems.join(', ')} — total belum lengkap.</p>}
            <p className="mt-2 text-xs text-charcoal/55">Harga adalah estimasi awal; ubah di Pengaturan › Harga bahan.</p>
          </>
        ) : <p className="text-sm text-charcoal/60">Tidak ada data minggu ini.</p>}
      </Card>

      <Card title="Cash available" icon={<Coins size={16} />}>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label" htmlFor="cash">Uang tunai tersedia (Rp)</label>
            <input id="cash" className="input" inputMode="numeric" value={cashInput} onChange={(e) => setCashInput(e.target.value.replace(/\D/g, ''))} placeholder="mis. 125000" />
          </div>
          <Btn variant="soft" onClick={async () => { await saveSettings((s) => ({ ...s, cash: { amount: Number(cashInput) || 0, updated: today } })); toast('Kas tersimpan'); }}>Simpan</Btn>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Rencana belanja" value={rp(cashPlanned)} sub="daftar belanja belum dibeli" />
          <Stat label="Sisa kas" value={rp(cash - cashPlanned)} tone={cash - cashPlanned < 0 ? 'bad' : undefined} />
        </div>
        <p className="mt-2 text-xs text-charcoal/55">Kas terpisah dari target budget mingguan.</p>
      </Card>

      <Card title="Smart savings" icon={<PiggyBank size={16} />}>
        <ul className="space-y-1.5 text-sm">
          <li>Hemat dari stok: <b>{rp(week?.inventoryUsedValue ?? 0)}</b> {data.pantry.every((p) => !p.confirmed) && <span className="text-xs text-charcoal/55">(belum ada stok yang dikonfirmasi)</span>}</li>
          <li>Hari dengan lauk alternatif/food prep minggu ini: <b>{altDays}</b></li>
          <li>Menu premium minggu ini (sapi/udang/cumi): <b>{premium}</b></li>
          <li>Stok mendekati kedaluwarsa (≤2 hari): <b>{soon.length}</b>{soon.length > 0 && ` — ${soon.slice(0, 3).map((s) => s.name).join(', ')}`}</li>
        </ul>
      </Card>

      <Card title="Nutrisi balita" icon={<Baby size={16} />} action={<Link to="/balita" className="text-xs font-semibold text-sage-dark">Buka</Link>}>
        <div className="space-y-1.5 text-sm">
          <p><b>Protein:</b> {toddler.meals[0].lauk}{toddler.meals[2].lauk !== toddler.meals[0].lauk ? ` + ${toddler.meals[2].lauk}` : ''}</p>
          <p><b>Nasi:</b> {toddler.rice} {toddler.riceNote ?? ''}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={weekReport?.ironRich ? 'ok' : weekReport?.partial ? 'muted' : 'bad'}>Zat besi minggu ini: {weekReport?.ironRich ? '✓' : weekReport?.partial ? 'PARTIAL WEEK' : '✗'}</Badge>
          <Badge tone={(report?.sapiAnakDates.length ?? 0) >= 2 ? 'ok' : 'warn'}>Sapi anak: {report?.sapiAnakDates.length ?? 0}/2</Badge>
          <Badge tone={sea.status === 'OVERDUE' ? 'bad' : sea.status === 'DUE SOON' ? 'warn' : sea.status === 'NO HISTORY' ? 'muted' : 'ok'}>Seafood: {sea.status}{sea.nextDue ? ` (jatuh tempo ${sea.nextDue})` : ''}</Badge>
        </div>
        <p className="mt-2 text-xs text-charcoal/55">Ini menu terencana; konsumsi aktual dicatat di Food Journal.</p>
      </Card>

      <Card title="Grocery checklist" icon={<ShoppingBasket size={16} />} action={<Link to="/belanja" className="text-xs font-semibold text-sage-dark">Buka</Link>}>
        {totals && list ? (
          <><p className="mb-2 text-sm">{totals.checked}/{totals.total} item dicentang ({list.rangeStart} s/d {list.rangeEnd})</p><Progress value={totals.checked} max={totals.total} /></>
        ) : <p className="text-sm text-charcoal/60">Belum ada daftar belanja. <Link className="font-semibold text-sage-dark" to="/belanja">Buat daftar</Link></p>}
      </Card>

      <Card title="Food prep" icon={<ClipboardList size={16} />} action={<Link to="/dapur/prep" className="text-xs font-semibold text-sage-dark">Buka</Link>}>
        <p className="mb-2 text-sm">{prepDone} tugas selesai minggu ini</p>
        <Progress value={prepDone} max={prepTotal} />
      </Card>

      <Card title={`Makan berikutnya — ${nextSlot}`} icon={<Flame size={16} />}>
        <ul className="space-y-1 text-sm">
          {nextOcc.map((o) => (
            <li key={o.member}><b className="capitalize">{o.member}:</b> {o.items.map((i) => (i.kind === 'sarapan' ? `${i.units} telur ceplok` : rn(ctx, i.recipeId))).join(' • ') || '—'}</li>
          ))}
          {nextOcc.length === 0 && <li className="text-charcoal/60">Tidak ada makan terjadwal.</li>}
        </ul>
        <p className="mt-2 text-xs text-charcoal/55">{dayName(day.date)} • sesi masak: {sessions.map((s) => s.title).join(', ')}</p>
      </Card>

      <Card title="Aksi cepat" icon={<Sparkles size={16} />}>
        <div className="grid grid-cols-2 gap-2">
          <Link className="btn btn-primary" to="/rencana?generate=1">Generate Meal Plan</Link>
          <Link className="btn btn-primary" to="/rencana?generate=next">Menu Bulan Depan</Link>
          <Link className="btn btn-soft" to="/belanja">Grocery List</Link>
          <Link className="btn btn-soft" to="/dapur/bumbu">Smart Bumbu Prep</Link>
          <Link className="btn btn-soft" to="/dapur/masak-dari-stok">Cook With What I Have</Link>
          <Link className="btn btn-soft" to="/dapur/masak"><ChefHat size={16} /> Start Cooking</Link>
          <Link className="btn btn-ghost col-span-2" to="/balita/jurnal"><CalendarDays size={16} /> Toddler Food Journal</Link>
        </div>
      </Card>
    </div>
  );
}
