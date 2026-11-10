import { Star, Youtube } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFieldArray, useForm, type Resolver } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import type { Method, Recipe, RecipeCategory, RecipeRole, ProteinType, Spice, Member } from '../../types';
import { useApp } from '../../state/AppContext';
import { cookWithWhatIHave, substitutesFor, type HaveItem } from '../../engine/cookwith';
import { checkRecipeForMember, combinedStatus, recipeGluten } from '../../engine/restrictions';
import { stockByIngredient } from '../../engine/pantry';
import { fmtQty, rupiah } from '../../engine/units';
import { Badge, Btn, Card, Empty, Field, GlutenBadge, PageHeader, StatusBadge, MEMBER_LABEL } from '../components/kit';
import { proteinIcon, uid, youtubeSearchUrl } from '../helpers';

const CAT_LABEL: Record<RecipeCategory, string> = {
  ayam: 'Ayam', telur: 'Telur', ikan: 'Ikan', udang: 'Udang', cumi: 'Cumi', daging_sapi: 'Daging sapi', hati_ampela: 'Hati & ampela',
  tahu_tempe: 'Tahu/tempe', sayuran: 'Sayuran', nasi_anak: 'Nasi anak', bumbu_dasar: 'Bumbu dasar',
};

export function RecipeLibrary() {
  const { ctx, data } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'semua' | RecipeCategory | 'fav'>('semua');
  const all = useMemo(() => [...ctx.recipes.values()].sort((a, b) => a.name.localeCompare(b.name)), [ctx]);
  const list = all.filter((r) => (cat === 'semua' ? true : cat === 'fav' ? r.favorite : r.category === cat) && r.name.toLowerCase().includes(q.toLowerCase()));
  void data;
  return (
    <div className="space-y-3">
      <PageHeader title="Recipe Library" sub={`${all.length} resep`} action={<Link className="btn btn-primary btn-sm" to="/dapur/resep/baru">+ Resep</Link>} />
      <input aria-label="Cari resep" className="input" placeholder="Cari resep…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-1 overflow-x-auto pb-1">
        {(['semua', 'fav', ...Object.keys(CAT_LABEL)] as const).map((c) => (
          <button key={c} type="button" className={`chip whitespace-nowrap ${cat === c ? 'bg-sage text-white' : ''}`} onClick={() => setCat(c as typeof cat)}>{c === 'semua' ? 'Semua' : c === 'fav' ? '★ Favorit' : CAT_LABEL[c as RecipeCategory]}</button>
        ))}
      </div>
      {list.length === 0 && <Empty title="Tidak ada resep yang cocok" />}
      <ul className="space-y-2">{list.map((r) => (
        <li key={r.id}>
          <Link to={`/dapur/resep/${r.id}`} className="card flex items-center justify-between gap-2">
            <div className="min-w-0"><div className="truncate font-semibold">{proteinIcon[r.protein]} {r.name} {r.favorite && '★'}</div>
              <div className="text-xs text-charcoal/60">{CAT_LABEL[r.category]} · {r.prepMin + r.cookMin} mnt{r.custom ? ' · buatan sendiri' : ''}</div></div>
            <GlutenBadge status={recipeGluten(r, ctx)} />
          </Link>
        </li>))}</ul>
    </div>
  );
}

export function RecipeDetail() {
  const { id } = useParams();
  const { ctx, data, save, remove, toast } = useApp();
  const nav = useNavigate();
  const r = id ? ctx.recipes.get(id) : undefined;
  const [yt, setYt] = useState<{ title: string; url: string }[] | null>(null);
  const [ytMsg, setYtMsg] = useState('');
  if (!r) return <Empty title="Resep tidak ditemukan" action={<Link className="btn btn-soft" to="/dapur/resep">Kembali</Link>} />;
  const query = data.recipeQueries.find((x) => x.id === r.id)?.query ?? r.youtubeQuery;
  const members: Member[] = ['ibu', 'ayah', 'anak'];
  const saved = data.videos.filter((v) => v.recipeId === r.id);

  const searchApi = async () => {
    setYtMsg('Mencari…');
    try {
      const res = await fetch(`/.netlify/functions/youtube-search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { items?: { title: string; url: string }[] };
      setYt(j.items ?? []);
      setYtMsg(j.items?.length ? '' : 'Tidak ada hasil.');
    } catch {
      setYt(null);
      setYtMsg('Pencarian API tidak tersedia (fungsi server belum diaktifkan/tanpa kunci). Gunakan tautan pencarian YouTube di bawah — tidak butuh kunci apa pun.');
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader title={r.name} sub={`${CAT_LABEL[r.category]} · untuk ${r.serves} porsi dewasa · ${r.prepMin + r.cookMin} menit`} action={<Btn size="sm" variant="ghost" aria-label="Favorit" onClick={() => save('recipes', { ...r, favorite: !r.favorite })}><Star size={16} fill={r.favorite ? 'currentColor' : 'none'} /></Btn>} />
      <Card title="Status per anggota">
        <ul className="space-y-2">{members.map((m) => {
          const v = checkRecipeForMember(r, m, ctx, { weekend: false, asMain: r.role === 'lauk' });
          return (
            <li key={m} className="text-sm"><div className="flex items-center justify-between"><b>{MEMBER_LABEL[m]}</b><StatusBadge status={combinedStatus(r, [m], ctx, { weekend: false, asMain: r.role === 'lauk' })} /></div>
              {v.length > 0 && <ul className="ml-4 list-disc text-xs text-charcoal/65">{v.slice(0, 4).map((x, i) => <li key={i}>{x.message}</li>)}</ul>}</li>);
        })}</ul>
        <div className="mt-2"><GlutenBadge status={recipeGluten(r, ctx)} /></div>
      </Card>
      <Card title="Bahan (bersih, per resep)">
        <ul className="text-sm">{r.ingredients.map((i, k) => <li key={k} className="flex justify-between border-b border-beige/50 py-1"><span>{ctx.ingredients.get(i.ingredientId)?.name ?? i.ingredientId}{i.options?.length ? <span className="text-xs text-charcoal/55"> (atau {i.options.map((o) => ctx.ingredients.get(o)?.name ?? o).join(', ')})</span> : null}</span><span>{fmtQty(i.amount, ctx.ingredients.get(i.ingredientId)?.unit ?? 'g')}</span></li>)}
          {r.bumbu.map((b, k) => <li key={`b${k}`} className="flex justify-between border-b border-beige/50 py-1"><span>Bumbu {b.type.replace(/_/g, ' ')}</span><span>{b.grams} g</span></li>)}</ul>
      </Card>
      <Card title="Langkah"><ol className="list-decimal space-y-1 pl-5 text-sm">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>{r.note && <p className="mt-2 rounded-xl bg-cream p-2 text-xs">{r.note}</p>}</Card>
      <Card title="Tutorial YouTube" icon={<Youtube size={14} />}>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-soft" target="_blank" rel="noreferrer" href={youtubeSearchUrl(query)}>Cari di YouTube</a>
          <Btn variant="ghost" onClick={searchApi}>Cari via API (opsional)</Btn>
          <Btn variant="ghost" onClick={() => save('videos', { id: uid('v'), recipeId: r.id, title: `Pencarian: ${query}`, url: youtubeSearchUrl(query), kind: 'search', query })}>Simpan pencarian</Btn>
        </div>
        {ytMsg && <p className="mt-2 text-xs text-charcoal/65">{ytMsg}</p>}
        {yt && <ul className="mt-2 list-disc pl-5 text-sm">{yt.map((v) => <li key={v.url}><a className="text-sage-dark underline" href={v.url} target="_blank" rel="noreferrer">{v.title}</a></li>)}</ul>}
        {saved.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{saved.map((v) => <li key={v.id}><a className="underline" href={v.url} target="_blank" rel="noreferrer">{v.title}</a></li>)}</ul>}
        <p className="mt-2 text-[11px] text-charcoal/55">Video bukan bagian aplikasi; periksa kesesuaian dengan pantangan sebelum mengikuti.</p>
      </Card>
      {r.custom && <div className="flex gap-2"><Link className="btn btn-soft flex-1" to={`/dapur/resep/${r.id}/edit`}>Edit</Link><Btn variant="danger" className="flex-1" onClick={async () => { if (window.confirm('Hapus resep ini? Menu yang memakainya akan menjadi "tidak ditemukan".')) { await remove('recipes', r.id); toast('Resep dihapus.'); nav('/dapur/resep'); } }}>Hapus</Btn></div>}
    </div>
  );
}

const FormSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 huruf'),
  category: z.string().min(1),
  role: z.string().min(1),
  protein: z.string().min(1),
  method: z.string().min(1),
  spice: z.string().min(1),
  serves: z.coerce.number().positive('Harus > 0'),
  prepMin: z.coerce.number().min(0),
  cookMin: z.coerce.number().min(0),
  ingredients: z.array(z.object({ ingredientId: z.string().min(1), amount: z.coerce.number().positive('Jumlah > 0') })).min(1, 'Minimal 1 bahan'),
  steps: z.string().trim().min(3, 'Isi langkah'),
  youtubeQuery: z.string().optional(),
});
type FormValues = z.infer<typeof FormSchema>;
const zodResolverLite: Resolver<FormValues> = async (values) => {
  const r = FormSchema.safeParse(values);
  if (r.success) return { values: r.data, errors: {} };
  const errors: Record<string, { type: string; message: string }> = {};
  for (const i of r.error.issues) errors[i.path.join('.')] = { type: i.code, message: i.message };
  return { values: {}, errors: errors as never };
};

export function RecipeForm() {
  const { id } = useParams();
  const { ctx, save, toast } = useApp();
  const nav = useNavigate();
  const existing = id ? ctx.recipes.get(id) : undefined;
  const ings = [...ctx.ingredients.values()].filter((i) => i.buyable !== false).sort((a, b) => a.name.localeCompare(b.name));
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolverLite,
    defaultValues: existing ? { name: existing.name, category: existing.category, role: existing.role, protein: existing.protein, method: existing.method, spice: existing.spice, serves: existing.serves, prepMin: existing.prepMin, cookMin: existing.cookMin, ingredients: existing.ingredients.map((i) => ({ ingredientId: i.ingredientId, amount: i.amount })), steps: existing.steps.join('\n'), youtubeQuery: existing.youtubeQuery }
      : { name: '', category: 'ayam', role: 'lauk', protein: 'ayam', method: 'tumis', spice: 'none', serves: 4, prepMin: 10, cookMin: 20, ingredients: [{ ingredientId: ings[0]?.id ?? '', amount: 300 }], steps: '', youtubeQuery: '' },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'ingredients' });
  const onSubmit = async (v: FormValues) => {
    const base: Recipe = existing ?? { id: uid('custom'), bumbu: [], isFried: false, ironRich: false, weekendOk: true, prepAhead: false, favorite: false, name: '', category: 'ayam', role: 'lauk', protein: 'ayam', serves: 4, ingredients: [], method: 'tumis', spice: 'none', prepMin: 0, cookMin: 0, steps: [], youtubeQuery: '' };
    const r: Recipe = { ...base, name: v.name, category: v.category as RecipeCategory, role: v.role as RecipeRole, protein: v.protein as ProteinType, method: v.method as Method, spice: v.spice as Spice, serves: v.serves, prepMin: v.prepMin, cookMin: v.cookMin, ingredients: v.ingredients, steps: v.steps.split('\n').map((s) => s.trim()).filter(Boolean), youtubeQuery: v.youtubeQuery || `resep ${v.name}`, custom: true, isFried: v.method === 'goreng' };
    await save('recipes', r);
    toast('Resep disimpan. Status aman dihitung otomatis dari bahan.');
    nav(`/dapur/resep/${r.id}`);
  };
  const sel = (name: 'category' | 'role' | 'protein' | 'method' | 'spice', opts: string[]) => <select className="input" {...register(name)}>{opts.map((o) => <option key={o}>{o}</option>)}</select>;
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <PageHeader title={existing ? 'Edit resep' : 'Resep baru'} />
      <Field label="Nama"><input className="input" {...register('name')} />{errors.name && <span className="text-xs text-terra-dark">{errors.name.message}</span>}</Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Kategori">{sel('category', Object.keys(CAT_LABEL))}</Field>
        <Field label="Peran">{sel('role', ['lauk', 'sayur', 'nasi', 'sarapan', 'pendamping'])}</Field>
        <Field label="Protein">{sel('protein', ['ayam', 'telur', 'ikan', 'sapi', 'hati', 'udang', 'cumi', 'tahu_tempe', 'none'])}</Field>
        <Field label="Metode">{sel('method', ['goreng', 'tumis', 'kuah', 'bakar', 'kukus', 'rebus', 'panggang', 'semur', 'suwir', 'dadar', 'tanak', 'lainnya'])}</Field>
        <Field label="Pedas">{sel('spice', ['none', 'mild', 'hot'])}</Field>
        <Field label="Porsi dewasa"><input type="number" step="0.5" className="input" {...register('serves')} /></Field>
        <Field label="Persiapan (mnt)"><input type="number" className="input" {...register('prepMin')} /></Field>
        <Field label="Masak (mnt)"><input type="number" className="input" {...register('cookMin')} /></Field>
      </div>
      <Card title="Bahan (jumlah bersih)">
        <div className="space-y-2">{fields.map((f, i) => (
          <div key={f.id} className="flex gap-2">
            <select className="input flex-1" {...register(`ingredients.${i}.ingredientId` as const)}>{ings.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <input aria-label="Jumlah" type="number" className="input !w-24" {...register(`ingredients.${i}.amount` as const)} />
            <Btn variant="ghost" size="sm" onClick={() => remove(i)} disabled={fields.length === 1}>×</Btn>
          </div>))}</div>
        {errors.ingredients && <span className="text-xs text-terra-dark">{errors.ingredients.message ?? 'Periksa bahan'}</span>}
        <Btn variant="soft" size="sm" className="mt-2" onClick={() => append({ ingredientId: ings[0]?.id ?? '', amount: 100 })}>+ Bahan</Btn>
      </Card>
      <Field label="Langkah (satu per baris)"><textarea rows={5} className="input" {...register('steps')} />{errors.steps && <span className="text-xs text-terra-dark">{errors.steps.message}</span>}</Field>
      <Field label="Kata kunci YouTube (opsional)"><input className="input" {...register('youtubeQuery')} /></Field>
      <Btn type="submit" className="w-full">Simpan resep</Btn>
    </form>
  );
}

/* ============ Cook With What I Have ============ */
export function CookWithPage() {
  const { ctx, data, today } = useApp();
  const ings = [...ctx.ingredients.values()].filter((i) => i.buyable !== false && i.category !== 'bumbu' && i.category !== 'pantry').sort((a, b) => a.name.localeCompare(b.name));
  const [have, setHave] = useState<HaveItem[]>([]);
  const [pick, setPick] = useState(ings[0]?.id ?? '');
  const [amt, setAmt] = useState(500);
  const [portions, setPortions] = useState(4);
  const [meal, setMeal] = useState<'any' | 'sarapan_ibu' | 'siang_ibu' | 'malam' | 'anak'>('any');
  const results = useMemo(() => (have.length ? cookWithWhatIHave(have, ctx, { portions, meal }) : []), [have, ctx, portions, meal]);
  const fromPantry = () => {
    const m = stockByIngredient(data.pantry, ctx, today);
    setHave([...m.entries()].filter(([, v]) => v > 0).map(([ingredientId, amount]) => ({ ingredientId, amount })));
  };
  const groups = ['READY TO COOK', 'ALMOST READY', 'NEED MORE INGREDIENTS'] as const;
  return (
    <div className="space-y-3">
      <PageHeader title="Cook With What I Have" sub="Bumbu & bahan pantry dianggap ada" />
      <Card title="Bahan yang ada (jumlah kotor)">
        <div className="flex gap-2">
          <select aria-label="Bahan" className="input flex-1" value={pick} onChange={(e) => setPick(e.target.value)}>{ings.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select>
          <input aria-label="Jumlah dimiliki" type="number" className="input !w-24" value={amt} onChange={(e) => setAmt(Number(e.target.value) || 0)} />
          <Btn onClick={() => setHave((h) => [...h.filter((x) => x.ingredientId !== pick), { ingredientId: pick, amount: amt }])}>Tambah</Btn>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">{have.map((h) => <button key={h.ingredientId} type="button" className="chip" onClick={() => setHave(have.filter((x) => x !== h))}>{ctx.ingredients.get(h.ingredientId)?.name} {h.amount} ×</button>)}</div>
        <Btn variant="soft" size="sm" className="mt-2" onClick={fromPantry}>Isi dari stok Pantry terkonfirmasi</Btn>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label="Porsi dewasa"><input type="number" min={1} className="input" value={portions} onChange={(e) => setPortions(Number(e.target.value) || 1)} /></Field>
          <Field label="Untuk"><select className="input" value={meal} onChange={(e) => setMeal(e.target.value as typeof meal)}><option value="any">Semua</option><option value="sarapan_ibu">Sarapan ibu</option><option value="siang_ibu">Siang ibu</option><option value="malam">Malam keluarga</option><option value="anak">Anak</option></select></Field>
        </div>
      </Card>
      {have.length === 0 && <Empty title="Tambahkan bahan untuk melihat rekomendasi" />}
      {groups.map((g) => {
        const rows = results.filter((x) => x.category === g);
        if (!rows.length) return null;
        return (
          <Card key={g} title={`${g} (${rows.length})`}>
            <ul className="space-y-3">{rows.slice(0, 8).map((m) => (
              <li key={m.recipe.id} className="text-sm">
                <div className="flex items-center justify-between gap-2"><Link className="font-semibold underline" to={`/dapur/resep/${m.recipe.id}`}>{m.recipe.name}</Link><GlutenBadge status={m.gluten} /></div>
                <div className="text-xs text-charcoal/60">±{m.timeMin} mnt · untuk {m.recipients.map((x) => MEMBER_LABEL[x]).join(', ') || '—'} · {m.saving}</div>
                {m.missing.length > 0 && <ul className="mt-1 text-xs text-terra-dark">{m.missing.map((x) => <li key={x.ingredientId}>Kurang {x.name}: {fmtQty(x.short, x.unit)}{x.cost !== null ? ` (±${rupiah(x.cost)})` : ' (harga belum diisi)'}
                  {substitutesFor(x.ingredientId, ctx, m.recipients.length ? m.recipients : ['ibu']).slice(0, 2).map((s) => <span key={s.id} className="ml-1 text-sage-dark">• ganti {s.name}</span>)}</li>)}</ul>}
              </li>))}</ul>
          </Card>
        );
      })}
      <Badge tone="muted">Rekomendasi sudah menyaring pantangan anggota penerima</Badge>
    </div>
  );
}
