import { useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { BUDGET_PRESETS } from '../../data/seed';
import { backupFileName, exportAll, importAll, validateBackup } from '../../db/backup';
import { clearUserData, resetDemoData } from '../../db/seedDb';
import { rupiah } from '../../engine/units';
import { Badge, Btn, Card, Field, PageHeader } from '../components/kit';
import { downloadText } from '../helpers';

export default function SettingsPage() {
  const { db, data, ctx, today, saveSettings, save, reload, toast } = useApp();
  const s = data.settings;
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const num = (v: string) => Math.max(0, Number(v) || 0);

  const doExport = async () => {
    const b = await exportAll(db);
    downloadText(backupFileName(), JSON.stringify(b, null, 2));
    toast('Backup diunduh.');
  };
  const doImport = async (f?: File) => {
    if (!f) return;
    let raw: unknown;
    try { raw = JSON.parse(await f.text()); } catch { setMsg(['File bukan JSON yang valid.']); return; }
    const chk = validateBackup(raw);
    if (!chk.ok || !chk.backup) { setMsg(chk.errors); return; }
    const total = Object.values(chk.counts).reduce((a, b) => a + b, 0);
    if (!window.confirm(`Backup valid (${total} baris). Impor akan MENIMPA semua data saat ini. Lanjutkan?`)) return;
    await importAll(db, chk.backup);
    await reload();
    setMsg([]);
    toast('Backup berhasil dipulihkan.');
  };
  const ings = [...ctx.ingredients.values()].filter((i) => i.buyable !== false && i.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" />
      <Card title="Keluarga">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nama ibu"><input className="input" value={s.profile.ibu.name} onChange={(e) => saveSettings((x) => ({ ...x, profile: { ...x.profile, ibu: { name: e.target.value } } }))} /></Field>
          <Field label="Nama ayah"><input className="input" value={s.profile.ayah.name} onChange={(e) => saveSettings((x) => ({ ...x, profile: { ...x.profile, ayah: { name: e.target.value } } }))} /></Field>
          <Field label="Nama anak"><input className="input" value={s.profile.anak.name} onChange={(e) => saveSettings((x) => ({ ...x, profile: { ...x.profile, anak: { ...x.profile.anak, name: e.target.value } } }))} /></Field>
          <Field label="Tgl lahir anak" hint={s.profile.anak.birthDateApprox ? 'Perkiraan — ubah ke tanggal sebenarnya' : undefined}><input type="date" className="input" value={s.profile.anak.birthDate} onChange={(e) => saveSettings((x) => ({ ...x, profile: { ...x.profile, anak: { ...x.profile.anak, birthDate: e.target.value, birthDateApprox: false } } }))} /></Field>
          <Field label="Faktor porsi anak"><input type="number" step="0.05" min={0.2} max={1} className="input" value={s.profile.childPortionFactor} onChange={(e) => saveSettings((x) => ({ ...x, profile: { ...x.profile, childPortionFactor: Math.min(1, Math.max(0.2, Number(e.target.value) || 0.5)) } }))} /></Field>
        </div>
        <div className="mt-2 space-y-1 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={s.profile.seafoodKnownSafe.udang} onChange={(e) => saveSettings((x) => ({ ...x, profile: { ...x.profile, seafoodKnownSafe: { ...x.profile.seafoodKnownSafe, udang: e.target.checked } } }))} /> Udang sudah pernah dimakan anak tanpa reaksi</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={s.profile.seafoodKnownSafe.cumi} onChange={(e) => saveSettings((x) => ({ ...x, profile: { ...x.profile, seafoodKnownSafe: { ...x.profile.seafoodKnownSafe, cumi: e.target.checked } } }))} /> Cumi sudah pernah dimakan anak tanpa reaksi</label>
        </div>
        <p className="mt-2 text-xs text-charcoal/60">Aturan keluarga (alergi gluten, pantangan ayah, jadwal masak) tertanam di mesin aturan dan tidak bisa dimatikan dari sini.</p>
      </Card>

      <Card title="Budget & uang tunai">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Mode"><select className="input" value={s.prefs.budgetMode} onChange={(e) => { const m = e.target.value as typeof s.prefs.budgetMode; saveSettings((x) => ({ ...x, prefs: { ...x.prefs, budgetMode: m, weeklyBudget: m === 'CUSTOM' ? x.prefs.weeklyBudget : BUDGET_PRESETS[m] } })); }}>
            <option value="HEMAT">HEMAT {rupiah(BUDGET_PRESETS.HEMAT)}</option><option value="NORMAL">NORMAL {rupiah(BUDGET_PRESETS.NORMAL)}</option><option value="FLEKSIBEL">FLEKSIBEL {rupiah(BUDGET_PRESETS.FLEKSIBEL)}</option><option value="CUSTOM">Custom</option></select></Field>
          <Field label="Budget / minggu"><input type="number" className="input" value={s.prefs.weeklyBudget} onChange={(e) => saveSettings((x) => ({ ...x, prefs: { ...x.prefs, budgetMode: 'CUSTOM', weeklyBudget: num(e.target.value) } }))} /></Field>
          <Field label="Strategi"><select className="input" value={s.prefs.budgetStrategy} onChange={(e) => saveSettings((x) => ({ ...x, prefs: { ...x.prefs, budgetStrategy: e.target.value as typeof s.prefs.budgetStrategy } }))}><option value="FIXED_WEEKLY">Tetap per minggu</option><option value="MONTHLY_AVERAGE">Rata-rata bulanan</option></select></Field>
          <Field label="Uang tunai saat ini"><input type="number" className="input" value={s.cash.amount} onChange={(e) => saveSettings((x) => ({ ...x, cash: { amount: num(e.target.value), updated: today } }))} /></Field>
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={s.prefs.beefReserveOn} onChange={(e) => saveSettings((x) => ({ ...x, prefs: { ...x.prefs, beefReserveOn: e.target.checked } }))} /> Cadangan daging sapi bulanan</label>
        <p className="mt-1 text-xs text-charcoal/60">Rp125.000 hanya contoh awal uang tunai. Ubah sesuai kondisi sebenarnya.</p>
      </Card>

      <Card title="Harga bahan (estimasi, dapat diubah)">
        <input aria-label="Cari bahan" className="input mb-2" placeholder="Cari bahan…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="max-h-80 divide-y divide-beige/60 overflow-y-auto text-sm">{ings.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-2 py-1.5">
            <span className="min-w-0"><span className="block truncate">{i.name}</span><span className="text-[11px] text-charcoal/55">per {i.packSize} {i.unit} · {i.priceStatus}{i.inBudget ? '' : ' · di luar budget'}</span></span>
            <input aria-label={`Harga ${i.name}`} type="number" min={0} placeholder="kosong" className="input !min-h-0 !w-28 !py-1" value={i.packPrice ?? ''} onChange={(e) => save('ingredients', { ...i, packPrice: e.target.value === '' ? null : num(e.target.value), priceStatus: e.target.value === '' ? 'kosong' : 'aktual', priceUpdated: today })} />
          </li>))}</ul>
        <p className="mt-2 text-[11px] text-charcoal/55">Harga awal adalah ESTIMASI pengembang, bukan harga pasar terverifikasi. Kosongkan jika belum tahu — total akan ditandai PRICE INCOMPLETE, bukan dianggap Rp0.</p>
      </Card>

      <Card title="Backup & pulihkan">
        <p className="mb-2 text-xs text-charcoal/60">Data hanya tersimpan di browser perangkat ini (IndexedDB) dan tidak tersinkron antar perangkat. Lakukan backup berkala.</p>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={doExport}>Unduh backup (.json)</Btn>
          <Btn variant="soft" onClick={() => file.current?.click()}>Impor backup</Btn>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" aria-label="Berkas backup" onChange={(e) => { void doImport(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {msg.length > 0 && <ul className="mt-2 list-disc rounded-xl bg-terra-light p-3 pl-7 text-xs text-terra-dark">{msg.map((m, i) => <li key={i}>{m}</li>)}</ul>}
      </Card>

      <Card title="Data">
        <div className="flex flex-wrap gap-2">
          <Btn variant="ghost" onClick={async () => { if (window.confirm('Reset ke data contoh? Semua perubahan Anda akan hilang. Unduh backup dulu.')) { await resetDemoData(db); await reload(); toast('Data contoh dipulihkan.'); } }}>Reset ke data contoh</Btn>
          <Btn variant="danger" onClick={async () => { if (window.confirm('Hapus SEMUA data pribadi (jurnal, stok, pertumbuhan, rencana)? Tidak bisa dibatalkan.') && window.confirm('Yakin? Ini penghapusan permanen.')) { await clearUserData(db); await reload(); toast('Semua data pribadi dihapus.'); } }}>Hapus semua data</Btn>
        </div>
      </Card>

      <Card title="Status & keterbatasan">
        <ul className="list-disc space-y-1 pl-5 text-xs text-charcoal/75">
          <li>Berjalan tanpa login dan tanpa API berbayar; semua data lokal.</li>
          <li>Harga bahan adalah estimasi; tidak ada harga real-time.</li>
          <li>Status gluten/seafood: bahan olahan ditandai "perlu verifikasi" — cek label kemasan.</li>
          <li>Bukan nasihat medis. Konsultasikan alergi dan tumbuh kembang ke dokter.</li>
          <li>Pencarian YouTube via API hanya aktif jika fungsi Netlify + kunci server dikonfigurasi; tautan pencarian selalu tersedia.</li>
        </ul>
        <div className="mt-2 flex gap-1"><Badge>Skema v1</Badge><Badge>{data.recipes.length} resep</Badge><Badge>{data.ingredients.length} bahan</Badge></div>
      </Card>
    </div>
  );
}
