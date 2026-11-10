import type { FoodStatus, GlutenStatus, Member, Recipe } from '../types';
import { BUMBU_DEFS } from '../data/bumbu';
import type { Ctx } from './context';

export interface Violation {
  code: string;
  level: 'hard' | 'verify' | 'info';
  member: Member;
  message: string;
}

export interface CheckOpts {
  weekend: boolean;
  /** true bila resep dipakai sebagai lauk utama (bukan pendamping). */
  asMain?: boolean;
}

/** Semua ID bahan yang mungkin dipakai resep (termasuk opsi pengganti & isi bumbu dasar). */
export function recipeIngredientIds(recipe: Recipe): string[] {
  const ids = new Set<string>();
  for (const ri of recipe.ingredients) {
    ids.add(ri.ingredientId);
    (ri.options ?? []).forEach((o) => ids.add(o));
  }
  for (const b of recipe.bumbu) BUMBU_DEFS[b.type]?.base.forEach((x) => ids.add(x.ingredientId));
  return [...ids];
}

export function primaryIngredientIds(recipe: Recipe): string[] {
  return recipe.ingredients.map((r) => r.ingredientId);
}

const WORST: Record<GlutenStatus, number> = { SAFE: 0, NEEDS_VERIFICATION: 1, NOT_SUITABLE: 2 };

export function recipeGluten(recipe: Recipe, ctx: Ctx): GlutenStatus {
  let worst: GlutenStatus = 'SAFE';
  for (const id of recipeIngredientIds(recipe)) {
    const ing = ctx.ingredients.get(id);
    if (!ing) continue;
    if (WORST[ing.gluten] > WORST[worst]) worst = ing.gluten;
  }
  return worst;
}

function speciesOf(recipe: Recipe, ctx: Ctx): Set<string> {
  const s = new Set<string>();
  for (const id of recipeIngredientIds(recipe)) {
    const sp = ctx.ingredients.get(id)?.species;
    if (sp) s.add(sp);
  }
  return s;
}

function tagsOf(recipe: Recipe, ctx: Ctx): Set<string> {
  const s = new Set<string>();
  for (const id of recipeIngredientIds(recipe)) ctx.ingredients.get(id)?.tags?.forEach((t) => s.add(t));
  return s;
}

/** Food Restriction Engine: validasi satu resep untuk satu anggota keluarga. */
export function checkRecipeForMember(recipe: Recipe, member: Member, ctx: Ctx, opts: CheckOpts): Violation[] {
  const v: Violation[] = [];
  const add = (code: string, level: Violation['level'], message: string) => v.push({ code, level, member, message });
  const species = speciesOf(recipe, ctx);
  const tags = tagsOf(recipe, ctx);
  const isCumi = recipe.protein === 'cumi' || tags.has('cumi');
  const isUdang = recipe.protein === 'udang' || tags.has('udang');
  const name = recipe.name;

  // --- Berlaku untuk semua ---
  if (species.has('tongkol')) add('tongkol', 'hard', `${name}: ikan tongkol dilarang untuk semua anggota.`);
  if (species.has('ikan_asap')) add('ikan_asap', 'hard', `${name}: ikan asap dilarang untuk semua anggota.`);
  if (tags.has('kol')) add('kol', 'hard', `${name}: kol/kubis tidak boleh dipakai.`);
  if (opts.asMain && (recipe.protein === 'tahu_tempe' || recipe.category === 'tahu_tempe')) {
    add('tahu_tempe_utama', 'hard', `${name}: tahu/tempe hanya boleh sebagai lauk pendamping, bukan lauk utama.`);
  }
  if (species.has('bandeng')) {
    add('bandeng_non_presto', 'verify', `${name}: bandeng non-presto tidak otomatis diperbolehkan. Pastikan matang sempurna dan periksa duri.`);
  }

  if (member === 'ayah') {
    if (isUdang || tags.has('udang')) add('ayah_udang', 'hard', `${name}: ayah tidak makan udang.`);
    if (species.has('patin')) add('ayah_patin', 'hard', `${name}: ayah tidak makan ikan patin.`);
    if (isCumi) add('ayah_cumi', 'hard', `${name}: cumi khusus anak.`);
    if (species.has('lele') && !recipe.isFried) add('ayah_lele_goreng', 'hard', `${name}: lele untuk ayah hanya boleh digoreng.`);
  }

  if (member === 'ibu') {
    if (isCumi) add('ibu_cumi', 'hard', `${name}: cumi khusus anak, tidak dimasak untuk ibu.`);
    if (species.has('bandeng_presto')) add('ibu_bandeng_presto', 'hard', `${name}: bandeng presto default khusus ayah.`);
  }

  if (member === 'anak') {
    const gl = recipeGluten(recipe, ctx);
    if (gl === 'NOT_SUITABLE') add('anak_gluten', 'hard', `${name}: mengandung gluten, TIDAK BOLEH untuk anak.`);
    else if (gl === 'NEEDS_VERIFICATION') add('anak_gluten_label', 'verify', `${name}: periksa label gluten-free dan risiko kontaminasi silang.`);
    if (recipe.spice === 'hot' && !recipe.childMildVariant) add('anak_pedas', 'hard', `${name}: pedas, tidak untuk anak.`);
    else if (recipe.spice === 'hot' && recipe.childMildVariant) add('anak_pedas_pisah', 'info', `${name}: pisahkan porsi anak SEBELUM cabai masuk.`);
    if (recipe.spice === 'mild') add('anak_pedas_ringan', 'verify', `${name}: tingkat pedas ringan, pastikan tidak pedas untuk anak.`);
    if (tags.has('oyong')) add('anak_oyong', 'hard', `${name}: anak tidak boleh oyong.`);
    if (tags.has('pare')) add('anak_pare', 'hard', `${name}: anak tidak boleh pare.`);
    if (species.has('bandeng_presto')) add('anak_bandeng_presto', 'hard', `${name}: bandeng presto default khusus ayah, tidak otomatis untuk anak.`);
    if (isCumi && opts.weekend) add('cumi_weekend', 'hard', `${name}: cumi tidak boleh dijadwalkan pada Sabtu/Minggu.`);
    if (isUdang && !ctx.profile.seafoodKnownSafe.udang) {
      add('anak_udang_alergi', 'verify', `${name}: udang hanya jika sudah diketahui aman bagi anak. Perhatikan potensi alergi seafood.`);
    }
    if (isCumi && !ctx.profile.seafoodKnownSafe.cumi) {
      add('anak_cumi_alergi', 'verify', `${name}: cumi hanya jika sudah diketahui aman bagi anak. Perhatikan potensi alergi seafood.`);
    }
    if (isCumi) add('anak_cumi_matang', 'info', `${name}: masak matang, empuk, potong sesuai usia.`);
    if (species.size > 0 && (recipe.protein === 'ikan')) add('anak_duri', 'info', `${name}: periksa duri dan tekstur untuk anak.`);
  }
  return v;
}

export function statusFromViolations(v: Violation[]): FoodStatus {
  if (v.some((x) => x.level === 'hard')) return 'NOT SUITABLE';
  if (v.some((x) => x.level === 'verify')) return 'NEEDS VERIFICATION';
  return 'SAFE';
}

export function statusFor(recipe: Recipe, member: Member, ctx: Ctx, opts: CheckOpts): FoodStatus {
  return statusFromViolations(checkRecipeForMember(recipe, member, ctx, opts));
}

/** Anggota yang boleh menerima resep (tanpa pelanggaran keras). */
export function allowedMembers(recipe: Recipe, ctx: Ctx, weekend = false): Member[] {
  const all: Member[] = ['ibu', 'ayah', 'anak'];
  return all.filter((m) => !checkRecipeForMember(recipe, m, ctx, { weekend, asMain: recipe.role === 'lauk' }).some((x) => x.level === 'hard'));
}

/** Gabungan status untuk banyak anggota (terburuk menang). */
export function combinedStatus(recipe: Recipe, members: Member[], ctx: Ctx, opts: CheckOpts): FoodStatus {
  const all = members.flatMap((m) => checkRecipeForMember(recipe, m, ctx, opts));
  return statusFromViolations(all);
}

export function glutenBadge(recipe: Recipe, ctx: Ctx): { status: GlutenStatus; label: string } {
  const status = recipeGluten(recipe, ctx);
  const label = status === 'SAFE' ? 'Gluten-free' : status === 'NEEDS_VERIFICATION' ? 'Cek label GF' : 'Mengandung gluten';
  return { status, label };
}
