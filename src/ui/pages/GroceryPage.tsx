import { MessageCircle, Printer, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { GroceryItem, GroceryList, PantryItem } from '../../types';
import { useApp } from '../../state/AppContext';
import { CATEGORY_LABEL, CATEGORY_ORDER } from '../../data/ingredients';
import { addDaysStr, groupByWeek, shortDate, weekStart } from '../../engine/calendar';
import { cashPlan } from '../../engine/budget';
import { buildGroceryList, groceryTotals, mergeWithPrevious, recalcItem, whatsappText } from '../../engine/grocery';
import { defaultUseBy } from '../../engine/pantry';
import { fmtQty, rupiah } from '../../engine/units';
import { Badge, Btn, Card, Empty, Field, PageHeader, Progress, Sheet, Stat } from '../components/kit';
import { downloadText, uid } from '../helpers';

type Range = { id: string; label: string; start: string; end: string };

export default function GroceryPage() {
  const { plan, ctx, data, today, save, saveSettings, toast } = useApp();
  const [rangeId, setRangeId] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [onlyBuy, setOnlyBuy] = useState(true);

  const ranges = useMemo<Range[]>(() => {
    if (!plan) return [];
    const weeks = groupByWeek(plan.days.map((d) => d.date));
    const list: Range[] = weeks.map((w) => ({ id: w.start, label: `Minggu ${shortDate(w.dates[0])}–${shortDate(w.dates[w.dates.length - 1])}${w.partial ? ' (parsial)' : ''}`, start: w.dates[0], end: w.dates[w.dates.length - 1] }));
    list.push({ id: 'all', label: `Seluruh rencana (${shortDate(plan.start)}–${shortDate(plan.end)})`, start: plan.start, end: plan.end });
    return list;
  }, [plan]);
  const thisWeek = plan ? weekStart(plan.days.some((d) => d.date === today) ? today : plan.start) : '';
  const range = ranges.find((r) => r.id === (rangeId || thisWeek)) ?? ranges[0];

  const saved = plan && range ? data.groceryLists.find((g) => g.planId === plan.id && g.rangeStart === range.start && g.rangeEnd === range.end) : undefined;
  const fresh = useMemo(() => (plan && range ? buildGroceryList(plan.id, plan.days.filter((d) => d.date >= range.start && d.date <= range.end), ctx, data.pantry, today) : undefined), [plan, range, ctx, data.pantry, today]);
  const list: GroceryList | undefined = saved ?? fresh;

  if (!plan || !range || !list) return (<div><PageHeader title="Grocery" /><Empty title="Belum ada rencana menu" hint="Buat rencana di tab Meal Plan terlebih dahulu." /></div>);

  const persist = async (items: GroceryItem[], extra: Partial<GroceryList> = {}) => save('groceryLists', { ...list, ...extra, items });
  const update = (id: string, patch: Partial<GroceryItem>) => persist(list.items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const recalc = (it: GroceryItem, patch: Partial<GroceryItem>) => recalcItem({ ...it, ...patch }, it.ingredientId ? ctx.ingredients.get(it.ingredientId) : undefined);

  const totals = groceryTotals(list.items);
  const cash = cashPlan(data.settings.cash.amount, list.items);
  const weekly = ctx.prefs.weeklyBudget;
  const visible = list.items.filter((i) => (onlyBuy ? i.buyQty > 0 || i.status === 'purchased' : true));

  const regenerate = async () => {
    if (!fresh) return;
    await save('groceryLists', mergeWithPrevious({ ...fresh, id: saved?.id ?? fresh.id }, saved));
    toast('Daftar belanja dihitung ulang dari rencana & stok terkonfirmasi.');
  };

  const confirmPurchase = async () => {
    const toBuy = list.items.filter((i) => i.checked && i.status !== 'purchased' && i.buyQty > 0);
    if (!toBuy.length) { toast('Centang item yang sudah dibeli dulu.'); return; }
    if (!window.confirm(`Konfirmasi ${toBuy.length} item sudah dibeli? Item akan masuk Pantry (stok aman) dan uang tunai berkurang sesuai harga aktual/estimasi.`)) return;
    let spent = 0;
    const stockRows: PantryItem[] = [];
    const items = list.items.map((it) => {
      if (!toBuy.includes(it)) return it;
      const paid = it.actualPrice ?? it.subtotal ?? 0;
      spent += paid;
      const ing = it.ingredientId ? ctx.ingredients.get(it.ingredientId) : undefined;
      if (ing && ing.buyable !== false) {
        const loc = ing.category === 'sayur' || ing.shelfDays?.kulkas ? 'kulkas' : 'pantry';
        stockRows.push({ id: uid('pt'), ingredientId: ing.id, name: ing.name, qty: it.buyQty, unit: ing.unit as PantryItem['unit'], location: loc, purchasedDate: today, condition: 'mentah', safety: 'aman', price: paid, useBy: defaultUseBy(ing, loc, today), confirmed: true, note: 'Dari belanja' });
      }
      return { ...it, status: 'purchased' as const, actualPrice: it.actualPrice ?? it.subtotal };
    });
    await persist(items, { purchasedAt: new Date().toISOString() });
    for (const r of stockRows) await save('pantry', r);
    await saveSettings((s) => ({ ...s, cash: { amount: Math.max(0, s.cash.amount - spent), updated: today } }));
    toast(`Belanja dikonfirmasi. ${stockRows.length} item masuk Pantry.`);
  };

  const wa = () => window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText(list))}`, '_blank', 'noopener');

  return (
    <div>
      <PageHeader title="Grocery" sub="Harga = estimasi yang bisa Anda ubah" action={<div className="no-print flex gap-1"><Btn size="sm" variant="ghost" aria-label="Cetak / simpan PDF" onClick={() => window.print()}><Printer size={15} /></Btn><Btn size="sm" variant="ghost" aria-label="Kirim WhatsApp" onClick={wa}><MessageCircle size={15} /></Btn></div>} />
      <div className="no-print mb-3 space-y-2">
        <select aria-label="Rentang belanja" className="input" value={range.id} onChange={(e) => setRangeId(e.target.value)}>{ranges.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
        <div className="flex flex-wrap gap-2">
          <Btn size="sm" variant="soft" onClick={regenerate}>Hitung ulang</Btn>
          <Btn size="sm" variant="ghost" onClick={() => setAddOpen(true)}><Plus size={14} /> Item manual</Btn>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={onlyBuy} onChange={(e) => setOnlyBuy(e.target.checked)} /> Hanya yang perlu dibeli</label>
        </div>
        {!saved && <p className="text-xs text-charcoal/60">Pratinjau — belum tersimpan. Centang/ubah item akan menyimpannya.</p>}
      </div>

      <Card title="Ringkasan" className="mb-3">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Dalam budget (est.)" value={rupiah(totals.budget)} sub={range.id !== 'all' ? `Target ${rupiah(weekly)}/minggu` : undefined} tone={range.id !== 'all' && totals.budget > weekly ? 'bad' : undefined} />
          <Stat label="Di luar budget" value={rupiah(totals.outside)} sub="beras, minyak, bumbu, dll." />
          <Stat label="Uang tunai" value={rupiah(cash.cash)} sub={`Rencana belanja ${rupiah(cash.planned)}`} />
          <Stat label="Sisa setelah belanja" value={rupiah(cash.remaining)} tone={cash.remaining < 0 ? 'bad' : undefined} />
        </div>
        {range.id !== 'all' && <div className="mt-2"><Progress value={totals.budget} max={weekly} tone={totals.budget > weekly ? 'bad' : 'ok'} /></div>}
        {cash.remaining < 0 && <p className="mt-2 text-xs text-terra-dark">Uang tunai kurang {rupiah(-cash.remaining)}. Kurangi item atau perbarui uang tunai di Pengaturan.</p>}
        {totals.unknown.length > 0 && <p className="mt-2 text-xs text-amber-800">Harga belum diisi: {totals.unknown.join(', ')} — total di atas belum lengkap (PRICE INCOMPLETE).</p>}
        <p className="mt-2 text-[11px] text-charcoal/55">Uang tunai dan nilai bahan yang dikonsumsi dipisahkan: belanja mengurangi kas, stok yang dipakai tidak.</p>
      </Card>

      {CATEGORY_ORDER.map((cat) => {
        const rows = visible.filter((i) => i.category === cat);
        if (!rows.length) return null;
        return (
          <Card key={cat} title={CATEGORY_LABEL[cat]} className="mb-3">
            <ul className="divide-y divide-beige/60">
              {rows.map((it) => (
                <li key={it.id} className="py-2">
                  <div className="flex items-start gap-2">
                    <input aria-label={`Centang ${it.name}`} type="checkbox" className="mt-1 h-5 w-5 accent-sage" checked={it.checked} disabled={it.status === 'purchased'} onChange={(e) => update(it.id, { checked: e.target.checked })} />
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-semibold ${it.checked ? 'line-through opacity-60' : ''}`}>{it.name} {it.status === 'purchased' && <Badge tone="ok">Dibeli</Badge>} {!it.inBudget && <Badge>Di luar budget</Badge>}</div>
                      <div className="text-xs text-charcoal/60">Butuh {fmtQty(it.need, it.unit)}{it.stock > 0 ? ` · stok ${fmtQty(it.stock, it.unit)}` : ''} · beli <b>{fmtQty(it.buyQty, it.unit)}</b> ({it.packs.toFixed(it.packs % 1 ? 1 : 0)} kemasan)</div>
                      <div className="no-print mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <label className="flex items-center gap-1">Jml
                          <input aria-label={`Jumlah ${it.name}`} type="number" min={0} className="input !min-h-0 !w-20 !py-1" value={it.buyQty} disabled={it.status === 'purchased'} onChange={(e) => persist(list.items.map((x) => (x.id === it.id ? recalc(x, { buyQty: Math.max(0, Number(e.target.value) || 0) }) : x)))} /></label>
                        <label className="flex items-center gap-1">Harga/kemasan
                          <input aria-label={`Harga ${it.name}`} type="number" min={0} placeholder="isi" className="input !min-h-0 !w-24 !py-1" value={it.estUnitPrice ?? ''} disabled={it.status === 'purchased'} onChange={(e) => persist(list.items.map((x) => (x.id === it.id ? recalc(x, { estUnitPrice: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) }) : x)))} /></label>
                        <label className="flex items-center gap-1">Aktual
                          <input aria-label={`Harga aktual ${it.name}`} type="number" min={0} className="input !min-h-0 !w-24 !py-1" value={it.actualPrice ?? ''} onChange={(e) => update(it.id, { actualPrice: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} /></label>
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold">{it.subtotal === null ? <span className="text-amber-800">harga ?</span> : rupiah(it.actualPrice ?? it.subtotal)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
      {visible.length === 0 && <Empty title="Tidak ada yang perlu dibeli" hint="Semua kebutuhan sudah tertutup stok yang terkonfirmasi." />}

      <div className="no-print sticky bottom-20 mt-3 flex gap-2">
        <Btn className="flex-1" onClick={confirmPurchase}>Konfirmasi sudah dibeli ({list.items.filter((i) => i.checked && i.status !== 'purchased').length})</Btn>
        <Btn variant="ghost" onClick={() => downloadText(`belanja-${range.start}.txt`, whatsappText(list), 'text/plain')}>.txt</Btn>
      </div>
      <p className="mt-2 text-[11px] text-charcoal/55">PDF: tekan ikon cetak lalu pilih "Simpan sebagai PDF". Tidak ada harga real-time; semua harga adalah estimasi yang Anda kendalikan.</p>
      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} onAdd={(it) => persist([...list.items, it])} />
    </div>
  );
}

function AddSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (i: GroceryItem) => void }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState('');
  return (
    <Sheet open={open} onClose={onClose} title="Item manual">
      <div className="space-y-3">
        <Field label="Nama"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Jumlah (pcs)"><input type="number" min={1} className="input" value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} /></Field>
        <Field label="Harga total (opsional)"><input type="number" min={0} className="input" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        <Btn className="w-full" disabled={!name.trim()} onClick={() => { onAdd({ id: uid('man'), name: name.trim(), category: 'pantry', unit: 'pcs', need: qty, stock: 0, buyQty: qty, packs: qty, estUnitPrice: price === '' ? null : Number(price) / qty, actualPrice: null, subtotal: price === '' ? null : Number(price), checked: false, status: 'to_buy', inBudget: false, manual: true }); setName(''); setPrice(''); onClose(); }}>Tambah</Btn>
      </div>
    </Sheet>
  );
}

void addDaysStr;
