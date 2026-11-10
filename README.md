# HOME TABLE — Family Meal Planner & Smart Kitchen
*Plan Smart, Cook Happy, Eat Better.*

Aplikasi web (PWA) berbahasa Indonesia untuk merencanakan menu keluarga (Ibu, Ayah, Anak 3 th 6 bln), daftar belanja, budget, pantry, bumbu dasar, food prep, dan jurnal makan balita. **Tanpa login, tanpa API berbayar, semua data tersimpan lokal di browser (IndexedDB).**

Stack: React + TypeScript + Vite, Tailwind, Lucide, date-fns, Recharts, React Hook Form + Zod, Dexie/IndexedDB, vite-plugin-pwa, Vitest + Testing Library. Hosting: Netlify (statis).

## Menjalankan lokal
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest
npm run build      # tsc + vite build → dist/
npm run preview
```
Butuh Node 18+ (disarankan 20).

## Status fitur (jujur)

**Selesai & diuji otomatis (69 tes Vitest, lulus pada build ini):**
- Mesin aturan keluarga: pantangan Ayah, alergi gluten & tidak pedas untuk Anak, telur Ibu 1×/sarapan, jadwal makan weekday/weekend, aturan tidak berulang hari berurutan, 6 menu wajib bulanan, sapi ≥2×/siklus anak, zat besi mingguan, seafood ≤14 hari, maks. sesi masak.
- Seed 30 hari (9 Nov – 8 Des 2026) dapat diedit; 0 pelanggaran aturan keras.
- Generator menu (4 mode: Variasi Baru, Paling Hemat, Menu Favorit, Habiskan Stok), deterministik per seed, hari terkunci dipertahankan, konteks lintas periode; Smart Budget Optimizer; pratinjau → setujui → rencana lama diarsipkan.
- Laporan **NO FULLY FEASIBLE PLAN** dengan alasan & alternatif bila budget mustahil; porsi anak tidak pernah dikurangi otomatis.
- Meal Plan (hari/minggu/bulan), edit menu (menolak simpan jika melanggar aturan baru), ganti menu dengan selisih biaya, kunci hari, validasi mingguan.
- Grocery: dari rencana, kurangi stok terkonfirmasi, pembulatan kemasan, harga manual/aktual, uang tunai terpisah dari nilai konsumsi, cetak/PDF (dialog cetak browser), WhatsApp (tautan wa.me), item manual.
- Pantry (FEFO, kedaluwarsa, konfirmasi aman), stok contoh **tidak aktif sebelum dikonfirmasi**, stok hanya berkurang saat "Selesai masak".
- Smart Bumbu Prep, Food Prep, Cooking Assistant, Cook With What I Have (READY/ALMOST/NEED MORE + pengganti).
- Recipe Library (cari, filter, favorit, resep buatan sendiri dengan validasi Zod), tautan pencarian YouTube.
- Balita: Nutrition, Energy Rice, Food Journal, Growth Tracker (grafik Recharts, tanpa data WHO palsu); Mother Egg Tracker.
- Backup/restore JSON tervalidasi Zod (tolak file rusak/versi lebih baru tanpa mengubah data), reset, hapus semua data.
- PWA (manifest + service worker), build produksi berhasil (`npm run build`).

**Sebagian / perlu Anda perhatikan:**
- **Harga bahan adalah ESTIMASI pengembang**, bukan harga pasar. Ubah di Pengaturan › Harga bahan. Dengan harga awal, seed 30 hari menghasilkan satu minggu di atas Rp300.000 (23–29 Nov ≈ Rp323rb); minggu lain di bawah target. Aplikasi menandainya (BUDGET OVER LIMIT), tidak menyembunyikannya.
- Seed menghasilkan 17 peringatan "perlu verifikasi" (mis. label kecap/tepung/kaldu bubuk harus dicek bebas gluten; seafood anak belum ditandai aman sampai Anda mencentang di Pengaturan).
- Netlify Function pencarian YouTube (`netlify/functions/youtube-search.ts`) **belum diuji terhadap YouTube API sungguhan** (tanpa kunci/jaringan saat pengembangan). Tanpa kunci aplikasi tetap berfungsi dengan tautan pencarian.
- Tes UI berupa smoke test (render, navigasi, form utama), bukan cakupan penuh setiap interaksi.
- PWA diuji sebatas build + browser desktop (Chromium, viewport 390 px). **Belum diuji di perangkat Android sungguhan** (instal, offline).
- Resep, takaran, dan waktu masak adalah data bawaan yang masuk akal, bukan hasil ulasan ahli gizi/chef. Informasi gizi bersifat umum, bukan saran medis.

**Belum ada / di luar cakupan:**
- Sinkronisasi antar perangkat/akun (data per-browser; gunakan backup JSON untuk pindah perangkat).
- Kurva pertumbuhan WHO, hitungan kalori, notifikasi push, pengenalan harga otomatis.
- Audit aksesibilitas penuh.
- **Deployment belum dilakukan** — tidak ada URL; Anda men-deploy sendiri (lihat di bawah).

## Deploy ke Netlify (via GitHub)
1. Buat repo GitHub baru, lalu dari folder proyek:
   ```bash
   git init && git add . && git commit -m "HOME TABLE"
   git branch -M main
   git remote add origin https://github.com/<akun-anda>/home-table.git
   git push -u origin main
   ```
2. Di Netlify: **Add new site → Import an existing project → GitHub** → pilih repo. Pengaturan terbaca dari `netlify.toml` (build `npm run build`, publish `dist`, redirect SPA `/* → /index.html` 200).
3. (Opsional, pencarian YouTube via API) Site configuration → Environment variables → tambah `YOUTUBE_API_KEY` (**tanpa awalan `VITE_`**). Kunci hanya dibaca Netlify Function di server.
4. Deploy. Atau tanpa GitHub: `npm run build` lalu seret folder `dist` ke Netlify Drop (fungsi server tidak ikut dengan cara ini).

## Pasang di Android
Buka URL situs di Chrome Android → menu ⋮ → **Instal aplikasi / Tambahkan ke layar utama**. Aplikasi berjalan standalone. Data tetap di perangkat itu; unduh backup dari **Settings › Backup** secara berkala. Menghapus data situs di Chrome menghapus data aplikasi.

## Struktur
```
src/engine/   aturan, validasi, generator, belanja, budget, pantry, bumbu, masak, balita
src/data/     bahan, resep, bumbu, seed 30 hari
src/db/       Dexie (skema v1), seed, backup/restore (Zod)
src/state/    AppProvider (write-through ke IndexedDB)
src/ui/       halaman & komponen
src/test/     Vitest (aturan, engine, generator, DB, integrasi, UI smoke, deployment)
netlify/functions/youtube-search.ts
```

## Catatan data & aturan
- Jumlah di resep adalah berat **bersih (edible)**; belanja = bersih ÷ persentase dapat dimakan, dibulatkan ke kemasan.
- Yang dihitung budget: ayam, telur, ikan, udang, cumi, sapi, hati/ampela, tahu/tempe, sayur, kentang, santan. Tidak dihitung: beras, minyak, butter, bumbu, kecap, tepung, dll.
- Harga kosong ≠ Rp0: total ditandai PRICE INCOMPLETE.
- Aturan keluarga tertanam di `src/engine/*` dan `src/data/seed.ts`; ubah di sana jika keluarga berubah.
