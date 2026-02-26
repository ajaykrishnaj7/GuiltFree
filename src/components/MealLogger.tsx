'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Loader2, Plus, Check, X, ChefHat, Zap, History, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import AuthModal from './AuthModal';
import { AISettings, DEFAULT_AI_SETTINGS, loadAISettings } from '@/lib/aiSettings';

interface NutritionData {
  name: string;
  quantity: number;
  unit: string;
  display_name: string;
  rationale: string;
  calories: number;
  protein: number;
  fiber: number;
  fats: {
    saturated: number;
    unsaturated: number;
    total: number;
  };
  carbs: number;
  sugars: {
    natural: number;
    added: number;
    total: number;
  };
  // Base values for accurate quantity scaling (stored at qty=original)
  _base_qty?: number;
  _base_calories?: number;
  _base_protein?: number;
  _base_carbs?: number;
  _base_fiber?: number;
  _base_fats_total?: number;
  _base_sugars_total?: number;
}

interface MealData {
  meal_name: string;
  meal_type: string;
  items: NutritionData[];
}

interface KitchenItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  fiber: number;
  carbs: number;
  fats_total: number;
  sugars_total: number;
  description?: string;
  serving_size?: string;
  serving_amount?: number;
  serving_unit?: string;
}

interface DishIngredient {
  item: KitchenItem;
  quantity: number;
  amountMode: 'qty' | 'weight';
  weightValue: number;
  weightUnit: 'g' | 'ml';
}

interface DishDraft {
  id: string;
  name: string;
  ingredients: DishIngredient[];
}

export default function MealLogger() {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const draftHydratedRef = useRef(false);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedMeals, setParsedMeals] = useState<MealData[] | null>(null);
  const [aiSettings, setAISettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);

  const [isManual, setIsManual] = useState(false);
  const [logDate, setLogDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [logTime, setLogTime] = useState(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  const [manualData, setManualData] = useState({
    meal_name: '',
    meal_type: 'Lunch',
    calories: 0,
    protein: 0,
    fiber: 0,
    carbs: 0,
    fats: 0,
    sugars: 0,
    description: ''
  });
  const [manualEntryMode, setManualEntryMode] = useState<'quick' | 'kitchen'>('quick');
  const [dishDrafts, setDishDrafts] = useState<DishDraft[]>([{ id: `dish-${Date.now()}`, name: 'Dish 1', ingredients: [] }]);
  const [dishSearch, setDishSearch] = useState<Record<string, string>>({});
  const [dishInputDrafts, setDishInputDrafts] = useState<Record<string, string>>({});
  const draftScope = user?.id || 'anon';
  const draftStorageKey = `guiltfree.meal-logger-draft.${draftScope}`;

  const handleManualSubmit = () => {
    setError(null);
    const newMeal: MealData = {
      meal_name: manualData.meal_name,
      meal_type: manualData.meal_type,
      items: [{
        name: manualData.meal_name,
        display_name: manualData.meal_name,
        quantity: 1,
        unit: 'serving',
        calories: Math.round(manualData.calories),
        protein: manualData.protein,
        fiber: manualData.fiber,
        carbs: manualData.carbs,
        fats: { total: manualData.fats, saturated: 0, unsaturated: 0 },
        sugars: { total: manualData.sugars, natural: 0, added: 0 },
        rationale: "Manually entered"
      }]
    };
    setParsedMeals([newMeal]);
    setManualData({ ...manualData, meal_name: '', calories: 0, protein: 0, fiber: 0, carbs: 0, fats: 0, sugars: 0, description: '' });
  };

  const getDraftedIngredientNumber = (
    dishId: string,
    itemId: string,
    field: 'qty' | 'weight',
    fallback: number
  ) => {
    const key = `${dishId}:${itemId}:${field}`;
    if (!Object.prototype.hasOwnProperty.call(dishInputDrafts, key)) return fallback;
    const trimmed = dishInputDrafts[key].trim();
    const parsed = trimmed === '' ? 0 : parseFloat(trimmed);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(parsed, 0);
  };

  const calculateDishNutrition = (dish: DishDraft) => {
    return dish.ingredients.reduce((acc, ing) => {
      const draftedQuantity = getDraftedIngredientNumber(dish.id, ing.item.id, 'qty', ing.quantity);
      const draftedWeight = getDraftedIngredientNumber(dish.id, ing.item.id, 'weight', ing.weightValue);

      let multiplier = 0;
      if (ing.amountMode === 'qty') {
        multiplier = draftedQuantity;
      } else {
        const serving = getItemServingReference(ing.item);
        if (serving.unit === 'qty' || serving.unit !== ing.weightUnit || serving.amount <= 0) {
          multiplier = draftedQuantity;
        } else {
          multiplier = draftedWeight / serving.amount;
        }
      }

      acc.calories += (ing.item.calories || 0) * multiplier;
      acc.protein += (ing.item.protein || 0) * multiplier;
      acc.fiber += (ing.item.fiber || 0) * multiplier;
      acc.carbs += (ing.item.carbs || 0) * multiplier;
      acc.fats += (ing.item.fats_total || 0) * multiplier;
      acc.sugars += (ing.item.sugars_total || 0) * multiplier;
      return acc;
    }, {
      calories: 0,
      protein: 0,
      fiber: 0,
      carbs: 0,
      fats: 0,
      sugars: 0
    });
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
    if (parsed) {
      return parsed;
    }

    return { amount: 1, unit: 'qty' };
  };

  const canUseWeightMode = (item: KitchenItem) => {
    const serving = getItemServingReference(item);
    return serving.unit === 'g' || serving.unit === 'ml';
  };

  const addDish = () => {
    const nextDishIndex = dishDrafts.length + 1;
    const id = `dish-${Date.now()}-${nextDishIndex}`;
    setDishDrafts(prev => [...prev, { id, name: `Dish ${nextDishIndex}`, ingredients: [] }]);
  };

  const removeDish = (dishId: string) => {
    setDishDrafts(prev => {
      const next = prev.filter(dish => dish.id !== dishId);
      return next.length > 0 ? next : [{ id: `dish-${Date.now()}`, name: 'Dish 1', ingredients: [] }];
    });
    setDishSearch(prev => {
      const next = { ...prev };
      delete next[dishId];
      return next;
    });
  };

  const updateDishName = (dishId: string, name: string) => {
    setDishDrafts(prev => prev.map(dish => dish.id === dishId ? { ...dish, name } : dish));
  };

  const addIngredientToDish = (dishId: string, item: KitchenItem) => {
    setDishDrafts(prev => prev.map(dish => {
      if (dish.id !== dishId) return dish;
      const existingIdx = dish.ingredients.findIndex(ingredient => ingredient.item.id === item.id);
      if (existingIdx >= 0) {
        const nextIngredients = [...dish.ingredients];
        nextIngredients[existingIdx] = {
          ...nextIngredients[existingIdx],
          quantity: nextIngredients[existingIdx].quantity + 1
        };
        return { ...dish, ingredients: nextIngredients };
      }
      const serving = getItemServingReference(item);
      const defaultWeightUnit: 'g' | 'ml' = serving.unit === 'ml' ? 'ml' : 'g';
      return {
        ...dish,
        ingredients: [...dish.ingredients, {
          item,
          quantity: 1,
          amountMode: 'qty',
          weightValue: serving.unit === 'qty' ? 100 : serving.amount,
          weightUnit: defaultWeightUnit
        }]
      };
    }));
    setDishSearch(prev => ({ ...prev, [dishId]: '' }));
  };

  const updateDishIngredientQuantity = (dishId: string, itemId: string, quantity: number) => {
    const safeQuantity = Number.isFinite(quantity) ? Math.max(quantity, 0) : 0;
    setDishDrafts(prev => prev.map(dish => {
      if (dish.id !== dishId) return dish;
      return {
        ...dish,
        ingredients: dish.ingredients.map(ingredient =>
          ingredient.item.id === itemId ? { ...ingredient, quantity: safeQuantity } : ingredient
        )
      };
    }));
  };

  const updateDishIngredientMode = (dishId: string, itemId: string, amountMode: 'qty' | 'weight') => {
    setDishDrafts(prev => prev.map(dish => {
      if (dish.id !== dishId) return dish;
      return {
        ...dish,
        ingredients: dish.ingredients.map(ingredient =>
          ingredient.item.id === itemId ? { ...ingredient, amountMode } : ingredient
        )
      };
    }));
  };

  const updateDishIngredientWeight = (dishId: string, itemId: string, weightValue: number) => {
    const safeWeight = Number.isFinite(weightValue) ? Math.max(weightValue, 0) : 0;
    setDishDrafts(prev => prev.map(dish => {
      if (dish.id !== dishId) return dish;
      return {
        ...dish,
        ingredients: dish.ingredients.map(ingredient =>
          ingredient.item.id === itemId ? { ...ingredient, weightValue: safeWeight } : ingredient
        )
      };
    }));
  };

  const updateDishIngredientWeightUnit = (dishId: string, itemId: string, weightUnit: 'g' | 'ml') => {
    setDishDrafts(prev => prev.map(dish => {
      if (dish.id !== dishId) return dish;
      return {
        ...dish,
        ingredients: dish.ingredients.map(ingredient =>
          ingredient.item.id === itemId ? { ...ingredient, weightUnit } : ingredient
        )
      };
    }));
  };

  const getIngredientDraftKey = (dishId: string, itemId: string, field: 'qty' | 'weight') =>
    `${dishId}:${itemId}:${field}`;

  const getIngredientInputValue = (
    dishId: string,
    itemId: string,
    field: 'qty' | 'weight',
    fallback: number
  ) => {
    const key = getIngredientDraftKey(dishId, itemId, field);
    if (Object.prototype.hasOwnProperty.call(dishInputDrafts, key)) {
      return dishInputDrafts[key];
    }
    return `${fallback}`;
  };

  const handleIngredientDraftChange = (
    dishId: string,
    itemId: string,
    field: 'qty' | 'weight',
    value: string
  ) => {
    const key = getIngredientDraftKey(dishId, itemId, field);
    setDishInputDrafts(prev => ({ ...prev, [key]: value }));
  };

  const commitIngredientDraft = (
    dishId: string,
    itemId: string,
    field: 'qty' | 'weight',
    rawValue: string
  ) => {
    const key = getIngredientDraftKey(dishId, itemId, field);
    const trimmed = rawValue.trim();
    const parsed = trimmed === '' ? 0 : parseFloat(trimmed);
    const committed = Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;

    if (field === 'qty') {
      updateDishIngredientQuantity(dishId, itemId, committed);
    } else {
      updateDishIngredientWeight(dishId, itemId, committed);
    }

    setDishInputDrafts(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const removeDishIngredient = (dishId: string, itemId: string) => {
    setDishDrafts(prev => prev.map(dish => {
      if (dish.id !== dishId) return dish;
      return {
        ...dish,
        ingredients: dish.ingredients.filter(ingredient => ingredient.item.id !== itemId)
      };
    }));
  };

  const handleManualKitchenSubmit = () => {
    setError(null);
    if (!manualData.meal_name) return;

    const dishesToLog = dishDrafts.filter(dish => dish.ingredients.length > 0);
    if (dishesToLog.length === 0) {
      setError('Add at least one dish with one or more kitchen items.');
      return;
    }

    const dishItems: NutritionData[] = dishesToLog.map((dish, idx) => {
      const totals = calculateDishNutrition(dish);
      const displayName = dish.name.trim() || `Dish ${idx + 1}`;
      const itemName = displayName.toLowerCase().replace(/\s+/g, '_');

      return {
        name: itemName,
        display_name: displayName,
        quantity: 1,
        unit: 'dish',
        calories: Math.round(totals.calories),
        protein: Number(totals.protein.toFixed(1)),
        fiber: Number(totals.fiber.toFixed(1)),
        carbs: Number(totals.carbs.toFixed(1)),
        fats: { total: Number(totals.fats.toFixed(1)), saturated: 0, unsaturated: 0 },
        sugars: { total: Number(totals.sugars.toFixed(1)), natural: 0, added: 0 },
        rationale: `Built from kitchen items: ${dish.ingredients.map(ing => {
          const draftedQuantity = getDraftedIngredientNumber(dish.id, ing.item.id, 'qty', ing.quantity);
          const draftedWeight = getDraftedIngredientNumber(dish.id, ing.item.id, 'weight', ing.weightValue);
          if (ing.amountMode === 'weight') {
            return `${draftedWeight}${ing.weightUnit} ${ing.item.name}`;
          }
          return `${draftedQuantity}x ${ing.item.name}`;
        }).join(', ')}`,
        _base_qty: 1,
        _base_calories: Math.round(totals.calories),
        _base_protein: Number(totals.protein.toFixed(1)),
        _base_carbs: Number(totals.carbs.toFixed(1)),
        _base_fiber: Number(totals.fiber.toFixed(1)),
        _base_fats_total: Number(totals.fats.toFixed(1)),
        _base_sugars_total: Number(totals.sugars.toFixed(1))
      };
    });

    const newMeal: MealData = {
      meal_name: manualData.meal_name,
      meal_type: manualData.meal_type,
      items: dishItems
    };

    setParsedMeals([newMeal]);
  };

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!user) return;
    setAISettings(loadAISettings(user.id));
  }, [user]);

  const getAIConfigPayload = () => (
    aiSettings.useUserKey
      ? aiSettings
      : { useUserKey: false, provider: 'gemini', model: 'gemini-1.5-flash', apiKey: '' }
  );

  const handleParse = async () => {
    if (!text.trim()) return;
    
    setIsLoading(true);
    setParsedMeals(null);
    setError(null);
    
    try {
      const res = await fetch('/api/parse-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, aiConfig: getAIConfigPayload() }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.details || data.error || 'Failed to parse meal');
      }

      if (Array.isArray(data)) {
        // Store base values for accurate quantity scaling
        const mealsWithBase = data.map((meal: MealData) => ({
          ...meal,
          items: meal.items.map((item: NutritionData) => ({
            ...item,
            _base_qty: item.quantity,
            _base_calories: item.calories,
            _base_protein: item.protein,
            _base_carbs: item.carbs,
            _base_fiber: item.fiber,
            _base_fats_total: item.fats?.total || 0,
            _base_sugars_total: item.sugars?.total || 0
          }))
        }));
        setParsedMeals(mealsWithBase);
      }
    } catch (err: any) {
      console.error('Failed to parse:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }

    if (!parsedMeals || parsedMeals.length === 0) return;

    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      for (const mealData of parsedMeals) {
        // 1. Calculate totals for each meal
        const totals = mealData.items.reduce((acc, item: NutritionData) => ({
          calories: acc.calories + (item.calories || 0),
          protein: acc.protein + (item.protein || 0),
          carbs: acc.carbs + (item.carbs || 0),
          fats: acc.fats + (item.fats?.total || 0),
          fats_saturated: acc.fats_saturated + (item.fats?.saturated || 0),
          fats_unsaturated: acc.fats_unsaturated + (item.fats?.unsaturated || 0),
          fiber: acc.fiber + (item.fiber || 0),
          sugars_total: acc.sugars_total + (item.sugars?.total || 0),
          sugars_natural: acc.sugars_natural + (item.sugars?.natural || 0),
          sugars_added: acc.sugars_added + (item.sugars?.added || 0),
        }), {
          calories: 0, protein: 0, carbs: 0, fats: 0, fats_saturated: 0, 
          fats_unsaturated: 0, fiber: 0, sugars_total: 0, sugars_natural: 0, sugars_added: 0
        } as any);

        // Round all values to integers to match DB column types
        totals.calories = Math.round(totals.calories);
        totals.protein = Math.round(totals.protein);
        totals.carbs = Math.round(totals.carbs);
        totals.fats = Math.round(totals.fats);
        totals.fats_saturated = Math.round(totals.fats_saturated);
        totals.fats_unsaturated = Math.round(totals.fats_unsaturated);
        totals.fiber = Math.round(totals.fiber);
        totals.sugars_total = Math.round(totals.sugars_total);
        totals.sugars_natural = Math.round(totals.sugars_natural);
        totals.sugars_added = Math.round(totals.sugars_added);

        // 2. Insert meal parent with Name and Type
        const { data: meal, error: mealError } = await supabase
          .from('meals')
          .insert({
            user_id: user.id,
            name: mealData.meal_name,
            type: mealData.meal_type,
            total_calories: totals.calories,
            total_protein: totals.protein,
            total_carbs: totals.carbs,
            total_fats: totals.fats,
            total_fats_saturated: totals.fats_saturated,
            total_fats_unsaturated: totals.fats_unsaturated,
            total_fiber: totals.fiber,
            total_sugars_total: totals.sugars_total,
            total_sugars_natural: totals.sugars_natural,
            total_sugars_added: totals.sugars_added,
            raw_input: text,
            description: isManual ? manualData.description : text,
            created_at: new Date(`${logDate}T${logTime}`).toISOString()
          })
          .select()
          .single();

        if (mealError) throw mealError;

        // 3. Insert individual items
        const { error: itemsError } = await supabase
          .from('meal_items')
           .insert(mealData.items.map(item => ({
            meal_id: meal.id,
            name: item.name,
            display_name: item.display_name,
            quantity: item.quantity,
            unit: item.unit,
            rationale: item.rationale,
            calories: Math.round(item.calories || 0),
            protein: Math.round(item.protein || 0),
            carbs: Math.round(item.carbs || 0),
            fats_total: Math.round(item.fats?.total || 0),
            fats_saturated: Math.round(item.fats?.saturated || 0),
            fats_unsaturated: Math.round(item.fats?.unsaturated || 0),
            fiber: Math.round(item.fiber || 0),
            sugars_total: Math.round(item.sugars?.total || 0),
            sugars_natural: Math.round(item.sugars?.natural || 0),
            sugars_added: Math.round(item.sugars?.added || 0)
          })));

        if (itemsError) throw itemsError;
      }

      window.dispatchEvent(new CustomEvent('meal-saved'));
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        clear();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save to diary. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const [dailyTotals, setDailyTotals] = useState<any>({ calories: 0 });

  const fetchDailyTotals = useCallback(async () => {
    if (!user) {
      setDailyTotals({ calories: 0 });
      return;
    }

    const selectedDayStart = new Date(`${logDate}T00:00:00`);
    if (Number.isNaN(selectedDayStart.getTime())) {
      setDailyTotals({ calories: 0 });
      return;
    }
    const selectedDayEnd = new Date(selectedDayStart);
    selectedDayEnd.setDate(selectedDayEnd.getDate() + 1);

    const { data } = await supabase
      .from('meals')
      .select('total_calories')
      .eq('user_id', user.id)
      .gte('created_at', selectedDayStart.toISOString())
      .lt('created_at', selectedDayEnd.toISOString());
    
    if (data) {
      const total = data.reduce((sum, m) => sum + (m.total_calories || 0), 0);
      setDailyTotals({ calories: total });
      return;
    }
    setDailyTotals({ calories: 0 });
  }, [user, logDate]);

  useEffect(() => {
    void fetchDailyTotals();
  }, [fetchDailyTotals]);

  const [kitchenItems, setKitchenItems] = useState<KitchenItem[]>([]);
  const [suggestions, setSuggestions] = useState<KitchenItem[]>([]);

  useEffect(() => {
    if (user) {
      fetchKitchenItems();
    }
  }, [user]);

  const fetchKitchenItems = async () => {
    const { data } = await supabase.from('kitchen_items').select('*');
    if (data) setKitchenItems(data as KitchenItem[]);
  };

  useEffect(() => {
    const query = isManual ? manualData.meal_name : text;
    if (query.length > 1) {
      const filtered = kitchenItems.filter(item => 
        item.name.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [text, manualData.meal_name, isManual, kitchenItems]);

  const handlePickKitchenItemManual = (item: KitchenItem) => {
    setManualData({
      ...manualData,
      meal_name: item.name,
      calories: item.calories,
      protein: item.protein,
      fiber: item.fiber,
      carbs: item.carbs,
      fats: item.fats_total,
      sugars: item.sugars_total
    });
    setSuggestions([]);
  };

  const handlePickKitchenItem = (item: KitchenItem) => {
    const newItem: NutritionData = {
      name: item.name,
      display_name: item.name,
      quantity: 1,
      unit: 'serving',
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fiber: item.fiber,
      fats: { total: item.fats_total, saturated: 0, unsaturated: 0 },
      sugars: { total: item.sugars_total, natural: 0, added: 0 },
      rationale: "From your Kitchen",
      _base_qty: 1,
      _base_calories: item.calories,
      _base_protein: item.protein,
      _base_carbs: item.carbs,
      _base_fiber: item.fiber,
      _base_fats_total: item.fats_total,
      _base_sugars_total: item.sugars_total
    };

    const newMeal: MealData = {
      meal_name: "Kitchen Selection",
      meal_type: "Snack",
      items: [newItem]
    };

    setParsedMeals(prev => prev ? [...prev, newMeal] : [newMeal]);
    setSuggestions([]);
    setText("");
  };

  const removeItem = (mealIdx: number, itemIdx: number) => {
    if (!parsedMeals) return;
    const updatedMeals = [...parsedMeals];
    updatedMeals[mealIdx] = {
      ...updatedMeals[mealIdx],
      items: updatedMeals[mealIdx].items.filter((_, idx) => idx !== itemIdx)
    };
    // If meal is empty, remove the meal too?
    if (updatedMeals[mealIdx].items.length === 0) {
      updatedMeals.splice(mealIdx, 1);
    }
    setParsedMeals(updatedMeals.length > 0 ? updatedMeals : null);
  };

  const addNewItem = (mealIdx: number) => {
    if (!parsedMeals) return;
    const newItem: NutritionData = {
      name: 'New Item',
      display_name: 'New Item',
      quantity: 1,
      unit: 'serving',
      calories: 0,
      protein: 0,
      carbs: 0,
      fiber: 0,
      fats: { total: 0, saturated: 0, unsaturated: 0 },
      sugars: { total: 0, natural: 0, added: 0 },
      rationale: 'Manually added',
      _base_qty: 1,
      _base_calories: 0,
      _base_protein: 0,
      _base_carbs: 0,
      _base_fiber: 0,
      _base_fats_total: 0,
      _base_sugars_total: 0
    };
    const updatedMeals = [...parsedMeals];
    updatedMeals[mealIdx] = {
      ...updatedMeals[mealIdx],
      items: [...updatedMeals[mealIdx].items, newItem]
    };
    setParsedMeals(updatedMeals);
  };

  const updateItemQuantity = (mealIdx: number, itemIdx: number, newQty: number) => {
    if (!parsedMeals) return;
    const item = parsedMeals[mealIdx].items[itemIdx];
    
    // Scale from original base values — no compounding drift
    const baseQty = item._base_qty || 1; // Default to 1 if not set
    const scale = newQty / baseQty;

    const updatedMeals = [...parsedMeals];
    updatedMeals[mealIdx] = {
      ...updatedMeals[mealIdx],
      items: updatedMeals[mealIdx].items.map((it, idx) => 
        idx !== itemIdx ? it : {
          ...it,
          quantity: newQty,
          calories: Math.round((it._base_calories || it.calories) * scale),
          protein: Number(((it._base_protein || it.protein) * scale).toFixed(1)),
          carbs: Number(((it._base_carbs || it.carbs) * scale).toFixed(1)),
          fiber: Number(((it._base_fiber || it.fiber) * scale).toFixed(1)),
          fats: {
            ...it.fats,
            total: Number(((it._base_fats_total || it.fats.total) * scale).toFixed(1))
          },
          sugars: {
            ...it.sugars,
            total: Number(((it._base_sugars_total || it.sugars.total) * scale).toFixed(1))
          }
        }
      )
    };
    setParsedMeals(updatedMeals);
  };

  const clear = () => {
    setParsedMeals(null);
    setText('');
    setError(null);
    setSuggestions([]);
    setDishDrafts([{ id: `dish-${Date.now()}`, name: 'Dish 1', ingredients: [] }]);
    setDishSearch({});
    setDishInputDrafts({});
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(draftStorageKey);
    }
  };

  useEffect(() => {
    draftHydratedRef.current = false;
  }, [draftStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || draftHydratedRef.current) return;
    draftHydratedRef.current = true;
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        text?: string;
        isManual?: boolean;
        logDate?: string;
        logTime?: string;
        manualData?: typeof manualData;
        manualEntryMode?: 'quick' | 'kitchen';
        dishDrafts?: DishDraft[];
        dishSearch?: Record<string, string>;
        dishInputDrafts?: Record<string, string>;
        parsedMeals?: MealData[] | null;
      };
      if (typeof parsed.text === 'string') setText(parsed.text);
      if (typeof parsed.isManual === 'boolean') setIsManual(parsed.isManual);
      if (typeof parsed.logDate === 'string') setLogDate(parsed.logDate);
      if (typeof parsed.logTime === 'string') setLogTime(parsed.logTime);
      if (parsed.manualData) setManualData(parsed.manualData);
      if (parsed.manualEntryMode === 'quick' || parsed.manualEntryMode === 'kitchen') setManualEntryMode(parsed.manualEntryMode);
      if (Array.isArray(parsed.dishDrafts) && parsed.dishDrafts.length > 0) setDishDrafts(parsed.dishDrafts);
      if (parsed.dishSearch) setDishSearch(parsed.dishSearch);
      if (parsed.dishInputDrafts) setDishInputDrafts(parsed.dishInputDrafts);
      if (parsed.parsedMeals) setParsedMeals(parsed.parsedMeals);
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !draftHydratedRef.current) return;
    const payload = {
      text,
      isManual,
      logDate,
      logTime,
      manualData,
      manualEntryMode,
      dishDrafts,
      dishSearch,
      dishInputDrafts,
      parsedMeals,
    };
    window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
  }, [
    draftStorageKey,
    text,
    isManual,
    logDate,
    logTime,
    manualData,
    manualEntryMode,
    dishDrafts,
    dishSearch,
    dishInputDrafts,
    parsedMeals,
  ]);

  const mealTotalCals = parsedMeals?.reduce((sum, m) => sum + m.items.reduce((s, i) => s + i.calories, 0), 0) || 0;
  const projectedDailyTotal = dailyTotals.calories + mealTotalCals;
  const impactDateLabel = new Date(`${logDate}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-4">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              {isManual ? 'Manual Entry' : 'Magic Input'}
            </label>
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
              <input 
                type="date" 
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="bg-transparent text-[10px] font-bold text-zinc-600 dark:text-zinc-400 outline-none"
              />
              <input 
                type="time" 
                value={logTime}
                onChange={(e) => setLogTime(e.target.value)}
                className="bg-transparent text-[10px] font-bold text-zinc-600 dark:text-zinc-400 outline-none border-l border-zinc-200 dark:border-zinc-700 pl-2"
              />
            </div>
          </div>
          <button 
            onClick={() => { setIsManual(!isManual); setParsedMeals(null); setError(null); }}
            className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline"
          >
            Switch to {isManual ? 'Magic' : 'Manual'}
          </button>
        </div>

        {!isManual ? (
          <div className="relative group">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleParse()}
              onFocus={(e) => e.target.select()}
              placeholder="e.g. 2 eggs for breakfast and salmon for dinner"
              className="w-full bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-2xl py-4 pl-12 pr-16 outline-none transition-all shadow-sm group-hover:shadow-md text-lg select-text"
              disabled={isLoading}
            />
            <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 w-5 h-5 pointer-events-none" />
            
            <button
              onClick={handleParse}
              disabled={isLoading || !text.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-2 rounded-xl transition-all shadow-sm z-10"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            </button>

            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                  <ChefHat className="w-3.5 h-3.5 text-amber-500 ml-2" />
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">From Your Kitchen</span>
                </div>
                <div className="flex flex-col">
                  {suggestions.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handlePickKitchenItem(item)}
                      className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left transition-colors border-b border-zinc-50 dark:border-zinc-800/50 last:border-0"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{item.name}</span>
                        <span className="text-[10px] text-zinc-400">{item.calories} kcal / serving</span>
                      </div>
                      <Plus className="w-4 h-4 text-zinc-300 group-hover:text-indigo-500" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5 relative">
                <label className="px-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Meal Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Scrambled Eggs"
                  className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500"
                  value={manualData.meal_name}
                  onChange={(e) => setManualData({ ...manualData, meal_name: e.target.value })}
                />
                
                {isManual && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200 mx-1">
                    <div className="flex flex-col">
                      {suggestions.slice(0, 5).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handlePickKitchenItemManual(item)}
                          className="flex items-center justify-between px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left transition-colors border-b border-zinc-50 dark:border-zinc-800/50 last:border-0"
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200">{item.name}</span>
                            <span className="text-[9px] text-zinc-400">{item.calories} kcal</span>
                          </div>
                          <Plus className="w-3 h-3 text-zinc-300" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="px-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Type</label>
                <select 
                  className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500"
                  value={manualData.meal_type}
                  onChange={(e) => setManualData({ ...manualData, meal_type: e.target.value })}
                >
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                  <option value="Snack">Snack</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setManualEntryMode('quick')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${manualEntryMode === 'quick' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}
              >
                Quick Macros
              </button>
              <button
                type="button"
                onClick={() => setManualEntryMode('kitchen')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${manualEntryMode === 'kitchen' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}
              >
                Kitchen Dishes
              </button>
            </div>

            {manualEntryMode === 'quick' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5 col-span-1">
                  <label className="px-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Calories</label>
                  <input 
                    type="number" 
                    className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500"
                    value={manualData.calories || ''}
                    onChange={(e) => setManualData({ ...manualData, calories: e.target.value === '' ? '' as any : parseInt(e.target.value) })}
                    onBlur={(e) => setManualData({ ...manualData, calories: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex flex-col gap-1.5 col-span-1 text-indigo-600">
                  <label className="px-1 text-[10px] font-bold opacity-60 uppercase tracking-widest">Protein</label>
                  <input 
                    type="number" 
                    className="w-full bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500"
                    value={manualData.protein || ''}
                    onChange={(e) => setManualData({ ...manualData, protein: e.target.value === '' ? '' as any : parseFloat(e.target.value) })}
                    onBlur={(e) => setManualData({ ...manualData, protein: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex flex-col gap-1.5 col-span-1 text-emerald-600">
                  <label className="px-1 text-[10px] font-bold opacity-60 uppercase tracking-widest">Fiber</label>
                  <input 
                    type="number" 
                    className="w-full bg-emerald-50/50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500"
                    value={manualData.fiber || ''}
                    onChange={(e) => setManualData({ ...manualData, fiber: e.target.value === '' ? '' as any : parseFloat(e.target.value) })}
                    onBlur={(e) => setManualData({ ...manualData, fiber: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex flex-col gap-1.5 col-span-1 text-amber-600">
                  <label className="px-1 text-[10px] font-bold opacity-60 uppercase tracking-widest">Carbs</label>
                  <input 
                    type="number" 
                    className="w-full bg-amber-50/50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500"
                    value={manualData.carbs || ''}
                    onChange={(e) => setManualData({ ...manualData, carbs: e.target.value === '' ? '' as any : parseFloat(e.target.value) })}
                    onBlur={(e) => setManualData({ ...manualData, carbs: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex flex-col gap-1.5 col-span-1 text-orange-600">
                  <label className="px-1 text-[10px] font-bold opacity-60 uppercase tracking-widest">Fats</label>
                  <input 
                    type="number" 
                    className="w-full bg-orange-50/50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/50 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500"
                    value={manualData.fats || ''}
                    onChange={(e) => setManualData({ ...manualData, fats: e.target.value === '' ? '' as any : parseFloat(e.target.value) })}
                    onBlur={(e) => setManualData({ ...manualData, fats: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex flex-col gap-1.5 col-span-1 text-pink-600">
                  <label className="px-1 text-[10px] font-bold opacity-60 uppercase tracking-widest">Sugars</label>
                  <input 
                    type="number" 
                    className="w-full bg-pink-50/50 dark:bg-pink-900/20 border border-pink-100 dark:border-pink-900/50 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500"
                    value={manualData.sugars || ''}
                    onChange={(e) => setManualData({ ...manualData, sugars: e.target.value === '' ? '' as any : parseFloat(e.target.value) })}
                    onBlur={(e) => setManualData({ ...manualData, sugars: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {dishDrafts.map((dish, index) => {
                  const query = dishSearch[dish.id] || '';
                  const dishSuggestions = query.length > 1
                    ? kitchenItems.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
                    : [];
                  const dishTotals = calculateDishNutrition(dish);

                  return (
                    <div key={dish.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 bg-zinc-50/70 dark:bg-zinc-800/30">
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="text"
                          value={dish.name}
                          onChange={(e) => updateDishName(dish.id, e.target.value)}
                          placeholder={`Dish ${index + 1} name`}
                          className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-3 min-h-[46px] text-base sm:text-sm font-bold outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeDish(dish.id)}
                          className="p-2.5 min-h-[44px] min-w-[44px] text-zinc-400 hover:text-red-500 transition-colors"
                          title="Remove dish"
                        >
                          <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          value={query}
                          onChange={(e) => setDishSearch(prev => ({ ...prev, [dish.id]: e.target.value }))}
                          placeholder="Search kitchen items for this dish..."
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-3 min-h-[46px] text-base sm:text-sm outline-none focus:border-indigo-500"
                        />
                        {dishSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden shadow-lg">
                            {dishSuggestions.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => addIngredientToDish(dish.id, item)}
                                className="w-full px-3 py-3 min-h-[44px] text-left text-sm sm:text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                              >
                                <span>{item.name}</span>
                                <span className="text-zinc-400">{item.calories} kcal</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 space-y-2">
                        {dish.ingredients.length === 0 ? (
                          <p className="text-[11px] text-zinc-400">Add one or more kitchen items to build this dish.</p>
                        ) : (
                          dish.ingredients.map((ingredient) => (
                            <div key={ingredient.item.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3 py-3">
                              <div className="flex flex-col">
                                <span className="text-lg sm:text-sm font-bold leading-tight">{ingredient.item.name}</span>
                                <span className="text-xs sm:text-[10px] text-zinc-400">
                                  {ingredient.item.calories} kcal per {(() => {
                                    const serving = getItemServingReference(ingredient.item);
                                    if (serving.unit === 'qty') return 'serving';
                                    return `${serving.amount}${serving.unit}`;
                                  })()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1">
                                  <button
                                    type="button"
                                    onClick={() => updateDishIngredientMode(dish.id, ingredient.item.id, 'qty')}
                                    className={`px-3 py-2 min-h-[40px] text-sm sm:text-[10px] font-bold rounded-md ${ingredient.amountMode === 'qty' ? 'bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100' : 'text-zinc-500'}`}
                                  >
                                    Qty
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateDishIngredientMode(dish.id, ingredient.item.id, 'weight')}
                                    disabled={!canUseWeightMode(ingredient.item)}
                                    className={`px-3 py-2 min-h-[40px] text-sm sm:text-[10px] font-bold rounded-md disabled:opacity-40 ${ingredient.amountMode === 'weight' ? 'bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100' : 'text-zinc-500'}`}
                                  >
                                    g/ml
                                  </button>
                                </div>

                                {ingredient.amountMode === 'qty' ? (
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.1}
                                    value={getIngredientInputValue(dish.id, ingredient.item.id, 'qty', ingredient.quantity)}
                                    onChange={(e) => handleIngredientDraftChange(dish.id, ingredient.item.id, 'qty', e.target.value)}
                                    onBlur={(e) => commitIngredientDraft(dish.id, ingredient.item.id, 'qty', e.target.value)}
                                    className="w-24 sm:w-16 min-h-[40px] bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-2 text-base sm:text-xs font-bold text-center outline-none"
                                  />
                                ) : (
                                  <>
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.1}
                                      value={getIngredientInputValue(dish.id, ingredient.item.id, 'weight', ingredient.weightValue)}
                                      onChange={(e) => handleIngredientDraftChange(dish.id, ingredient.item.id, 'weight', e.target.value)}
                                      onBlur={(e) => commitIngredientDraft(dish.id, ingredient.item.id, 'weight', e.target.value)}
                                      className="w-28 sm:w-20 min-h-[40px] bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-2 text-base sm:text-xs font-bold text-center outline-none"
                                    />
                                    <select
                                      value={ingredient.weightUnit}
                                      onChange={(e) => updateDishIngredientWeightUnit(dish.id, ingredient.item.id, e.target.value as 'g' | 'ml')}
                                      className="min-h-[40px] bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base sm:text-xs font-bold outline-none"
                                    >
                                      <option value="g">g</option>
                                      <option value="ml">ml</option>
                                    </select>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeDishIngredient(dish.id, ingredient.item.id)}
                                  className="p-2.5 min-h-[40px] min-w-[40px] text-zinc-300 hover:text-red-500"
                                  title="Remove ingredient"
                                >
                                  <X className="w-5 h-5 sm:w-3.5 sm:h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {dish.ingredients.some(ingredient => !canUseWeightMode(ingredient.item)) && (
                        <p className="mt-2 text-[10px] text-zinc-400">
                          Weight mode needs serving size in g/ml on the kitchen item (for example: "Serving: 84g").
                        </p>
                      )}

                      <div className="mt-3 text-sm sm:text-[11px] font-bold text-zinc-500">
                        Dish totals: {Math.round(dishTotals.calories)} kcal, P {dishTotals.protein.toFixed(1)}g, C {dishTotals.carbs.toFixed(1)}g, F {dishTotals.fats.toFixed(1)}g
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={addDish}
                  className="self-start px-4 py-3 min-h-[46px] rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm sm:text-[11px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-300 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> Add Dish
                </button>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="px-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Meal Notes / Description (Optional)</label>
              <textarea 
                placeholder="Add some notes about your meal..."
                className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 min-h-[80px] resize-none"
                value={manualData.description}
                onChange={(e) => setManualData({ ...manualData, description: e.target.value })}
              />
            </div>

            <button 
              onClick={manualEntryMode === 'quick' ? handleManualSubmit : handleManualKitchenSubmit}
              disabled={manualEntryMode === 'quick' ? (!manualData.meal_name || !manualData.calories) : !manualData.meal_name}
              className="mt-2 py-3.5 min-h-[48px] bg-indigo-600 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              <Check className="w-4 h-4" />
              {manualEntryMode === 'quick' ? 'Prepare Log' : 'Prepare Meal From Kitchen'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {parsedMeals && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col gap-1 mb-8">
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <h3 className="text-2xl font-black">Review Log</h3>
                <div className="flex items-center gap-2 text-xs text-zinc-500 font-bold uppercase tracking-tighter">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Impact:</span>
                  <span className="text-zinc-400">{dailyTotals.calories}</span>
                  <span className="text-zinc-300">→</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{projectedDailyTotal} kcal on {impactDateLabel}</span>
                </div>
              </div>
              <button onClick={clear} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-10">
            {parsedMeals.map((meal, mIdx) => (
              <div key={mIdx} className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {meal.meal_type}
                  </span>
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-black">{meal.meal_name}</h4>
                    <button 
                      onClick={() => addNewItem(mIdx)}
                      className="text-[10px] font-bold text-zinc-400 hover:text-indigo-600 uppercase tracking-widest flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add Item
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-6 pl-2 border-l-2 border-zinc-100 dark:border-zinc-800">
                  {meal.items.map((item, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="text-md font-bold capitalize">{item.display_name || item.name}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 border border-zinc-200/50 dark:border-zinc-700/50">
                              <button 
                                onClick={() => updateItemQuantity(mIdx, i, Math.max(1, item.quantity - 1))}
                                className="px-3 py-2 min-h-[40px] text-base sm:text-xs font-bold hover:bg-white dark:hover:bg-zinc-700 rounded-md transition-colors"
                              >-</button>
                              <input 
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItemQuantity(mIdx, i, parseFloat(e.target.value) || 1)}
                                className="w-20 sm:w-14 min-h-[40px] bg-transparent text-center text-base sm:text-xs font-black outline-none"
                              />
                              <button 
                                onClick={() => updateItemQuantity(mIdx, i, item.quantity + 1)}
                                className="px-3 py-2 min-h-[40px] text-base sm:text-xs font-bold hover:bg-white dark:hover:bg-zinc-700 rounded-md transition-colors"
                              >+</button>
                            </div>
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{item.unit}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col items-end">
                              <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{item.calories}</span>
                              <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-tighter leading-none">kcal</span>
                            </div>
                            <button 
                              onClick={() => removeItem(mIdx, i)}
                              className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-4 mt-2 px-1">
                        {[
                          { label: 'P', val: item.protein, color: 'text-indigo-600 dark:text-indigo-400' },
                          { label: 'Fib', val: item.fiber, color: 'text-emerald-600 dark:text-emerald-400' },
                          { label: 'C', val: item.carbs, color: 'text-amber-600 dark:text-amber-400' },
                          { label: 'F', val: item.fats.total, color: 'text-orange-600 dark:text-orange-400' },
                          { label: 'S', val: item.sugars.total, color: 'text-pink-600 dark:text-pink-400' }
                        ].map(macro => (
                          <div key={macro.label} className="flex flex-col">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{macro.label}</span>
                            <span className={`text-sm font-black ${macro.color}`}>{macro.val.toFixed(1)}g</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={handleSave}
            disabled={isSaving || saveSuccess}
            className={`w-full mt-10 py-5 rounded-[2rem] font-black flex items-center justify-center gap-3 transition-all disabled:opacity-50 text-lg shadow-xl ${
              saveSuccess 
                ? 'bg-emerald-600 text-white shadow-emerald-200 dark:shadow-none' 
                : 'bg-indigo-600 text-white shadow-indigo-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : saveSuccess ? <><Check className="w-6 h-6" />Done!</> : <><History className="w-6 h-6" />Finish & Save {parsedMeals.length} Meal{parsedMeals.length > 1 ? 's' : ''}</>}
          </button>
        </div>
      )}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
