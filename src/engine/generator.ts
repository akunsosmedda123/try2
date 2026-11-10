import type { DayPlan, GeneratorMode, Member, PantryItem, Recipe, SeafoodEvent } from '../types';
import type { Ctx } from './context';
import { addDaysStr, diffDays, groupByWeek, isWeekend, weekStart } from './calendar';
import { budgetReport, describeInfeasible, type BudgetReport, type Infeasible } from './budget';
import { stockByIngredient } from './pantry';
import { recipeRequirement } from './requirements';
import { checkRecipeForMember } from './restrictions';
import { unitPrice } from './grocery';
import { isSeafoodRecipe, speciesOfRecipe, validatePlan, type PlanReport } from './validate';

type Slot = 'A' | 'B';

export interface GenInput {
  ctx: Ctx;
  /** tanggal yang akan DIBUAT (urut naik) */
  dates: string[];
  /** hari yang dipertahankan (terkunci / di luar area regenerasi / periode sebelumnya sebagai konteks) */
  fixed?: DayPlan[];
  mode: GeneratorMode;
  seed: number;
  pantry?: PantryItem[];
  history?: SeafoodEvent[];
  /** hari terakhir periode sebelumnya, untuk cek berurutan & variasi */
  prevDays?: DayPlan[];
  favorites?: string[];
  today?: string;
  maxRepairIter?: number;
}

export interface GenResult {
  days: DayPlan[];
  report: PlanReport;
  budget: BudgetReport;
  feasible: boolean;
  infeasible?: Infeasible;
  notes: string[];
  optimizerSteps: string[];
}

export function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAIN_CATS = ['ayam', 'telur', 'ikan', 'udang', 'cumi', 'daging_sapi', 'hati_ampela'];
const key = (date: string, slot: Slot | 'V' | 'R') => `${date}|${slot}`;

const empty = (date: string): DayPlan => ({ date, mainA: '', mainB: '', motherLunch: { mode: 'follow' }, veg: '', rice: '', sides: [], locked: false });

class Planner {
  work = new Map<string, DayPlan>();
  protectedCells = new Set<string>();
  rng: () => number;
  notes: string[] = [];
  private okCache = new Map<string, boolean>();
  private costCache = new Map<string, number>();
  stock: Map<string, number>;

  constructor(public inp: GenInput) {
    this.rng = mulberry32(inp.seed);
    for (const d of inp.prevDays ?? []) this.work.set(d.date, { ...d, locked: true });
    for (const d of inp.fixed ?? []) this.work.set(d.date, { ...d });
    for (const date of inp.dates) if (!this.work.has(date) || !(inp.fixed ?? []).some((f) => f.date === date)) this.work.set(date, empty(date));
    this.stock = stockByIngredient(inp.pantry ?? [], inp.ctx, inp.today ?? inp.dates[0] ?? '');
  }
  get ctx(): Ctx { return this.inp.ctx; }
  isTarget = (date: string): boolean => this.inp.dates.includes(date) && !(this.inp.fixed ?? []).some((f) => f.date === date);
  rec = (id: string): Recipe | undefined => this.ctx.recipes.get(id);
  get = (date: string, slot: Slot): string => (slot === 'A' ? this.work.get(date)?.mainA : this.work.get(date)?.mainB) ?? '';
  set(date: string, slot: Slot, id: string, prot = false) {
    const d = this.work.get(date)!;
    if (slot === 'A') d.mainA = id; else d.mainB = id;
    if (prot) this.protectedCells.add(key(date, slot));
  }

  // ---- kelayakan dasar (pantangan) ----
  allowed(r: Recipe, date: string, slot: Slot): boolean {
    const weekend = isWeekend(date);
    const k = `${r.id}|${weekend}|${weekend ? 'X' : slot}`;
    const c = this.okCache.get(k);
    if (c !== undefined) return c;
    let ok = !(weekend && !r.weekendOk);
    const members: Member[] = weekend ? ['ibu', 'ayah', 'anak'] : slot === 'A' ? ['anak'] : ['ibu', 'ayah', 'anak'];
    if (ok) ok = members.every((m) => !checkRecipeForMember(r, m, this.ctx, { weekend, asMain: true }).some((v) => v.level === 'hard'));
    if (ok && r.ingredients.some((ri) => this.ctx.ingredients.get(ri.ingredientId)?.packPrice === null && !(this.stock.get(ri.ingredientId) ?? 0))) ok = false;
    this.okCache.set(k, ok);
    return ok;
  }

  ayahEats = (date: string, slot: Slot): boolean => isWeekend(date) || slot === 'B';

  ayahEggDay(date: string): boolean {
    const d = this.work.get(date);
    if (!d) return false;
    return (['A', 'B'] as Slot[]).some((s) => this.ayahEats(date, s) && this.rec(this.get(date, s))?.protein === 'telur');
  }
  ayahLeleDay(date: string): boolean {
    return (['A', 'B'] as Slot[]).some((s) => {
      if (!this.ayahEats(date, s)) return false;
      const r = this.rec(this.get(date, s));
      return !!r && speciesOfRecipe(r, this.ctx).includes('lele');
    });
  }
  weekDates(date: string): string[] {
    const ws = weekStart(date);
    return Array.from({ length: 7 }, (_, i) => addDaysStr(ws, i)).filter((d) => this.work.has(d));
  }

  canPlace(r: Recipe, date: string, slot: Slot): boolean {
    if (!this.allowed(r, date, slot)) return false;
    // berurutan / hari yang sama
    for (const dd of [addDaysStr(date, -1), addDaysStr(date, 1)]) {
      const o = this.work.get(dd);
      if (o && (o.mainA === r.id || o.mainB === r.id)) return false;
    }
    const other = this.get(date, slot === 'A' ? 'B' : 'A');
    if (other === r.id) return false;
    // telur & lele ayah
    if (this.ayahEats(date, slot) && r.protein === 'telur') {
      const days = this.weekDates(date).filter((d) => d !== date && this.ayahEggDay(d));
      const here = this.ayahEggDay(date);
      if (days.length + 1 > 2 && !here) return false;
      if (!here && days.some((d) => Math.abs(diffDays(d, date)) === 1)) return false;
      if (here) {
        // sudah ada telur ayah pada hari ini (slot lain): tidak menambah hari baru
      }
    }
    if (this.ayahEats(date, slot) && speciesOfRecipe(r, this.ctx).includes('lele')) {
      if (this.weekDates(date).some((d) => d !== date && this.ayahLeleDay(d))) return false;
    }
    if (r.protein === 'hati') {
      for (let k = -3; k <= 3; k++) {
        const dd = addDaysStr(date, k);
        if (dd !== date && ['A', 'B'].some((s) => this.rec(this.get(dd, s as Slot))?.protein === 'hati')) return false;
      }
    }
    if (isWeekend(date)) {
      const o = this.rec(other);
      if (o) {
        const m = (x: Recipe) => x.prepMin + x.cookMin;
        if (m(r) + m(o) + 25 + 30 + 5 > this.ctx.prefs.maxWeekendSessionMin + 40) return false; // + sayur & nasi
      }
    }
    return true;
  }

  // ---- biaya & skor ----
  slotUnits(date: string, slot: Slot): { adult: number; child: number } {
    if (isWeekend(date)) return slot === 'A' ? { adult: 3, child: 2 } : { adult: 2, child: 1 };
    return slot === 'A' ? { adult: 1, child: 2 } : { adult: 2, child: 1 };
  }
  cost(r: Recipe, date: string, slot: Slot): number {
    const u = this.slotUnits(date, slot);
    const k = `${r.id}|${u.adult}|${u.child}`;
    const c = this.costCache.get(k);
    if (c !== undefined) return c;
    const reqs = recipeRequirement(r, u.adult, u.child, this.ctx, { stock: this.stock }, new Map(), false);
    let total = 0;
    for (const l of reqs.values()) {
      const ing = this.ctx.ingredients.get(l.ingredientId);
      const up = ing ? unitPrice(ing) : null;
      if (!ing || !ing.inBudget || up === null) continue;
      total += Math.max(0, l.gross - (this.stock.get(ing.id) ?? 0)) * up;
    }
    this.costCache.set(k, total);
    return total;
  }
  score(r: Recipe, date: string, slot: Slot): number {
    const mode = this.inp.mode;
    let s = 0;
    const wCost = mode === 'PALING_HEMAT' ? 3.2 : 1.2;
    s -= (this.cost(r, date, slot) / 10000) * wCost;
    // variasi: terakhir dipakai
    let lastUse = 99;
    for (const [d, day] of this.work) {
      if (day.mainA === r.id || day.mainB === r.id) lastUse = Math.min(lastUse, Math.abs(diffDays(d, date)));
    }
    s += lastUse >= 99 ? 1.2 : lastUse >= 14 ? 0.8 : lastUse >= 7 ? 0.3 : -0.8;
    const y = this.work.get(addDaysStr(date, -1));
    const yp = [y?.mainA, y?.mainB].map((x) => (x ? this.rec(x)?.protein : undefined));
    if (yp.includes(r.protein)) s -= 0.6;
    const same = this.rec(this.get(date, slot === 'A' ? 'B' : 'A'));
    if (same && same.protein === r.protein) s -= 0.5;
    if (mode === 'MENU_FAVORIT' && (r.favorite || (this.inp.favorites ?? []).includes(r.id))) s += 2.2;
    else if (r.favorite) s += 0.2;
    if (mode === 'HABISKAN_STOK') {
      const hit = r.ingredients.filter((ri) => (this.stock.get(ri.ingredientId) ?? 0) > 0 || (ri.options ?? []).some((o) => (this.stock.get(o) ?? 0) > 0)).length;
      s += hit * 2;
    }
    if (mode === 'VARIASI_BARU') {
      const prev = (this.inp.prevDays ?? []).some((d) => d.mainA === r.id || d.mainB === r.id);
      if (prev) s -= 1.5;
      s += (this.rng() - 0.5) * 3;
    } else s += (this.rng() - 0.5) * 0.8;
    return s;
  }

  pool(filter: (r: Recipe) => boolean): Recipe[] {
    return [...this.ctx.recipes.values()].filter((r) => r.role === 'lauk' && MAIN_CATS.includes(r.category) && filter(r));
  }
  pick(cands: Recipe[], date: string, slot: Slot): Recipe | undefined {
    const ok = cands.filter((r) => this.canPlace(r, date, slot));
    if (!ok.length) return undefined;
    return ok.map((r) => ({ r, s: this.score(r, date, slot) })).sort((a, b) => b.s - a.s)[0].r;
  }
  shuffle<T>(a: T[]): T[] {
    const x = [...a];
    for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
    return x;
  }
  targetCells(filter: (date: string, slot: Slot) => boolean = () => true): { date: string; slot: Slot }[] {
    const out: { date: string; slot: Slot }[] = [];
    for (const date of this.inp.dates) {
      if (!this.isTarget(date)) continue;
      for (const slot of ['A', 'B'] as Slot[]) if (!this.get(date, slot) && filter(date, slot)) out.push({ date, slot });
    }
    return out;
  }
  placeSpecial(cands: Recipe[], cells: { date: string; slot: Slot }[]): { date: string; slot: Slot; r: Recipe } | undefined {
    for (const c of cells) {
      if (this.get(c.date, c.slot)) continue;
      const r = this.pick(cands, c.date, c.slot);
      if (r) { this.set(c.date, c.slot, r.id, true); return { ...c, r }; }
    }
    return undefined;
  }
  allDays(): DayPlan[] { return [...this.work.values()].sort((a, b) => a.date.localeCompare(b.date)); }
  targetDays(): DayPlan[] { return this.allDays().filter((d) => this.inp.dates.includes(d.date)); }
}

function weekGroups(p: Planner) {
  return groupByWeek(p.inp.dates);
}

function phaseRequired(p: Planner) {
  const cfgs = p.ctx.prefs.requiredDishes;
  const groups = weekGroups(p);
  if (!groups.length) return;
  const have = (id: string) => p.allDays().filter((d) => [d.mainA, d.mainB].some((x) => p.rec(x)?.requiredDish === id)).length;
  const order = ['ungkep', 'rawon', 'kentaki', 'balado', 'sambal_goreng', 'katsu'];
  const off = Math.floor(p.rng() * groups.length);
  const sorted = [...cfgs].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const rawonWeek = groups.length > 2 ? 1 + Math.floor(p.rng() * Math.min(2, groups.length - 2)) : 0;
  sorted.forEach((cfg, i) => {
    let need = cfg.minPerCycle - have(cfg.id);
    let attempt = 0;
    while (need > 0 && attempt < groups.length * 2) {
      const gi = cfg.id === 'rawon' ? (rawonWeek + attempt) % groups.length : (off + i + attempt) % groups.length;
      attempt++;
      const g = groups[gi];
      const cands = p.pool((r) => r.requiredDish === cfg.id);
      const dates = p.shuffle(g.dates.filter((d) => p.isTarget(d)));
      const wkend = dates.filter(isWeekend);
      const wkday = dates.filter((d) => !isWeekend(d));
      let cells: { date: string; slot: Slot }[];
      if (cfg.id === 'kentaki') cells = [...wkend.map((date) => ({ date, slot: 'A' as Slot })), ...wkday.map((date) => ({ date, slot: 'B' as Slot }))];
      else if (cfg.id === 'rawon') cells = [...wkday.filter((d) => ![1, 5].includes(new Date(d + 'T00:00:00').getDay())).map((date) => ({ date, slot: 'B' as Slot })), ...wkend.map((date) => ({ date, slot: 'B' as Slot }))];
      else cells = [...wkday.map((date) => ({ date, slot: 'B' as Slot })), ...wkend.map((date) => ({ date, slot: 'B' as Slot })), ...wkend.map((date) => ({ date, slot: 'A' as Slot }))];
      if (p.placeSpecial(cands, cells)) need--;
    }
    if (need > 0) p.notes.push(`Menu wajib "${cfg.label}" belum dapat ditempatkan tanpa melanggar aturan.`);
  });
}

function phaseBeef(p: Planner) {
  if (p.inp.dates.length < 28) return;
  const beefDays = () => p.allDays().filter((d) => [d.mainA, d.mainB].some((x) => p.rec(x)?.protein === 'sapi'));
  const cands = p.pool((r) => r.protein === 'sapi' && !r.requiredDish);
  let guard = 0;
  while (beefDays().length < 2 && guard++ < 4) {
    const existing = beefDays().map((d) => d.date);
    const cells = p.shuffle(p.targetCells((date, slot) => slot === 'A' && !isWeekend(date) && existing.every((e) => Math.abs(diffDays(e, date)) >= 8)));
    if (!p.placeSpecial(cands, cells)) { p.notes.push('Daging sapi anak ke-2 tidak dapat ditempatkan.'); break; }
  }
}

function phaseSeafood(p: Planner) {
  const { dates, history = [] } = p.inp;
  if (!dates.length) return;
  const start = dates[0];
  const end = dates[dates.length - 1];
  const seaDates = p.allDays().filter((d) => [d.mainA, d.mainB].some((x) => { const r = p.rec(x); return r && isSeafoodRecipe(r); })).map((d) => d.date);
  const hist = history.filter((h) => h.date < start).map((h) => h.date);
  const lastBefore = [...hist, ...seaDates.filter((d) => d < start)].sort().pop();
  let last = lastBefore;
  let lastType: 'udang' | 'cumi' | undefined = history.find((h) => h.date === lastBefore)?.type;
  const inRange = seaDates.filter((d) => d >= start).sort();
  if (inRange.length) { last = inRange[inRange.length - 1]; }
  let guard = 0;
  while (guard++ < 10) {
    let target: string;
    if (!last) target = addDaysStr(start, 2);
    else if (diffDays(end, last) >= 12) target = addDaysStr(last, 12);
    else break;
    if (diffDays(target, end) > 0) break;
    const type: 'udang' | 'cumi' = lastType === 'udang' ? 'cumi' : 'udang';
    const tryTypes: ('udang' | 'cumi')[] = [type, type === 'udang' ? 'cumi' : 'udang'];
    // cari weekday terdekat dalam jendela [last+8, last+14] (atau mulai dari start)
    const lo = last ? addDaysStr(last, 8) : start;
    const hi = last ? addDaysStr(last, 14) : end;
    const order: string[] = [];
    for (let k = 0; k <= 6; k++) { order.push(addDaysStr(target, -k)); if (k) order.push(addDaysStr(target, k)); }
    const cells = order.filter((d) => d >= lo && d <= hi && d >= start && d <= end && p.isTarget(d) && !isWeekend(d)).map((date) => ({ date, slot: 'A' as Slot }));
    let placed: ReturnType<Planner['placeSpecial']>;
    for (const t of tryTypes) {
      const cands = p.pool((r) => r.protein === t && r.category !== undefined);
      placed = p.placeSpecial(p.shuffle(cands), cells);
      if (placed) { lastType = t; break; }
    }
    if (!placed) { p.notes.push('Seafood anak tidak dapat ditempatkan dalam jendela 14 hari.'); break; }
    last = placed.date;
  }
}

function phaseIronAndEggs(p: Planner) {
  const anakIron = (dates: string[]) => dates.some((d) => [p.get(d, 'A'), p.get(d, 'B')].some((x) => p.rec(x)?.ironRich));
  for (const g of weekGroups(p)) {
    const targetDates = g.dates.filter((d) => p.isTarget(d));
    if (!targetDates.length) continue;
    // telur keluarga (anak, weekday A) minimal 1 per minggu
    const hasEgg = g.dates.some((d) => [p.get(d, 'A'), p.get(d, 'B')].some((x) => p.rec(x)?.protein === 'telur'));
    if (!hasEgg) {
      const cells = p.shuffle(targetDates.filter((d) => !isWeekend(d))).map((date) => ({ date, slot: 'A' as Slot }));
      p.placeSpecial(p.pool((r) => r.protein === 'telur' && r.id !== 'telur-dadar-keluarga' && r.id !== 'semur-telur'), cells);
    }
    if (targetDates.length >= 3 && !anakIron(g.dates)) {
      const hati = p.pool((r) => r.protein === 'hati' && !r.requiredDish);
      const beef = p.pool((r) => r.protein === 'sapi' && !r.requiredDish);
      const cellsB = p.shuffle(targetDates.filter((d) => !isWeekend(d))).map((date) => ({ date, slot: 'B' as Slot }));
      const cellsA = p.shuffle(targetDates.filter((d) => !isWeekend(d))).map((date) => ({ date, slot: 'A' as Slot }));
      if (!p.placeSpecial(hati, cellsB) && !p.placeSpecial(beef, cellsA)) p.notes.push(`Minggu ${g.start}: lauk kaya zat besi belum dapat ditempatkan.`);
    }
  }
}

function phaseFill(p: Planner) {
  const cands = p.pool((r) => !r.requiredDish && ['ayam', 'ikan', 'telur'].includes(r.category) && r.id !== 'telur-dadar-keluarga' ? true : r.id === 'telur-dadar-keluarga');
  for (const date of p.inp.dates) {
    if (!p.isTarget(date)) continue;
    for (const slot of ['B', 'A'] as Slot[]) {
      if (p.get(date, slot)) continue;
      const r = p.pick(cands, date, slot) ?? p.pick(p.pool((x) => ['ayam', 'ikan', 'telur'].includes(x.category)), date, slot);
      if (r) p.set(date, slot, r.id);
      else p.notes.push(`${date}: tidak ada lauk ${slot} yang memenuhi semua aturan.`);
    }
  }
}

function vegAndRice(p: Planner) {
  const vegs = [...p.ctx.recipes.values()].filter((r) => r.role === 'sayur');
  const rices = [...p.ctx.recipes.values()].filter((r) => r.role === 'nasi');
  const dates = p.inp.dates.filter((d) => p.isTarget(d));
  const vegCost = (r: Recipe) => {
    const reqs = recipeRequirement(r, 4, 2, p.ctx, { stock: p.stock }, new Map(), false);
    let t = 0;
    for (const l of reqs.values()) { const i = p.ctx.ingredients.get(l.ingredientId); const up = i ? unitPrice(i) : null; if (i?.inBudget && up !== null) t += l.gross * up; }
    return t;
  };
  for (const date of dates) {
    const d = p.work.get(date)!;
    const near = [addDaysStr(date, -1), addDaysStr(date, 1)].map((x) => p.work.get(x)?.veg);
    const recent = Array.from({ length: 3 }, (_, i) => p.work.get(addDaysStr(date, -(i + 1)))?.veg);
    const v = vegs.filter((r) => !near.includes(r.id)).map((r) => ({ r, s: -vegCost(r) / 5000 + (recent.includes(r.id) ? -1 : 0.6) + p.rng() * 1.2 })).sort((a, b) => b.s - a.s)[0];
    d.veg = v?.r.id ?? vegs[0].id;
    const weekSantan = p.weekDates(date).filter((x) => x !== date && p.rec(p.work.get(x)?.rice ?? '')?.ingredients.some((i) => i.ingredientId === 'santan')).length;
    const yr = p.work.get(addDaysStr(date, -1))?.rice;
    const rr = rices.filter((r) => r.id !== yr && r.id !== p.work.get(addDaysStr(date, 1))?.rice).map((r) => {
      const santan = r.ingredients.some((i) => i.ingredientId === 'santan');
      let s = p.rng() * 2;
      if (santan && weekSantan >= 2) s -= 3;
      if (r.id === 'nasi-butter') s += 0.6; // padat energi (program kejar BB)
      const used = Array.from({ length: 5 }, (_, i) => p.work.get(addDaysStr(date, -(i + 1)))?.rice).filter((x) => x === r.id).length;
      return { r, s: s - used * 1.5 };
    }).sort((a, b) => b.s - a.s)[0];
    d.rice = rr?.r.id ?? rices[0].id;
    // makan siang ibu: ikut lauk anak jika sesuai dan bukan telur/seafood, selain itu alternatif ayam suwir
    if (!isWeekend(date)) {
      const A = p.rec(d.mainA);
      const ibuOk = A ? !checkRecipeForMember(A, 'ibu', p.ctx, { weekend: false, asMain: true }).some((x) => x.level === 'hard') : false;
      const follow = !!A && ibuOk && A.protein !== 'telur' && A.protein !== 'cumi' && A.protein !== 'udang' && A.protein !== 'hati';
      d.motherLunch = follow ? { mode: 'follow' } : { mode: 'alt', recipeId: 'ayam-suwir' };
    } else d.motherLunch = { mode: 'follow' };
  }
}

function repair(p: Planner, maxIter: number) {
  const ctx = p.ctx;
  const evalErrors = (): number => validatePlan(p.allDays().filter((d) => d.mainA && d.mainB && d.veg && d.rice), ctx, { history: p.inp.history }).errors;
  let cur = evalErrors();
  const all = [...ctx.recipes.values()].filter((r) => r.role === 'lauk' && MAIN_CATS.includes(r.category));
  for (let it = 0; it < maxIter && cur > 0; it++) {
    const rep = validatePlan(p.allDays().filter((d) => d.mainA && d.mainB && d.veg && d.rice), ctx, { history: p.inp.history });
    const errs = rep.issues.filter((i) => i.severity === 'error');
    if (!errs.length) break;
    const e = errs[Math.floor(p.rng() * errs.length)];
    const scopeDates = e.date ? [e.date] : e.week ? p.weekDates(e.week).filter((d) => p.isTarget(d)) : p.inp.dates.filter((d) => p.isTarget(d));
    const cells = p.shuffle(scopeDates.flatMap((date) => (['A', 'B'] as Slot[]).map((slot) => ({ date, slot })))).filter((c) => !p.protectedCells.has(key(c.date, c.slot)) && p.isTarget(c.date)).slice(0, 8);
    let best: { c: { date: string; slot: Slot }; id: string; errs: number } | undefined;
    for (const c of cells) {
      const orig = p.get(c.date, c.slot);
      for (const r of p.shuffle(all).filter((x) => p.allowed(x, c.date, c.slot) && x.id !== orig && !x.requiredDish).slice(0, 8)) {
        p.set(c.date, c.slot, r.id);
        const n = evalErrors();
        if (n < cur && (!best || n < best.errs)) best = { c, id: r.id, errs: n };
      }
      p.set(c.date, c.slot, orig);
    }
    if (best) { p.set(best.c.date, best.c.slot, best.id); cur = best.errs; }
  }
  // veg / nasi berurutan diperbaiki oleh vegAndRice; sisa error dilaporkan apa adanya
}

export function generatePlan(inp: GenInput): GenResult {
  const p = new Planner(inp);
  phaseRequired(p);
  phaseBeef(p);
  phaseSeafood(p);
  phaseIronAndEggs(p);
  phaseFill(p);
  vegAndRice(p);
  repair(p, inp.maxRepairIter ?? 60);
  const optimizerSteps = optimizeBudget(p);
  return finalize(p, optimizerSteps);
}

function finalize(p: Planner, optimizerSteps: string[]): GenResult {
  const ctx = p.ctx;
  const days = p.allDays().filter((d) => p.inp.dates.includes(d.date) || (p.inp.fixed ?? []).some((f) => f.date === d.date));
  const prev = (p.inp.prevDays ?? []).slice(-1)[0];
  const today = p.inp.today ?? days[0]?.date ?? '';
  const report = validatePlan(days, ctx, { history: p.inp.history, prevDay: prev });
  const budget = budgetReport(days, ctx, p.inp.pantry ?? [], today);
  const extra: string[] = [...p.notes];
  for (const e of report.issues.filter((i) => i.severity === 'error')) extra.push(e.message);
  const feasible = report.ok && !budget.over;
  return {
    days, report, budget, feasible,
    infeasible: feasible ? undefined : describeInfeasible(budget, extra),
    notes: p.notes, optimizerSteps,
  };
}

// ===== Smart Budget Optimizer =====
function dayLinear(p: Planner, d: DayPlan): number {
  let t = 0;
  const m = new Map<string, number>();
  for (const [k, v] of p.stock) m.set(k, v);
  const reqs = new Map<string, import('./requirements').ReqLine>();
  void reqs;
  const a = p.rec(d.mainA); const b = p.rec(d.mainB);
  const wk = isWeekend(d.date);
  const cells: [Recipe | undefined, number, number][] = [[a, wk ? 3 : 1, 2], [b, 2, 1]];
  for (const [r, ad, ch] of cells) {
    if (!r) continue;
    for (const l of recipeRequirement(r, ad, ch, p.ctx, { stock: m }, new Map(), false).values()) {
      const i = p.ctx.ingredients.get(l.ingredientId); const up = i ? unitPrice(i) : null;
      if (i?.inBudget && up !== null) t += l.gross * up;
    }
  }
  for (const id of [d.veg, d.rice]) {
    const r = p.rec(id);
    if (!r) continue;
    const units = r.role === 'nasi' ? [0, 3] : [4, 2];
    for (const l of recipeRequirement(r, units[0], units[1], p.ctx, { stock: m }, new Map(), false).values()) {
      const i = p.ctx.ingredients.get(l.ingredientId); const up = i ? unitPrice(i) : null;
      if (i?.inBudget && up !== null) t += l.gross * up;
    }
  }
  return t;
}

/**
 * Smart Budget Optimizer: tukar lauk/sayur/nasi yang BOLEH diganti (tidak dikunci, bukan menu wajib/sapi/seafood/zat besi)
 * dengan alternatif yang lebih murah, selama jumlah error aturan tidak bertambah. Porsi anak tidak pernah dikurangi.
 */
export function optimizeBudget(p: Planner): string[] {
  const steps: string[] = [];
  const ctx = p.ctx;
  const protectedRecipe = (r?: Recipe) => !r || !!r.requiredDish || ['sapi', 'udang', 'cumi', 'hati'].includes(r.protein) || r.ironRich;
  let guard = 0;
  while (guard++ < 40) {
    const days = p.allDays().filter((d) => p.inp.dates.includes(d.date) && d.mainA && d.mainB && d.veg && d.rice);
    const br = budgetReport(days, ctx, p.inp.pantry ?? [], p.inp.today ?? days[0]?.date ?? '');
    const over = br.weeks.filter((w) => w.over).sort((a, b) => b.diff - a.diff);
    if (!over.length && p.inp.mode !== 'PALING_HEMAT') break;
    const targetWeeks = over.length ? over : [];
    if (!targetWeeks.length) break;
    const w = targetWeeks[0];
    const baseErr = validatePlan(days, ctx, { history: p.inp.history }).errors;
    type Move = { date: string; kind: 'A' | 'B' | 'V' | 'R'; id: string; saving: number };
    const moves: Move[] = [];
    for (const date of w.dates.filter((d) => p.isTarget(d))) {
      const day = p.work.get(date)!;
      if (day.locked) continue;
      const base = dayLinear(p, day);
      const tryRecipes = (kind: Move['kind'], pool: Recipe[], cur: string) => {
        for (const r of pool) {
          if (r.id === cur) continue;
          const copy = { ...day };
          if (kind === 'A') copy.mainA = r.id; else if (kind === 'B') copy.mainB = r.id; else if (kind === 'V') copy.veg = r.id; else copy.rice = r.id;
          const saving = base - dayLinear(p, copy);
          if (saving > 500) moves.push({ date, kind, id: r.id, saving });
        }
      };
      if (!p.protectedCells.has(key(date, 'A')) && !protectedRecipe(p.rec(day.mainA))) tryRecipes('A', p.pool((r) => !r.requiredDish && ['ayam', 'ikan', 'telur'].includes(r.category) && p.allowed(r, date, 'A')), day.mainA);
      if (!p.protectedCells.has(key(date, 'B')) && !protectedRecipe(p.rec(day.mainB))) tryRecipes('B', p.pool((r) => !r.requiredDish && ['ayam', 'ikan', 'telur'].includes(r.category) && p.allowed(r, date, 'B')), day.mainB);
      tryRecipes('V', [...ctx.recipes.values()].filter((r) => r.role === 'sayur'), day.veg);
      tryRecipes('R', [...ctx.recipes.values()].filter((r) => r.role === 'nasi'), day.rice);
    }
    moves.sort((a, b) => b.saving - a.saving);
    let applied = false;
    for (const m of moves.slice(0, 14)) {
      const day = p.work.get(m.date)!;
      const old = { ...day };
      if (m.kind === 'A') day.mainA = m.id; else if (m.kind === 'B') day.mainB = m.id; else if (m.kind === 'V') day.veg = m.id; else day.rice = m.id;
      const errs = validatePlan(p.allDays().filter((d) => d.mainA && d.mainB && d.veg && d.rice && p.inp.dates.includes(d.date)), ctx, { history: p.inp.history }).errors;
      if (errs <= baseErr) {
        steps.push(`${m.date}: ${p.rec(m.kind === 'A' ? old.mainA : m.kind === 'B' ? old.mainB : m.kind === 'V' ? old.veg : old.rice)?.name} → ${p.rec(m.id)?.name} (hemat ±Rp${Math.round(m.saving).toLocaleString('id-ID')})`);
        applied = true;
        break;
      }
      Object.assign(day, old);
    }
    if (!applied) break;
  }
  return steps;
}

// ===== Penggantian menu (Replace This Meal / Day) =====
export interface Replacement {
  recipeId: string;
  name: string;
  originalCost: number;
  newCost: number;
  diff: number;
  errors: number;
  newIssues: string[];
}

export function suggestReplacements(
  days: DayPlan[], date: string, slot: 'mainA' | 'mainB', ctx: Ctx,
  opts: { pantry?: PantryItem[]; history?: SeafoodEvent[]; seed?: number } = {},
): Replacement[] {
  const p = new Planner({ ctx, dates: days.map((d) => d.date), fixed: days, mode: 'VARIASI_BARU', seed: opts.seed ?? 1, pantry: opts.pantry, history: opts.history, today: date });
  const s: Slot = slot === 'mainA' ? 'A' : 'B';
  const cur = p.get(date, s);
  const baseReport = validatePlan(days, ctx, { history: opts.history });
  const baseKeys = new Set(baseReport.issues.filter((i) => i.severity !== 'info').map((i) => `${i.code}|${i.date}|${i.message}`));
  const origCost = p.rec(cur) ? p.cost(p.rec(cur)!, date, s) : 0;
  const out: Replacement[] = [];
  for (const r of p.pool(() => true)) {
    if (r.id === cur || !p.allowed(r, date, s)) continue;
    const trial = days.map((d) => (d.date === date ? { ...d, [slot]: r.id } : d));
    const rep = validatePlan(trial, ctx, { history: opts.history });
    const fresh = rep.issues.filter((i) => i.severity === 'error' && !baseKeys.has(`${i.code}|${i.date}|${i.message}`));
    const nc = p.cost(r, date, s);
    out.push({ recipeId: r.id, name: r.name, originalCost: Math.round(origCost), newCost: Math.round(nc), diff: Math.round(nc - origCost), errors: fresh.length, newIssues: fresh.map((i) => i.message) });
  }
  return out.sort((a, b) => a.errors - b.errors || a.diff - b.diff);
}

/** Replace This Day: pilih lauk A, B, sayur, dan nasi baru memakai planner dengan hari lain dipertahankan. */
export function regenerateDates(inp: Omit<GenInput, 'dates'> & { dates: string[] }): GenResult {
  return generatePlan(inp);
}
