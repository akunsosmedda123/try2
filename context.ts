import type { FamilyProfile, Ingredient, Preferences, Recipe } from '../types';

export interface Ctx {
  ingredients: Map<string, Ingredient>;
  recipes: Map<string, Recipe>;
  profile: FamilyProfile;
  prefs: Preferences;
}

export function makeCtx(
  ingredients: Ingredient[],
  recipes: Recipe[],
  profile: FamilyProfile,
  prefs: Preferences,
): Ctx {
  return {
    ingredients: new Map(ingredients.map((i) => [i.id, i])),
    recipes: new Map(recipes.map((r) => [r.id, r])),
    profile,
    prefs,
  };
}
