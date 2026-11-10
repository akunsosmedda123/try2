// ===== Tipe dasar =====
export type Member = 'ibu' | 'ayah' | 'anak';
export type MealSlot = 'sarapan' | 'siang' | 'malam';
export type Unit = 'g' | 'ml' | 'pcs';
export type IngredientCategory =
  | 'ayam_daging'
  | 'ikan_seafood'
  | 'telur'
  | 'sayur'
  | 'santan'
  | 'bumbu'
  | 'pantry';
export type GlutenStatus = 'SAFE' | 'NEEDS_VERIFICATION' | 'NOT_SUITABLE';
export type ProteinType =
  | 'ayam'
  | 'telur'
  | 'ikan'
  | 'sapi'
  | 'hati'
  | 'udang'
  | 'cumi'
  | 'tahu_tempe'
  | 'none';
export type FishSpecies =
  | 'lele'
  | 'nila'
  | 'kembung'
  | 'layang'
  | 'patin'
  | 'bandeng_presto'
  | 'bandeng'
  | 'tongkol'
  | 'ikan_asap';
export type PriceStatus = 'estimasi' | 'aktual' | 'kosong';
export type Spice = 'none' | 'mild' | 'hot';
export type StorageLocation = 'kulkas' | 'freezer' | 'pantry';

export type BumbuId =
  | 'kuning'
  | 'putih'
  | 'merah_tanpa_cabai'
  | 'merah_pedas'
  | 'bawang_merah_cincang'
  | 'bawang_putih_cincang'
  | 'rawon'
  | 'semur'
  | 'ungkep'
  | 'bakar'
  | 'bawang_jahe';

export type RequiredDishId =
  | 'rawon'
  | 'kentaki'
  | 'ungkep'
  | 'balado'
  | 'katsu'
  | 'sambal_goreng';

// ===== Bahan =====
export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  unit: Unit;
  packSize: number; // kelipatan pembelian (dalam unit)
  packPrice: number | null; // Rp per kemasan; null = harga belum diisi
  priceStatus: PriceStatus;
  priceLocation: string;
  priceSource: string;
  priceUpdated: string; // yyyy-MM-dd
  ediblePct: number; // 0..1 bagian yang dapat dimakan
  inBudget: boolean;
  gluten: GlutenStatus;
  protein?: ProteinType;
  species?: FishSpecies;
  tags?: string[];
  shelfDays?: Partial<Record<StorageLocation, number>>;
  note?: string;
  buyable?: boolean; // false = hanya untuk deteksi pantangan
  gramsPerPcs?: number; // estimasi konversi 1 pcs/ekor ke gram (bisa diedit)
}

// ===== Resep =====
export type RecipeCategory =
  | 'ayam'
  | 'telur'
  | 'ikan'
  | 'udang'
  | 'cumi'
  | 'daging_sapi'
  | 'hati_ampela'
  | 'tahu_tempe'
  | 'sayuran'
  | 'nasi_anak'
  | 'bumbu_dasar';
export type RecipeRole = 'lauk' | 'sayur' | 'nasi' | 'sarapan' | 'pendamping';
export type Method =
  | 'goreng'
  | 'tumis'
  | 'kuah'
  | 'bakar'
  | 'kukus'
  | 'rebus'
  | 'panggang'
  | 'semur'
  | 'suwir'
  | 'dadar'
  | 'tanak'
  | 'lainnya';

export interface RecipeIngredient {
  ingredientId: string;
  amount: number; // berat/jumlah BERSIH (edible) per `serves`
  options?: string[]; // alternatif bahan setara (mis. potongan ayam lain)
}

export interface Recipe {
  id: string;
  name: string;
  category: RecipeCategory;
  role: RecipeRole;
  protein: ProteinType;
  serves: number; // jumlah porsi dewasa-ekuivalen yang dihasilkan bahan di atas
  ingredients: RecipeIngredient[];
  bumbu: { type: BumbuId; grams: number }[];
  method: Method;
  isFried: boolean;
  spice: Spice;
  childMildVariant?: boolean; // porsi anak dipisah sebelum cabai
  ironRich: boolean;
  requiredDish?: RequiredDishId;
  presto?: boolean;
  weekendOk: boolean;
  prepAhead: boolean;
  childPortionFactor?: number; // menimpa faktor porsi anak
  childPortionGrams?: Record<string, number>; // batas gram per porsi anak per bahan (mis. hati)
  prepMin: number;
  cookMin: number;
  steps: string[];
  youtubeQuery: string;
  favorite: boolean;
  custom?: boolean;
  note?: string;
}

// ===== Profil keluarga & preferensi =====
export interface FamilyProfile {
  ibu: { name: string };
  ayah: { name: string };
  anak: {
    name: string;
    birthDate: string;
    birthDateApprox: boolean;
    allergies: string[];
    dislikes: string[];
    favorites: string[];
    doctorNotes: string;
  };
  childPortionFactor: number; // porsi anak relatif terhadap dewasa
  seafoodKnownSafe: { udang: boolean; cumi: boolean };
}

export interface RequiredDishConfig {
  id: RequiredDishId;
  label: string;
  minPerCycle: number;
}

export type BudgetMode = 'HEMAT' | 'NORMAL' | 'FLEKSIBEL' | 'CUSTOM';
export type BudgetStrategy = 'FIXED_WEEKLY' | 'MONTHLY_AVERAGE';

export interface Preferences {
  motherBreakfastEggs: number;
  budgetMode: BudgetMode;
  weeklyBudget: number;
  budgetStrategy: BudgetStrategy;
  beefReserveOn: boolean;
  location: string;
  maxWeekendSessionMin: number;
  adultRiceGPerMeal: number;
  requiredDishes: RequiredDishConfig[];
  cycleMode: 'siklus30' | 'kalender';
}

export interface CashAvailable {
  amount: number;
  updated: string;
}

export interface Settings {
  profile: FamilyProfile;
  prefs: Preferences;
  cash: CashAvailable;
  seedVersion: number;
}

// ===== Rencana menu =====
export interface DayPlan {
  date: string; // yyyy-MM-dd
  mainA: string; // weekday: lauk pagi-siang anak | weekend: Lauk A
  mainB: string; // lauk makan malam keluarga (weekend: Lauk B)
  motherLunch: { mode: 'follow' | 'alt'; recipeId?: string };
  veg: string;
  rice: string;
  riceNote?: string;
  sides: string[]; // tahu/tempe pendamping dewasa
  locked: boolean;
  note?: string;
}

export interface MealPlan {
  id: string;
  name: string;
  start: string;
  end: string;
  status: 'aktif' | 'arsip';
  createdAt: string;
  source: 'seed' | 'generator' | 'manual';
  generatorMode?: GeneratorMode;
  days: DayPlan[];
}

export type GeneratorMode = 'VARIASI_BARU' | 'PALING_HEMAT' | 'MENU_FAVORIT' | 'HABISKAN_STOK';

// ===== Validasi =====
export type Severity = 'error' | 'warning' | 'info';
export interface Issue {
  code: string;
  severity: Severity;
  message: string;
  date?: string;
  member?: Member;
  slot?: 'mainA' | 'mainB' | 'veg' | 'rice' | 'lunch';
  week?: string; // Senin awal minggu
  recipeId?: string;
}

export type FoodStatus = 'SAFE' | 'NEEDS VERIFICATION' | 'NOT SUITABLE';

// ===== Pantry =====
export interface PantryItem {
  id: string;
  ingredientId: string;
  name: string;
  qty: number;
  unit: Unit;
  location: StorageLocation;
  purchasedDate: string;
  frozenDate?: string;
  condition: 'mentah' | 'matang';
  plannedUse?: string;
  safety: 'aman' | 'periksa' | 'tidak_aman';
  price?: number | null;
  useBy: string; // tanggal pakai paling lambat (FEFO)
  confirmed: boolean; // wajib dikonfirmasi pengguna sebelum dihitung sebagai stok
  note?: string;
}

export interface SpiceBatch {
  id: string;
  bumbuId: BumbuId;
  grams: number;
  madeDate: string;
  location: StorageLocation;
  useBy: string;
  confirmed: boolean;
  label: string;
}

// ===== Belanja =====
export interface GroceryItem {
  id: string;
  ingredientId?: string;
  name: string;
  category: IngredientCategory;
  unit: Unit;
  need: number; // kebutuhan kotor (sudah memperhitungkan edible yield)
  stock: number;
  buyQty: number; // setelah pembulatan kemasan
  packs: number;
  estUnitPrice: number | null; // harga per kemasan
  actualPrice: number | null; // total aktual yang dibayar
  subtotal: number | null; // null = harga belum ada
  checked: boolean;
  status: 'to_buy' | 'purchased' | 'available';
  inBudget: boolean;
  manual?: boolean;
}

export interface GroceryList {
  id: string;
  planId: string;
  rangeStart: string;
  rangeEnd: string;
  createdAt: string;
  items: GroceryItem[];
  purchasedAt?: string;
}

// ===== Dapur =====
export interface PrepState {
  id: string; // weekStart
  checks: Record<string, boolean>;
}
export interface CookProgress {
  id: string; // date|session
  checks: Record<string, boolean>;
  done: boolean;
}
export interface FavoriteVideo {
  id: string;
  recipeId: string;
  title: string;
  url: string;
  kind: 'search' | 'url';
  query?: string;
}
export interface RecipeQuery {
  id: string; // recipeId
  query: string;
}

// ===== Balita =====
export type PortionEaten = 'habis' | '3/4' | '1/2' | '1/4' | 'tidak';
export interface JournalEntry {
  id: string;
  date: string;
  slot: MealSlot | 'camilan';
  menu: string;
  recipeId?: string;
  served: PortionEaten;
  eaten: PortionEaten;
  protein: string;
  veg: string;
  rice: string;
  extraFat: string;
  tasteNote: string;
  textureNote: string;
}
export interface GrowthEntry {
  id: string;
  date: string;
  weightKg: number | null;
  heightCm: number | null;
  doctorNote: string;
}
export interface SeafoodEvent {
  id: string;
  date: string;
  type: 'udang' | 'cumi';
  source: 'manual' | 'journal';
}
export interface EggLog {
  id: string; // date
  eaten: number;
}

// ===== Backup =====
export interface BackupFile {
  app: 'home-table';
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}
