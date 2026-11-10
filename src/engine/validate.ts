import type { DayPlan, Issue, Member, Recipe, RequiredDishConfig, SeafoodEvent } from '../types';
import type { Ctx } from './context';
import { addDaysStr, diffDays, groupByWeek, isWeekend, longDate, shortDate } from './calendar';
import { checkRecipeForMember } from './restrictions';
import { occasionsForDay } from './portions';

export interface WeekReport {
  start: string;
  dates: string[];
  partial: boolean;
  ayam: boolean;
  telurIbu: boolean;
  telurLain: boolean;
  ikan: boolean;
  ironRich: boolean;
  ayahEggDays: string[];
  ayahLeleDays: string[];
  hatiAnak: number;
}

export interface RequiredStatus {
  id: RequiredDishConfig['id'];
  label: string;
  count: number;
  min: number;
  ok: boolean;
  dates: string[];
}

export interface PlanReport {
  issues: Issue[];
  weeks: WeekReport[];
  sapiAnakDates: string[];
  sapiKeluargaDates: string[];
  required: RequiredStatus[];
  seafoodDates: { date: string; type: 'udang' | 'cumi' }[];
  errors: number;
  warnings: number;
  ok: boolean;
}

export interface ValidateOpts {
  history?: SeafoodEvent[];
  /** hari sebelum periode (untuk cek berurutan lintas periode) */
  prevDay?: DayPlan;
}

const rec = (ctx: Ctx, id: string): Recipe | undefined => ctx.recipes.get(id);

export function speciesOfRecipe(recipe: Recipe, ctx: Ctx): string[] {
  const s = new Set<string>();
  for (const ri of recipe.ingredients) {
    const sp = ctx.ingredients.get(ri.ingredientId)?.species;
    if (sp) s.add(sp);
  }
  return [...s];
}

/** Lauk (utama) yang dimakan anggota pada hari tertentu. */
export function laukOfMember(day: DayPlan, member: Member, ctx: Ctx): Recipe[] {
  const out: Recipe[] = [];
  for (const o of occasionsForDay(day, ctx)) {
    if (o.member !== member) continue;
    for (const it of o.items) {
      if (it.kind !== 'lauk') continue;
      const r = rec(ctx, it.recipeId);
      if (r) out.push(r);
    }
  }
  return out;
}

export function isSeafoodRecipe(r: Recipe): 'udang' | 'cumi' | null {
  return r.protein === 'udang' ? 'udang' : r.protein === 'cumi' ? 'cumi' : null;
}

export function validatePlan(days: DayPlan[], ctx: Ctx, opts: ValidateOpts = {}): PlanReport {
  const issues: Issue[] = [];
  const push = (i: Issue) => issues.push(i);
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const seenViolation = new Set<string>();

  // ===== Per hari =====
  for (const day of sorted) {
    const weekend = isWeekend(day.date);
    const A = rec(ctx, day.mainA);
    const B = rec(ctx, day.mainB);
    const V = rec(ctx, day.veg);
    const R = rec(ctx, day.rice);
    if (!A) push({ code: 'resep_hilang', severity: 'error', date: day.date, slot: 'mainA', message: `${longDate(day.date)}: resep lauk A/pagi-siang tidak ditemukan.` });
    if (!B) push({ code: 'resep_hilang', severity: 'error', date: day.date, slot: 'mainB', message: `${longDate(day.date)}: resep lauk malam tidak ditemukan.` });
    if (!V || V.role !== 'sayur') push({ code: 'sayur_hilang', severity: 'error', date: day.date, slot: 'veg', message: `${longDate(day.date)}: wajib ada tepat satu masakan sayur per hari.` });
    if (!R || R.role !== 'nasi') push({ code: 'nasi_anak_hilang', severity: 'error', date: day.date, slot: 'rice', message: `${longDate(day.date)}: nasi anak harian belum dipilih.` });
    if (weekend && day.mainA === day.mainB) {
      push({ code: 'weekend_a_sama_b', severity: 'error', date: day.date, slot: 'mainB', message: `${longDate(day.date)}: lauk A (pagi-siang) dan lauk B (malam) harus berbeda.` });
    }
    if (day.sides.length > 2) push({ code: 'terlalu_banyak_pendamping', severity: 'warning', date: day.date, message: `${longDate(day.date)}: pendamping terlalu banyak.` });
    if (ctx.prefs.motherBreakfastEggs !== 1) {
      push({ code: 'telur_ibu_bukan_1', severity: 'info', date: day.date, member: 'ibu', message: `Preferensi telur sarapan ibu = ${ctx.prefs.motherBreakfastEggs} butir (default 1).` });
    }

    // aturan per anggota
    for (const o of occasionsForDay(day, ctx)) {
      for (const it of o.items) {
        const r = rec(ctx, it.recipeId);
        if (!r) continue;
        const asMain = it.kind === 'lauk';
        const viol = checkRecipeForMember(r, o.member, ctx, { weekend, asMain });
        for (const v of viol) {
          if (v.level === 'info') continue;
          const key = `${day.date}|${v.code}|${r.id}|${o.member}`;
          if (seenViolation.has(key)) continue;
          seenViolation.add(key);
          const slot = it.recipeId === day.mainA ? 'mainA' : it.recipeId === day.mainB ? 'mainB' : it.kind === 'sayur' ? 'veg' : undefined;
          push({
            code: v.code, severity: v.level === 'hard' ? 'error' : 'warning', date: day.date, member: o.member, recipeId: r.id, slot,
            message: `${longDate(day.date)} (${o.member}): ${v.message}`,
          });
        }
      }
    }

    // ibu: dua telur ceplok sehari
    const ibuCeplok = laukOfMember(day, 'ibu', ctx).filter((r) => r.id === 'telur-ceplok').length;
    if (ibuCeplok > 0) {
      push({ code: 'dua_ceplok_ibu', severity: 'warning', date: day.date, member: 'ibu', message: `${longDate(day.date)}: ibu mendapat telur ceplok tambahan di luar sarapan.` });
    }

    // waktu sesi weekend
    if (weekend && A && B) {
      const minutes = [A, B, V].reduce((s, r) => s + (r ? r.prepMin + r.cookMin : 0), 0) + 5;
      if (minutes > ctx.prefs.maxWeekendSessionMin) {
        push({ code: 'sesi_weekend_terlalu_lama', severity: 'warning', date: day.date, message: `${longDate(day.date)}: estimasi sesi memasak ±${minutes} menit (batas ${ctx.prefs.maxWeekendSessionMin}).` });
      }
    }
    if (A?.role === 'pendamping' || B?.role === 'pendamping') {
      push({ code: 'pendamping_jadi_utama', severity: 'error', date: day.date, message: `${longDate(day.date)}: resep pendamping dipakai sebagai lauk utama.` });
    }
  }

  // ===== Berurutan =====
  const seq = opts.prevDay ? [opts.prevDay, ...sorted] : sorted;
  for (let i = 1; i < seq.length; i++) {
    const p = seq[i - 1];
    const c = seq[i];
    if (diffDays(c.date, p.date) !== 1) continue;
    const pl = new Set([p.mainA, p.mainB]);
    for (const [slot, id] of [['mainA', c.mainA], ['mainB', c.mainB]] as const) {
      if (pl.has(id) && sorted.includes(c)) {
        push({ code: 'lauk_identik_berurutan', severity: 'error', date: c.date, slot, recipeId: id, message: `${longDate(c.date)}: lauk "${rec(ctx, id)?.name ?? id}" sama dengan hari sebelumnya.` });
      }
    }
    if (p.veg === c.veg && sorted.includes(c)) {
      push({ code: 'sayur_identik_berurutan', severity: 'error', date: c.date, slot: 'veg', recipeId: c.veg, message: `${longDate(c.date)}: sayur "${rec(ctx, c.veg)?.name ?? c.veg}" sama dengan hari sebelumnya.` });
    }
  }

  // ===== Mingguan =====
  const weeks: WeekReport[] = [];
  for (const g of groupByWeek(sorted.map((d) => d.date))) {
    const wd = sorted.filter((d) => g.dates.includes(d.date));
    const lauk = wd.flatMap((d) => [rec(ctx, d.mainA), rec(ctx, d.mainB)]).filter((r): r is Recipe => !!r);
    const ayahEggDays: string[] = [];
    const ayahLeleDays: string[] = [];
    let hati = 0;
    let iron = false;
    for (const d of wd) {
      const ayahLauk = laukOfMember(d, 'ayah', ctx);
      if (ayahLauk.some((r) => r.protein === 'telur')) ayahEggDays.push(d.date);
      if (ayahLauk.some((r) => speciesOfRecipe(r, ctx).includes('lele'))) ayahLeleDays.push(d.date);
      const anakLauk = laukOfMember(d, 'anak', ctx);
      if (anakLauk.some((r) => r.ironRich)) iron = true;
      if (anakLauk.some((r) => r.protein === 'hati')) hati += 1;
    }
    const w: WeekReport = {
      start: g.start, dates: g.dates, partial: g.partial,
      ayam: lauk.some((r) => r.protein === 'ayam'),
      telurIbu: ctx.prefs.motherBreakfastEggs > 0,
      telurLain: lauk.some((r) => r.protein === 'telur'),
      ikan: lauk.some((r) => r.protein === 'ikan'),
      ironRich: iron, ayahEggDays, ayahLeleDays, hatiAnak: hati,
    };
    weeks.push(w);
    const sev = (full: Issue['severity']): Issue['severity'] => (g.partial ? 'info' : full);
    const tag = g.partial ? ' (PARTIAL WEEK)' : '';
    const wk = `minggu ${shortDate(g.start)}`;
    if (!w.ayam) push({ code: 'minggu_tanpa_ayam', severity: sev('error'), week: g.start, message: `${wk}${tag}: belum ada menu ayam.` });
    if (!w.telurIbu && !w.telurLain) push({ code: 'minggu_tanpa_telur', severity: sev('error'), week: g.start, message: `${wk}${tag}: belum ada telur.` });
    if (!w.ikan) push({ code: 'minggu_tanpa_ikan', severity: sev('error'), week: g.start, message: `${wk}${tag}: belum ada menu ikan.` });
    if (!w.telurLain) push({ code: 'minggu_tanpa_telur_keluarga', severity: 'info', week: g.start, message: `${wk}${tag}: sebaiknya ada menu telur yang bisa dinikmati anggota lain.` });
    if (!w.ironRich) push({ code: 'minggu_tanpa_zat_besi', severity: sev('error'), week: g.start, member: 'anak', message: `${wk}${tag}: belum ada lauk kaya zat besi untuk anak.` });
    if (ayahEggDays.length > 2) push({ code: 'ayah_telur_lebih_2', severity: 'error', week: g.start, member: 'ayah', message: `${wk}: ayah mendapat menu telur ${ayahEggDays.length} hari (maks. 2).` });
    for (let i = 1; i < ayahEggDays.length; i++) {
      if (diffDays(ayahEggDays[i], ayahEggDays[i - 1]) === 1) {
        push({ code: 'ayah_telur_berturut', severity: 'error', week: g.start, date: ayahEggDays[i], member: 'ayah', message: `${longDate(ayahEggDays[i])}: menu telur ayah pada hari berturut-turut.` });
      }
    }
    if (ayahLeleDays.length > 1) push({ code: 'ayah_lele_lebih_1', severity: 'error', week: g.start, member: 'ayah', message: `${wk}: lele ayah ${ayahLeleDays.length}x (maks. 1x/minggu).` });
    if (hati > 1) push({ code: 'hati_terlalu_sering', severity: 'warning', week: g.start, member: 'anak', message: `${wk}: hati ayam untuk anak ${hati}x; jaga porsi kecil dan jarang (tinggi vitamin A).` });
  }
  // lintas pekan: hati anak <=1 per 7 hari bergulir
  const hatiDates = sorted.filter((d) => laukOfMember(d, 'anak', ctx).some((r) => r.protein === 'hati')).map((d) => d.date);
  for (let i = 1; i < hatiDates.length; i++) {
    if (diffDays(hatiDates[i], hatiDates[i - 1]) < 4) push({ code: 'hati_berdekatan', severity: 'warning', date: hatiDates[i], member: 'anak', message: `${longDate(hatiDates[i])}: hati untuk anak terlalu berdekatan dengan sebelumnya.` });
  }

  // ===== Bulanan / siklus =====
  const sapiAnakDates = sorted.filter((d) => laukOfMember(d, 'anak', ctx).some((r) => r.protein === 'sapi')).map((d) => d.date);
  const sapiKeluargaDates = sorted
    .filter((d) => {
      const dinner = [d.mainB];
      if (isWeekend(d.date)) dinner.push(d.mainA);
      return dinner.some((id) => rec(ctx, id)?.protein === 'sapi');
    })
    .map((d) => d.date);
  if (sorted.length >= 28) {
    if (sapiAnakDates.length < 2) push({ code: 'sapi_anak_kurang', severity: 'error', member: 'anak', message: `Daging sapi anak ${sapiAnakDates.length}/2 dalam siklus.` });
    if (sapiKeluargaDates.length < 1) push({ code: 'sapi_keluarga_kurang', severity: 'error', message: 'Daging sapi keluarga 0/1 dalam siklus.' });
  } else if (sorted.length > 0) {
    push({ code: 'siklus_parsial', severity: 'info', message: `Rentang ${sorted.length} hari: target bulanan (sapi, menu wajib) tidak dinilai penuh.` });
  }
  const required = requiredChecklist(sorted, ctx);
  if (sorted.length >= 28) {
    for (const r of required.filter((x) => !x.ok)) {
      push({ code: 'menu_wajib_kurang', severity: 'error', message: `Menu wajib "${r.label}" ${r.count}/${r.min}.` });
    }
  }

  // ===== Seafood anak =====
  const seafoodDates: PlanReport['seafoodDates'] = [];
  for (const d of sorted) {
    const found = laukOfMember(d, 'anak', ctx).map(isSeafoodRecipe).find((x) => x);
    if (found) seafoodDates.push({ date: d.date, type: found });
  }
  const start = sorted[0]?.date;
  const end = sorted[sorted.length - 1]?.date;
  if (start && end && sorted.length >= 14) {
    const lastHist = [...(opts.history ?? [])].filter((h) => h.date < start).sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
    const dates = seafoodDates.map((s) => s.date);
    const chain = lastHist ? [lastHist, ...dates] : dates;
    for (let i = 1; i < chain.length; i++) {
      const gap = diffDays(chain[i], chain[i - 1]);
      if (gap > 14) push({ code: 'seafood_lebih_14', severity: 'error', member: 'anak', date: chain[i], message: `Seafood anak: jarak ${gap} hari menuju ${shortDate(chain[i])} (maks. 14 hari).` });
    }
    const last = chain[chain.length - 1];
    if (last === undefined) {
      push({ code: 'seafood_belum_ada', severity: 'error', member: 'anak', message: 'Belum ada udang/cumi untuk anak dalam rentang ini.' });
    } else if (diffDays(end, last) >= 14) {
      push({ code: 'seafood_terlewat', severity: 'error', member: 'anak', message: `Seafood terakhir ${shortDate(last)}; jatuh tempo ${shortDate(addDaysStr(last, 14))} sebelum periode berakhir.` });
    }
    if (!lastHist && dates.length) push({ code: 'seafood_tanpa_riwayat', severity: 'info', member: 'anak', message: 'Tidak ada riwayat seafood sebelum periode; jarak dari seafood terakhir sebelum periode tidak dapat dinilai.' });
  }

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  return { issues, weeks, sapiAnakDates, sapiKeluargaDates, required, seafoodDates, errors, warnings, ok: errors === 0 };
}

export function requiredChecklist(days: DayPlan[], ctx: Ctx): RequiredStatus[] {
  return ctx.prefs.requiredDishes.map((cfg) => {
    const dates = days
      .filter((d) => [d.mainA, d.mainB].some((id) => rec(ctx, id)?.requiredDish === cfg.id))
      .map((d) => d.date);
    return { id: cfg.id, label: cfg.label, count: dates.length, min: cfg.minPerCycle, ok: dates.length >= cfg.minPerCycle, dates };
  });
}

/** Mother Egg Tracker: telur sarapan, telur tambahan dari menu keluarga, total terencana. */
export function eggTracker(days: DayPlan[], ctx: Ctx, eaten: Record<string, number> = {}) {
  let breakfast = 0;
  let extra = 0;
  const extraDates: { date: string; eggs: number; from: string }[] = [];
  for (const d of days) {
    breakfast += ctx.prefs.motherBreakfastEggs;
    for (const o of occasionsForDay(d, ctx).filter((x) => x.member === 'ibu' && x.slot !== 'sarapan')) {
      for (const it of o.items) {
        if (it.kind !== 'lauk') continue;
        const r = rec(ctx, it.recipeId);
        if (!r) continue;
        const eggs = r.ingredients.filter((ri) => ctx.ingredients.get(ri.ingredientId)?.tags?.includes('telur') && r.protein === 'telur')
          .reduce((s, ri) => s + ri.amount / r.serves, 0);
        if (eggs > 0) {
          extra += eggs;
          extraDates.push({ date: d.date, eggs, from: r.name });
        }
      }
    }
  }
  const actual = days.reduce((s, d) => s + (eaten[d.date] ?? 0), 0);
  return { breakfast, extra: Math.round(extra * 10) / 10, planned: Math.round((breakfast + extra) * 10) / 10, actual, extraDates };
}
