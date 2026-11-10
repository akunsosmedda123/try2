import { CalendarDays, Home, Settings, ShoppingBasket, UtensilsCrossed } from 'lucide-react';
import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import HomePage from './pages/HomePage';
import MealPlanPage from './pages/MealPlanPage';
import GroceryPage from './pages/GroceryPage';
import SettingsPage from './pages/SettingsPage';
import { BumbuPage, CookPage, FoodPrepPage, KitchenHub, PantryPage } from './pages/KitchenPages';
import { CookWithPage, RecipeDetail, RecipeForm, RecipeLibrary } from './pages/RecipePages';
import { GrowthPage, JournalPage, NutritionPage, RicePage, ToddlerHub } from './pages/ToddlerPages';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/rencana', label: 'Meal Plan', icon: CalendarDays },
  { to: '/belanja', label: 'Grocery', icon: ShoppingBasket },
  { to: '/dapur', label: 'Kitchen', icon: UtensilsCrossed },
  { to: '/pengaturan', label: 'Settings', icon: Settings },
];

export default function App() {
  const { toastMsg } = useApp();
  return (
    <div className="mx-auto min-h-screen max-w-xl bg-warm">
      <header className="no-print sticky top-0 z-30 border-b border-beige bg-warm/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-baseline gap-2"><span className="text-base font-extrabold tracking-tight text-sage-dark">HOME TABLE</span><span className="text-[11px] text-charcoal/55">Plan Smart, Cook Happy, Eat Better.</span></div>
      </header>
      <main className="px-4 pb-28 pt-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/rencana" element={<MealPlanPage />} />
          <Route path="/belanja" element={<GroceryPage />} />
          <Route path="/dapur" element={<KitchenHub />} />
          <Route path="/dapur/resep" element={<RecipeLibrary />} />
          <Route path="/dapur/resep/baru" element={<RecipeForm />} />
          <Route path="/dapur/resep/:id" element={<RecipeDetail />} />
          <Route path="/dapur/resep/:id/edit" element={<RecipeForm />} />
          <Route path="/dapur/bumbu" element={<BumbuPage />} />
          <Route path="/dapur/prep" element={<FoodPrepPage />} />
          <Route path="/dapur/pantry" element={<PantryPage />} />
          <Route path="/dapur/masak-dari-stok" element={<CookWithPage />} />
          <Route path="/dapur/masak" element={<CookPage />} />
          <Route path="/balita" element={<ToddlerHub />} />
          <Route path="/balita/nutrisi" element={<NutritionPage />} />
          <Route path="/balita/nasi" element={<RicePage />} />
          <Route path="/balita/jurnal" element={<JournalPage />} />
          <Route path="/balita/tumbuh" element={<GrowthPage />} />
          <Route path="/pengaturan" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {toastMsg && <div role="status" className="no-print fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-charcoal px-4 py-2 text-sm text-white shadow-lg">{toastMsg}</div>}
      <nav aria-label="Navigasi utama" className="no-print safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-beige bg-warm/95 backdrop-blur">
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? 'text-sage-dark' : 'text-charcoal/55'}`}>
                <Icon size={20} />{label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
