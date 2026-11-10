import type { DayPlan, Ingredient, Member, Recipe } from '../types';
import type { Ctx } from './context';
import { allowedMembers, checkRecipeForMember, recipeGluten } from './restrictions';
import { costPerNet } from './requirements';
import { unitPrice } from './grocery';

export interface HaveItem {
  ingredientId: string;
  amount: number; // dalam unit dasar bahan (g/ml/pcs), jumlah KOTOR yang dimiliki
}

export type MatchCategory = 'READY TO COOK' | 'ALMOST READY' | 'NEED MORE INGREDIENTS';
export interface MissingItem {
  ingredientId: string;
  name: string;
  need: number;
  have: number;
  short: number;
  unit: string;
  cost: number | null;
}
export interface CookMatch {
  recipe: Recipe;
  category: MatchCategory;
  available: { name: string; have: number; need: number; unit: string }[];
  missing: MissingItem[];
  extraCost: number | null;
  portions: number;
  timeMin: number;
  recipients: Member[];
  gluten: ReturnType<typeof recipeGluten>;
  saving: string;
  priority: number;
}

export interface CookWithOpts {
  portions?: number; // porsi dewasa yang ingin dimasak
  weekend?: boolean;
  meal?: 'any' | 'sarapan_ibu' | 'siang_ibu' | 'malam' | 'anak';
  todayPlan?: DayPlan;
}

const isKey = (ing: Ingredient): boolean => ing.category !== 'pantry' && ing.category !== 'bumbu';

/** Masak dari bahan yang ada: READY / ALMOST / NEED MORE. Bumbu & pantry diasumsikan tersedia. */
export function cookWithWhatIHave(have: HaveItem[], ctx: Ctx, o: CookWithOpts = {}): CookMatch[] {
  const target = o.portions ?? 2;
  const haveMap = new Map<string, number>();
  for (const h of have) haveMap.set(h.ingredientId, (haveMap.get(h.ingredientId) ?? 0) + h.amount);
  const out: CookMatch[] = [];

  for (const r of ctx.recipes.values()) {
    if (r.category === 'bumbu_dasar' || r.category === 'nasi_anak') continue;
    const recipients = allowedMembers(r, ctx, !!o.weekend);
    if (o.meal === 'sarapan_ibu' && r.id !== 'telur-ceplok' && !(r.protein === 'telur')) continue;
    if (o.meal === 'sarapan_ibu' && !recipients.includes('ibu')) continue;
    if (o.meal === 'siang_ibu' && (!recipients.includes('ibu') || r.protein === 'cumi')) continue;
    if (o.meal === 'anak' && !recipients.includes('anak')) continue;
    if (o.meal === 'malam' && recipients.length < 3 && r.role === 'lauk') continue;
    if (o.weekend && (r.protein === 'cumi')) continue; // cumi tidak pernah di weekend
    if (recipients.length === 0) continue;

    const available: CookMatch['available'] = [];
    const missing: MissingItem[] = [];
    let portions = Infinity;
    let stockValue = 0;
    let keyCount = 0;
    for (const ri of r.ingredients) {
      const opts = [ri.ingredientId, ...(ri.options ?? [])];
      const primary = ctx.ingredients.get(ri.ingredientId);
      if (!primary || !isKey(primary)) continue;
      keyCount++;
      // pilih opsi yang dimiliki (terbanyak); jika tak ada, pakai bahan utama
      const chosenId = opts.filter((id) => (haveMap.get(id) ?? 0) > 0).sort((a, b) => (haveMap.get(b) ?? 0) - (haveMap.get(a) ?? 0))[0] ?? ri.ingredientId;
      const ing = ctx.ingredients.get(chosenId)!;
      const perPortionNet = ri.amount / r.serves;
      const needGross = (perPortionNet * target) / ing.ediblePct;
      const hv = haveMap.get(chosenId) ?? 0;
      portions = Math.min(portions, (hv * ing.ediblePct) / perPortionNet);
      if (hv >= needGross - 1e-9) {
        available.push({ name: ing.name, have: hv, need: needGross, unit: ing.unit });
        stockValue += needGross * (unitPrice(ing) ?? 0);
      } else {
        const short = needGross - hv;
        const up = unitPrice(ing);
        missing.push({ ingredientId: chosenId, name: ing.name, need: needGross, have: hv, short, unit: ing.unit, cost: up === null ? null : short * up });
        if (hv > 0) available.push({ name: ing.name + ' (sebagian)', have: hv, need: needGross, unit: ing.unit });
      }
    }
    if (keyCount === 0) continue;
    const unknown = missing.some((m) => m.cost === null);
    const extraCost = unknown ? null : missing.reduce((s, m) => s + (m.cost ?? 0), 0);
    const category: MatchCategory = missing.length === 0 ? 'READY TO COOK' : missing.length <= 2 ? 'ALMOST READY' : 'NEED MORE INGREDIENTS';
    let priority = category === 'READY TO COOK' ? 0 : category === 'ALMOST READY' ? 1 : 2;
    if (o.meal === 'sarapan_ibu' && r.id === 'telur-ceplok') priority -= 0.5;
    if (o.meal === 'siang_ibu' && o.todayPlan && (r.id === o.todayPlan.mainA || r.id === (o.todayPlan.motherLunch.recipeId ?? ''))) priority -= 0.5;
    out.push({
      recipe: r, category, available, missing, extraCost,
      portions: Math.max(0, Math.floor((isFinite(portions) ? portions : 0) * 10) / 10),
      timeMin: r.prepMin + r.cookMin, recipients, gluten: recipeGluten(r, ctx),
      saving: stockValue > 0 ? `Memakai bahan yang sudah ada (nilai ±Rp${Math.round(stockValue).toLocaleString('id-ID')}); belanja tambahan minimal.` : 'Belum ada bahan dari stok yang terpakai.',
      priority,
    });
  }
  return out.sort((a, b) => a.priority - b.priority || (a.extraCost ?? 1e12) - (b.extraCost ?? 1e12) || b.portions - a.portions);
}

// ===== Smart Ingredient Substitution =====
const GROUPS: { name: string; ids: string[] }[] = [
  { name: 'Ayam', ids: ['ayam_potong', 'paha_atas', 'fillet_dada'] },
  { name: 'Ikan', ids: ['ikan_kembung', 'ikan_nila', 'ikan_layang', 'ikan_lele', 'ikan_patin'] },
  { name: 'Daging sapi', ids: ['sapi_daging', 'sapi_cincang'] },
  { name: 'Seafood anak', ids: ['udang', 'cumi'] },
  { name: 'Sayur hijau', ids: ['bayam', 'kangkung', 'sawi_hijau', 'sawi_putih'] },
  { name: 'Sayur umbi/buah', ids: ['wortel', 'labu_siam', 'buncis', 'jagung_manis'] },
  { name: 'Lemak', ids: ['butter', 'minyak'] },
  { name: 'Pendamping', ids: ['tempe', 'tahu'] },
];

export interface Substitute {
  id: string;
  name: string;
  ratio: number; // jumlah bahan pengganti (kotor) per 1 unit bahan asli (kotor), berdasar edible yield
  costDiffPerNet: number | null; // selisih biaya per gram bersih (negatif = lebih hemat)
  note: string;
}

/** Pengganti bahan yang tetap mematuhi pantangan anggota penerima. */
export function substitutesFor(ingredientId: string, ctx: Ctx, members: Member[], weekend = false): Substitute[] {
  const g = GROUPS.find((x) => x.ids.includes(ingredientId));
  const orig = ctx.ingredients.get(ingredientId);
  if (!g || !orig) return [];
  const out: Substitute[] = [];
  for (const id of g.ids) {
    if (id === ingredientId) continue;
    const ing = ctx.ingredients.get(id);
    if (!ing || ing.buyable === false) continue;
    const probe: Recipe = {
      id: 'probe', name: ing.name, category: 'ayam', role: 'lauk', protein: ing.protein ?? 'none', serves: 1,
      ingredients: [{ ingredientId: id, amount: 1 }], bumbu: [], method: id.includes('lele') ? 'goreng' : 'lainnya', isFried: id.includes('lele'),
      spice: 'none', ironRich: false, weekendOk: true, prepAhead: true, prepMin: 0, cookMin: 0, steps: [], youtubeQuery: '', favorite: false,
    };
    const blocked = members.some((m) => checkRecipeForMember(probe, m, ctx, { weekend, asMain: g.name !== 'Pendamping' }).some((v) => v.level === 'hard'));
    if (blocked) continue;
    const co = costPerNet(orig);
    const cn = costPerNet(ing);
    out.push({
      id, name: ing.name, ratio: orig.ediblePct / ing.ediblePct,
      costDiffPerNet: co === null || cn === null ? null : cn - co,
      note: ing.gluten !== 'SAFE' ? 'Periksa label gluten-free.' : 'Setara; sesuaikan bumbu dan waktu masak.',
    });
  }
  return out.sort((a, b) => (a.costDiffPerNet ?? 1e9) - (b.costDiffPerNet ?? 1e9));
}
