'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Save, Loader2, Plus, Trash2, Utensils } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface MealItem {
  id?: string;
  name: string;
  display_name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fats_total: number;
  fiber: number;
  sugars_total: number;
  rationale: string;
  _base_qty?: number;
  _base_calories?: number;
  _base_protein?: number;
  _base_carbs?: number;
  _base_fats_total?: number;
  _base_fiber?: number;
  _base_sugars_total?: number;
  _dish_ingredients?: DishIngredientEdit[];
}

interface KitchenItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats_total: number;
  fiber: number;
  sugars_total: number;
  serving_amount?: number;
  serving_unit?: string;
  serving_size?: string;
  description?: string;
}

interface DishIngredientEdit {
  name: string;
  amountMode: 'qty' | 'weight';
  quantity: number;
  weightValue: number;
  weightUnit: 'g' | 'ml';
  initialQuantity?: number;
  initialWeightValue?: number;
}

interface Meal {
  id: string;
  name: string;
  type: string;
  description?: string;
  created_at: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  total_fiber: number;
  total_sugars_total: number;
}

interface EditMealModalProps {
  meal: Meal;
  items: MealItem[];
  onClose: () => void;
  onSave: () => void;
}

export default function EditMealModal({ meal, items: initialItems, onClose, onSave }: EditMealModalProps) {
  const draftHydratedRef = useRef(false);
  const [name, setName] = useState(meal.name);
  const [type, setType] = useState(meal.type);
  const [description, setDescription] = useState(meal.description || '');
  const [editDate, setEditDate] = useState(() => new Date(meal.created_at).toLocaleDateString('en-CA'));
  const [editTime, setEditTime] = useState(() => new Date(meal.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  const withBase = (item: MealItem): MealItem => ({
    ...item,
    quantity: Number.isFinite(item.quantity) ? item.quantity : 1,
    _base_qty: Number.isFinite(item.quantity) ? item.quantity : 1,
    _base_calories: Number.isFinite(item.calories) ? item.calories : 0,
    _base_protein: Number.isFinite(item.protein) ? item.protein : 0,
    _base_carbs: Number.isFinite(item.carbs) ? item.carbs : 0,
    _base_fats_total: Number.isFinite(item.fats_total) ? item.fats_total : 0,
    _base_fiber: Number.isFinite(item.fiber) ? item.fiber : 0,
    _base_sugars_total: Number.isFinite(item.sugars_total) ? item.sugars_total : 0,
  });
  const [items, setItems] = useState<MealItem[]>(() => initialItems.map(withBase));
  const [kitchenItems, setKitchenItems] = useState<KitchenItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const draftStorageKey = `guiltfree.edit-meal-draft.${meal.id}`;

  const getKitchenBreakdown = (item: MealItem) => {
    if (!item.rationale) return null;
    const marker = 'Built from kitchen items:';
    const idx = item.rationale.toLowerCase().indexOf(marker.toLowerCase());
    if (idx === -1) return null;
    return item.rationale.slice(idx + marker.length).trim();
  };

  useEffect(() => {
    draftHydratedRef.current = false;
  }, [draftStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || draftHydratedRef.current) return;
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        name?: string;
        type?: string;
        description?: string;
        editDate?: string;
        editTime?: string;
        items?: MealItem[];
      };
      if (typeof parsed.name === 'string') setName(parsed.name);
      if (typeof parsed.type === 'string') setType(parsed.type);
      if (typeof parsed.description === 'string') setDescription(parsed.description);
      if (typeof parsed.editDate === 'string') setEditDate(parsed.editDate);
      if (typeof parsed.editTime === 'string') setEditTime(parsed.editTime);
      if (Array.isArray(parsed.items) && parsed.items.length > 0) setItems(parsed.items.map(withBase));
      draftHydratedRef.current = true;
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (draftHydratedRef.current) return;
    setItems(initialItems.map(withBase));
  }, [initialItems]);

  useEffect(() => {
    const fetchKitchenItems = async () => {
      const { data } = await supabase
        .from('kitchen_items')
        .select('*');
      setKitchenItems((data || []) as KitchenItem[]);
    };
    void fetchKitchenItems();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = { name, type, description, editDate, editTime, items };
    window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
  }, [draftStorageKey, name, type, description, editDate, editTime, items]);

  const handleUpdateItem = (index: number, field: keyof MealItem, value: any) => {
    const newItems = [...items];
    const next = { ...newItems[index], [field]: value };

    if (['calories', 'protein', 'carbs', 'fats_total', 'fiber', 'sugars_total'].includes(field)) {
      const baseQty = next.quantity && next.quantity > 0 ? next.quantity : 1;
      next._base_qty = baseQty;
      if (field === 'calories') next._base_calories = Number(value) || 0;
      if (field === 'protein') next._base_protein = Number(value) || 0;
      if (field === 'carbs') next._base_carbs = Number(value) || 0;
      if (field === 'fats_total') next._base_fats_total = Number(value) || 0;
      if (field === 'fiber') next._base_fiber = Number(value) || 0;
      if (field === 'sugars_total') next._base_sugars_total = Number(value) || 0;
    }

    newItems[index] = next;
    setItems(newItems);
  };

  const handleUpdateQuantity = (index: number, quantity: number) => {
    const safeQty = Number.isFinite(quantity) ? Math.max(quantity, 0) : 0;
    const newItems = [...items];
    const item = newItems[index];
    const baseQty = item._base_qty && item._base_qty > 0 ? item._base_qty : 1;
    const scale = safeQty / baseQty;

    newItems[index] = {
      ...item,
      quantity: safeQty,
      calories: Math.round((item._base_calories || 0) * scale),
      protein: Number(((item._base_protein || 0) * scale).toFixed(1)),
      carbs: Number(((item._base_carbs || 0) * scale).toFixed(1)),
      fats_total: Number(((item._base_fats_total || 0) * scale).toFixed(1)),
      fiber: Number(((item._base_fiber || 0) * scale).toFixed(1)),
      sugars_total: Number(((item._base_sugars_total || 0) * scale).toFixed(1)),
    };

    setItems(newItems);
  };

  const parseServingFromText = (text?: string): { amount: number; unit: 'g' | 'ml' } | null => {
    if (!text) return null;
    const match = text.match(/(\d+(?:\.\d+)?)\s*(g|gram|grams|ml)\b/i);
    if (!match) return null;
    const amount = parseFloat(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const rawUnit = match[2].toLowerCase();
    const unit: 'g' | 'ml' = rawUnit.startsWith('g') ? 'g' : 'ml';
    return { amount, unit };
  };

  const getItemServingReference = (item: KitchenItem): { amount: number; unit: 'g' | 'ml' | 'qty' } => {
    const explicitAmount = item.serving_amount;
    const explicitUnit = item.serving_unit?.toLowerCase();
    if (explicitAmount && explicitAmount > 0 && explicitUnit) {
      if (explicitUnit.includes('g')) return { amount: explicitAmount, unit: 'g' };
      if (explicitUnit.includes('ml')) return { amount: explicitAmount, unit: 'ml' };
    }

    const parsed = parseServingFromText(item.serving_size || item.description);
    if (parsed) return parsed;

    return { amount: 1, unit: 'qty' };
  };

  const normalizeIngredientName = (value: string) =>
    value
      .replace(/^[\s"'`]+/, '')
      .replace(/[\s"'`.,;:!?]+$/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const kitchenMacroTotal = (item: KitchenItem) =>
    (item.calories || 0) +
    (item.protein || 0) +
    (item.carbs || 0) +
    (item.fats_total || 0) +
    (item.fiber || 0) +
    (item.sugars_total || 0);

  const scoreKitchenMatch = (target: string, candidate: KitchenItem) => {
    const name = normalizeIngredientName(candidate.name);
    if (!name) return -1;
    if (name === target) return 1000 + kitchenMacroTotal(candidate);
    if (name.startsWith(target) || target.startsWith(name)) return 700 + kitchenMacroTotal(candidate);
    if (name.includes(target) || target.includes(name)) return 500 + kitchenMacroTotal(candidate);

    const targetTokens = new Set(target.split(' ').filter(Boolean));
    const nameTokens = new Set(name.split(' ').filter(Boolean));
    let overlap = 0;
    targetTokens.forEach((token) => {
      if (nameTokens.has(token)) overlap += 1;
    });
    if (overlap === 0) return -1;
    return overlap * 100 + kitchenMacroTotal(candidate);
  };

  const getKitchenByName = (name: string) => {
    const normalized = normalizeIngredientName(name);
    let best: KitchenItem | undefined;
    let bestScore = -1;
    for (const item of kitchenItems) {
      const score = scoreKitchenMatch(normalized, item);
      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    }
    return best;
  };

  const parseDishIngredientsFromRationale = (rationale?: string): DishIngredientEdit[] => {
    if (!rationale) return [];
    const marker = 'Built from kitchen items:';
    const markerIdx = rationale.toLowerCase().indexOf(marker.toLowerCase());
    if (markerIdx < 0) return [];
    const source = rationale.slice(markerIdx + marker.length).trim();
    const pattern = /(\d+(?:\.\d+)?)\s*(x|g|ml)\s+(.+?)(?=(?:,\s*\d+(?:\.\d+)?\s*(?:x|g|ml)\s+)|$)/gi;
    const parsed: DishIngredientEdit[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const value = parseFloat(match[1]);
      if (!Number.isFinite(value)) continue;
      const rawUnit = match[2].toLowerCase();
      const name = match[3].replace(/["'`]+$/g, '').trim();
      if (!name) continue;
      if (rawUnit === 'x') {
        parsed.push({
          name,
          amountMode: 'qty',
          quantity: Math.max(value, 0),
          weightValue: 0,
          weightUnit: 'g',
          initialQuantity: Math.max(value, 0),
          initialWeightValue: 0
        });
      } else {
        const unit = rawUnit === 'ml' ? 'ml' : 'g';
        parsed.push({
          name,
          amountMode: 'weight',
          quantity: 1,
          weightValue: Math.max(value, 0),
          weightUnit: unit,
          initialQuantity: 1,
          initialWeightValue: Math.max(value, 0)
        });
      }
    }
    return parsed;
  };

  const buildDishRationale = (ingredients: DishIngredientEdit[]) =>
    `Built from kitchen items: ${ingredients.map((ingredient) => (
      ingredient.amountMode === 'weight'
        ? `${ingredient.weightValue}${ingredient.weightUnit} ${ingredient.name}`
        : `${ingredient.quantity}x ${ingredient.name}`
    )).join(', ')}`;

  const hydrateDishIngredients = (item: MealItem): DishIngredientEdit[] => {
    if (item._dish_ingredients && item._dish_ingredients.length > 0) return item._dish_ingredients;
    return parseDishIngredientsFromRationale(item.rationale);
  };

  const recalculateDishItem = (item: MealItem, dishIngredients: DishIngredientEdit[]) => {
    const dishQty = Number.isFinite(item.quantity) ? Math.max(item.quantity, 0) : 0;
    let matchedIngredients = 0;

    const perDishTotals = dishIngredients.reduce((acc, ingredient) => {
      const kitchenMatch = getKitchenByName(ingredient.name);
      if (!kitchenMatch) return acc;
      matchedIngredients += 1;

      const serving = getItemServingReference(kitchenMatch);
      let multiplier = 0;
      const initialQty = Number.isFinite(ingredient.initialQuantity) ? Math.max(ingredient.initialQuantity || 0, 0) : 0;
      const initialWeight = Number.isFinite(ingredient.initialWeightValue) ? Math.max(ingredient.initialWeightValue || 0, 0) : 0;

      if (ingredient.amountMode === 'qty') {
        multiplier = Number.isFinite(ingredient.quantity) ? Math.max(ingredient.quantity, 0) : 0;
      } else if (serving.unit !== 'qty' && serving.unit === ingredient.weightUnit && serving.amount > 0) {
        multiplier = (Number.isFinite(ingredient.weightValue) ? Math.max(ingredient.weightValue, 0) : 0) / serving.amount;
      } else if (initialWeight > 0) {
        // If serving metadata is unavailable, treat initial logged weight as baseline.
        multiplier = (Number.isFinite(ingredient.weightValue) ? Math.max(ingredient.weightValue, 0) : 0) / initialWeight;
      } else if (initialQty > 0) {
        multiplier = (Number.isFinite(ingredient.quantity) ? Math.max(ingredient.quantity, 0) : 0) / initialQty;
      } else {
        multiplier = Number.isFinite(ingredient.quantity) ? Math.max(ingredient.quantity, 0) : 0;
      }

      acc.calories += (kitchenMatch.calories || 0) * multiplier;
      acc.protein += (kitchenMatch.protein || 0) * multiplier;
      acc.carbs += (kitchenMatch.carbs || 0) * multiplier;
      acc.fats += (kitchenMatch.fats_total || 0) * multiplier;
      acc.fiber += (kitchenMatch.fiber || 0) * multiplier;
      acc.sugars += (kitchenMatch.sugars_total || 0) * multiplier;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sugars: 0 });

    const ingredientEquivalent = (ingredient: DishIngredientEdit, useInitial: boolean) => {
      const kitchenMatch = getKitchenByName(ingredient.name);
      const rawQty = useInitial ? (ingredient.initialQuantity ?? ingredient.quantity) : ingredient.quantity;
      const rawWeight = useInitial ? (ingredient.initialWeightValue ?? ingredient.weightValue) : ingredient.weightValue;

      if (ingredient.amountMode === 'qty') {
        return Number.isFinite(rawQty) ? Math.max(rawQty, 0) : 0;
      }

      if (kitchenMatch) {
        const serving = getItemServingReference(kitchenMatch);
        if (serving.unit !== 'qty' && serving.unit === ingredient.weightUnit && serving.amount > 0) {
          return (Number.isFinite(rawWeight) ? Math.max(rawWeight, 0) : 0) / serving.amount;
        }
      }

      return Number.isFinite(rawWeight) ? Math.max(rawWeight, 0) : 0;
    };

    // Ratio-based fallback for partially/unmatched kitchen item names.
    // This guarantees visible recalculation and avoids zeroing macros.
    const baseDishQty = item._base_qty && item._base_qty > 0 ? item._base_qty : 1;
    const perDishBaseCalories = (item._base_calories || 0) / baseDishQty;
    const perDishBaseProtein = (item._base_protein || 0) / baseDishQty;
    const perDishBaseCarbs = (item._base_carbs || 0) / baseDishQty;
    const perDishBaseFats = (item._base_fats_total || 0) / baseDishQty;
    const perDishBaseFiber = (item._base_fiber || 0) / baseDishQty;
    const perDishBaseSugars = (item._base_sugars_total || 0) / baseDishQty;

    const perDishTotalSum =
      perDishTotals.calories + perDishTotals.protein + perDishTotals.carbs +
      perDishTotals.fats + perDishTotals.fiber + perDishTotals.sugars;
    const perDishBaseSum =
      perDishBaseCalories + perDishBaseProtein + perDishBaseCarbs +
      perDishBaseFats + perDishBaseFiber + perDishBaseSugars;

    if (matchedIngredients < dishIngredients.length || (perDishTotalSum === 0 && perDishBaseSum > 0)) {
      const currentEquivalent = dishIngredients.reduce((sum, ingredient) => sum + ingredientEquivalent(ingredient, false), 0);
      const baseEquivalent = dishIngredients.reduce((sum, ingredient) => sum + ingredientEquivalent(ingredient, true), 0);
      const ratio = baseEquivalent > 0 ? (currentEquivalent / baseEquivalent) : 1;
      const safeRatio = Number.isFinite(ratio) && ratio >= 0 ? ratio : 1;

      return {
        ...item,
        _dish_ingredients: dishIngredients,
        _base_qty: 1,
        _base_calories: Math.round(perDishBaseCalories * safeRatio),
        _base_protein: Number((perDishBaseProtein * safeRatio).toFixed(1)),
        _base_carbs: Number((perDishBaseCarbs * safeRatio).toFixed(1)),
        _base_fats_total: Number((perDishBaseFats * safeRatio).toFixed(1)),
        _base_fiber: Number((perDishBaseFiber * safeRatio).toFixed(1)),
        _base_sugars_total: Number((perDishBaseSugars * safeRatio).toFixed(1)),
        calories: Math.round(perDishBaseCalories * safeRatio * dishQty),
        protein: Number((perDishBaseProtein * safeRatio * dishQty).toFixed(1)),
        carbs: Number((perDishBaseCarbs * safeRatio * dishQty).toFixed(1)),
        fats_total: Number((perDishBaseFats * safeRatio * dishQty).toFixed(1)),
        fiber: Number((perDishBaseFiber * safeRatio * dishQty).toFixed(1)),
        sugars_total: Number((perDishBaseSugars * safeRatio * dishQty).toFixed(1)),
        rationale: buildDishRationale(dishIngredients)
      };
    }

    return {
      ...item,
      _dish_ingredients: dishIngredients,
      _base_qty: 1,
      _base_calories: Math.round(perDishTotals.calories),
      _base_protein: Number(perDishTotals.protein.toFixed(1)),
      _base_carbs: Number(perDishTotals.carbs.toFixed(1)),
      _base_fats_total: Number(perDishTotals.fats.toFixed(1)),
      _base_fiber: Number(perDishTotals.fiber.toFixed(1)),
      _base_sugars_total: Number(perDishTotals.sugars.toFixed(1)),
      calories: Math.round(perDishTotals.calories * dishQty),
      protein: Number((perDishTotals.protein * dishQty).toFixed(1)),
      carbs: Number((perDishTotals.carbs * dishQty).toFixed(1)),
      fats_total: Number((perDishTotals.fats * dishQty).toFixed(1)),
      fiber: Number((perDishTotals.fiber * dishQty).toFixed(1)),
      sugars_total: Number((perDishTotals.sugars * dishQty).toFixed(1)),
      rationale: buildDishRationale(dishIngredients)
    };
  };

  const handleUpdateDishIngredient = (
    itemIdx: number,
    ingredientIdx: number,
    field: keyof DishIngredientEdit,
    value: string
  ) => {
    const newItems = [...items];
    const item = { ...newItems[itemIdx] };
    const dishIngredients = [...hydrateDishIngredients(item)];
    if (!dishIngredients[ingredientIdx]) return;

    const next = { ...dishIngredients[ingredientIdx] };
    if (field === 'amountMode') {
      next.amountMode = value as 'qty' | 'weight';
    } else if (field === 'weightUnit') {
      next.weightUnit = value as 'g' | 'ml';
    } else if (field === 'quantity' || field === 'weightValue') {
      const parsed = parseFloat(value);
      (next as any)[field] = Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
    } else {
      (next as any)[field] = value;
    }

    dishIngredients[ingredientIdx] = next;
    newItems[itemIdx] = recalculateDishItem(item, dishIngredients);
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    setItems([...items, {
      name: 'New Item',
      display_name: 'New Item',
      quantity: 1,
      unit: 'serving',
      calories: 0,
      protein: 0,
      carbs: 0,
      fats_total: 0,
      fiber: 0,
      sugars_total: 0,
      rationale: 'Manually added',
      _base_qty: 1,
      _base_calories: 0,
      _base_protein: 0,
      _base_carbs: 0,
      _base_fats_total: 0,
      _base_fiber: 0,
      _base_sugars_total: 0
    }]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Calculate new totals
      const totals = items.reduce((acc, item) => ({
        calories: acc.calories + (item.calories || 0),
        protein: acc.protein + (item.protein || 0),
        carbs: acc.carbs + (item.carbs || 0),
        fats: acc.fats + (item.fats_total || 0),
        fiber: acc.fiber + (item.fiber || 0),
        sugars: acc.sugars + (item.sugars_total || 0),
      }), { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sugars: 0 });

      // 2. Update meal record
      const { error: mealError } = await supabase
        .from('meals')
        .update({
          name,
          type,
          description,
          created_at: new Date(`${editDate}T${editTime}`).toISOString(),
          total_calories: Math.round(totals.calories),
          total_protein: Math.round(totals.protein),
          total_carbs: Math.round(totals.carbs),
          total_fats: Math.round(totals.fats),
          total_fiber: Math.round(totals.fiber),
          total_sugars_total: Math.round(totals.sugars)
        })
        .eq('id', meal.id);

      if (mealError) throw mealError;

      // 3. Simple approach for items: Delete existing and re-insert
      const { error: deleteError } = await supabase
        .from('meal_items')
        .delete()
        .eq('meal_id', meal.id);

      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from('meal_items')
        .insert(items.map(item => ({
          meal_id: meal.id,
          name: item.name,
          display_name: item.display_name,
          quantity: item.quantity,
          unit: item.unit,
          calories: Math.round(item.calories || 0),
          protein: Math.round(item.protein || 0),
          carbs: Math.round(item.carbs || 0),
          fats_total: Math.round(item.fats_total || 0),
          fiber: Math.round(item.fiber || 0),
          sugars_total: Math.round(item.sugars_total || 0),
          rationale: item.rationale
        })));

      if (insertError) throw insertError;

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(draftStorageKey);
      }
      onSave();
      onClose();
    } catch (err: any) {
      console.error('Error saving meal:', err);
      alert('Failed to save changes: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[calc(100dvh-0.5rem)] sm:max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        <div className="p-5 sm:p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/30 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Utensils className="w-5 h-5" />
            </div>
            <h2 className="text-4xl sm:text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">Edit Meal</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="overflow-y-auto overflow-x-hidden p-5 sm:p-8 pb-28 sm:pb-8 flex-1 space-y-8">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Meal Name</label>
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-w-0 px-4 sm:px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none font-bold text-zinc-900 dark:text-white transition-all shadow-inner"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Meal Type</label>
              <select 
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full min-w-0 px-4 sm:px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none font-bold text-zinc-900 dark:text-white transition-all shadow-inner appearance-none"
              >
                {['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            <div className="space-y-2 min-w-0">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Date</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="block w-full min-w-0 max-w-full px-4 py-3 sm:py-4 bg-zinc-50 dark:bg-zinc-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none font-semibold text-sm sm:text-base text-zinc-900 dark:text-white transition-all shadow-inner appearance-none"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Time</label>
              <input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="block w-full min-w-0 max-w-full px-4 py-3 sm:py-4 bg-zinc-50 dark:bg-zinc-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none font-semibold text-sm sm:text-base text-zinc-900 dark:text-white transition-all shadow-inner appearance-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Description / Notes (Optional)</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add some notes about this meal..."
              className="w-full min-w-0 px-4 sm:px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none font-bold text-zinc-900 dark:text-white transition-all shadow-inner h-24 resize-none"
            />
          </div>

          {/* Items List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest">Ingredients</h3>
              <button 
                onClick={handleAddItem}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Ingredient
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="group p-4 sm:p-6 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-3xl space-y-4 transition-all hover:border-indigo-200 dark:hover:border-indigo-500/30">
                  <div className="flex justify-between gap-4">
                    <input 
                      type="text"
                      placeholder="Ingredient name"
                      value={item.display_name}
                      onChange={(e) => handleUpdateItem(idx, 'display_name', e.target.value)}
                      className="flex-1 bg-transparent font-bold text-zinc-900 dark:text-white outline-none placeholder:text-zinc-300"
                    />
                    <button 
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-zinc-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {item.unit?.toLowerCase() === 'dish' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 opacity-70">Dish Qty</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={item.quantity ?? 0}
                          onChange={(e) => handleUpdateQuantity(idx, parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 opacity-70">Source</span>
                        <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-bold text-zinc-500 dark:text-zinc-300">
                          Kitchen dish
                        </div>
                      </div>
                      {getKitchenBreakdown(item) && (
                        <p className="sm:col-span-2 text-[11px] leading-relaxed text-zinc-500 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-700 rounded-xl px-3 py-2">
                          Logged ingredients: {getKitchenBreakdown(item)}
                        </p>
                      )}
                      {hydrateDishIngredients(item).length > 0 && (
                        <div className="sm:col-span-2 space-y-2">
                          <p className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Dish Ingredients (editable)</p>
                          {hydrateDishIngredients(item).map((ingredient, ingredientIdx) => (
                            <div key={`${ingredient.name}-${ingredientIdx}`} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 p-2 rounded-lg border border-zinc-100 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 truncate">{ingredient.name}</span>
                              <div className="flex items-center rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 w-fit">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateDishIngredient(idx, ingredientIdx, 'amountMode', 'qty')}
                                  className={`px-2 py-1 text-[10px] font-bold rounded-md ${ingredient.amountMode === 'qty' ? 'bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100' : 'text-zinc-500'}`}
                                >
                                  Qty
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateDishIngredient(idx, ingredientIdx, 'amountMode', 'weight')}
                                  className={`px-2 py-1 text-[10px] font-bold rounded-md ${ingredient.amountMode === 'weight' ? 'bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100' : 'text-zinc-500'}`}
                                >
                                  g/ml
                                </button>
                              </div>
                              {ingredient.amountMode === 'qty' ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={ingredient.quantity}
                                  onChange={(e) => handleUpdateDishIngredient(idx, ingredientIdx, 'quantity', e.target.value)}
                                  className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-1 text-xs font-bold outline-none w-24"
                                />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={ingredient.weightValue}
                                    onChange={(e) => handleUpdateDishIngredient(idx, ingredientIdx, 'weightValue', e.target.value)}
                                    className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-1 text-xs font-bold outline-none w-20"
                                  />
                                  <select
                                    value={ingredient.weightUnit}
                                    onChange={(e) => handleUpdateDishIngredient(idx, ingredientIdx, 'weightUnit', e.target.value)}
                                    className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-1 text-xs font-bold outline-none"
                                  >
                                    <option value="g">g</option>
                                    <option value="ml">ml</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 opacity-70">Qty</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={item.quantity ?? 0}
                          onChange={(e) => handleUpdateQuantity(idx, parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 opacity-70">Unit</span>
                        <input
                          type="text"
                          value={item.unit || ''}
                          onChange={(e) => handleUpdateItem(idx, 'unit', e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {[
                      { label: 'Cals', key: 'calories', color: 'text-zinc-500' },
                      { label: 'Prot', key: 'protein', color: 'text-indigo-500' },
                      { label: 'Carbs', key: 'carbs', color: 'text-amber-500' },
                      { label: 'Fats', key: 'fats_total', color: 'text-orange-500' },
                      { label: 'Fibr', key: 'fiber', color: 'text-emerald-500' },
                      { label: 'Sugr', key: 'sugars_total', color: 'text-pink-500' }
                    ].map(field => (
                      <div key={field.key} className="flex flex-col gap-1.5">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${field.color} opacity-70`}>{field.label}</span>
                        <input
                          type="number"
                          step="0.1"
                          value={(() => {
                            const val = item[field.key as keyof MealItem] as number;
                            return Number.isFinite(val) ? val : '';
                          })()}
                          onChange={(e) => handleUpdateItem(idx, field.key as keyof MealItem, e.target.value === '' ? '' : parseFloat(e.target.value))}
                          onBlur={(e) => handleUpdateItem(idx, field.key as keyof MealItem, parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-8 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
          <button 
            onClick={handleSave}
            disabled={isSaving || !name || items.length === 0}
            className="w-full py-5 bg-indigo-600 dark:bg-indigo-500 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
