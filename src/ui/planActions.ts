import type { MealPlan } from '../types';
import { useApp } from '../state/AppContext';
import { buildGroceryList, mergeWithPrevious } from '../engine/grocery';
import { makeCtx } from '../engine/context';

/** Menyimpan perubahan rencana dan menyegarkan daftar belanja yang BELUM dibeli (belanja/budget/bumbu/prep dihitung ulang dari rencana). */
export function usePlanActions() {
  const app = useApp();
  return {
    async commit(plan: MealPlan, message = 'Menu diperbarui') {
      await app.save('plans', plan);
      const ctx = makeCtx(app.data.ingredients, app.data.recipes, app.data.settings.profile, app.data.settings.prefs);
      let refreshed = 0;
      for (const l of app.data.groceryLists.filter((g) => g.planId === plan.id)) {
        if (l.items.some((i) => i.status === 'purchased')) continue; // jangan timpa belanja yang sudah dikonfirmasi
        const days = plan.days.filter((d) => d.date >= l.rangeStart && d.date <= l.rangeEnd);
        const fresh = buildGroceryList(plan.id, days, ctx, app.data.pantry, app.today);
        await app.save('groceryLists', mergeWithPrevious({ ...fresh, id: l.id }, l));
        refreshed++;
      }
      app.toast(refreshed ? `${message}. Daftar belanja diperbarui.` : message);
    },
  };
}
