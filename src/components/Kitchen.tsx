'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import { X, Plus, Trash2, Link as LinkIcon, Save, Loader2, ChefHat, Search, Globe, Info, Camera, Sparkles, Upload } from 'lucide-react';
import { AISettings, DEFAULT_AI_SETTINGS, loadAISettings } from '@/lib/aiSettings';
import Image from 'next/image';

interface KitchenItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats_total: number;
  fiber: number;
  sugars_total: number;
  source_url?: string;
  is_unlinked?: boolean;
  description?: string;
}

interface KitchenProps {
  isOpen: boolean;
  onClose: () => void;
  isPage?: boolean;
}

export default function Kitchen({ isOpen, onClose, isPage = false }: KitchenProps) {
  const { user } = useAuth();
  const draftHydratedRef = useRef(false);
  const [items, setItems] = useState<KitchenItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<'manual' | 'url' | 'recipe' | 'label'>('manual');
  const [url, setUrl] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Recipe Builder State
  const [recipeIngredients, setRecipeIngredients] = useState<{item: KitchenItem, quantity: number}[]>([]);
  const [recipeInstructions, setRecipeInstructions] = useState('');
  const [recipeServings, setRecipeServings] = useState(1);
  const [magicText, setMagicText] = useState('');
  const [showMagicImport, setShowMagicImport] = useState(false);
  const [isMagicParsing, setIsMagicParsing] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimationResult, setEstimationResult] = useState<any>(null);
  const [showReview, setShowReview] = useState(false);
  const [aiSettings, setAISettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  
  // Label Scanner State
  const [labelImage, setLabelImage] = useState<string | null>(null);
  const [labelMimeType, setLabelMimeType] = useState<string>('image/jpeg');
  const [isLabelParsing, setIsLabelParsing] = useState(false);
  const [labelPreview, setLabelPreview] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pendingSaveAfterAuthRef = useRef(false);
  const saveAfterAuthHandlerRef = useRef<null | (() => Promise<void>)>(null);
  const draftScope = user?.id || 'anon';
  const draftStorageKey = `guiltfree.kitchen-draft.${draftScope}`;
  
  const [newItem, setNewItem] = useState<Partial<KitchenItem>>({
    name: '',
    calories: 0,
    protein: 0,
    fiber: 0,
    carbs: 0,
    fats_total: 0,
    sugars_total: 0,
    description: ''
  });

  useEffect(() => {
    if (user && (isOpen || isPage)) {
      fetchItems();
    }
  }, [user, isOpen, isPage]);

  useEffect(() => {
    if (!user) return;
    setAISettings(loadAISettings(user.id));
  }, [user]);

  useEffect(() => {
    if (!user || !pendingSaveAfterAuthRef.current) return;
    pendingSaveAfterAuthRef.current = false;
    void saveAfterAuthHandlerRef.current?.();
  }, [user]);

  const getAIConfigPayload = () => (
    aiSettings.useUserKey
      ? aiSettings
      : { useUserKey: false, provider: 'gemini', model: 'gemini-1.5-flash', apiKey: '' }
  );

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('kitchen_items')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setItems(data);
    setAddMode('manual');
    setLoading(false);
  };

  const handleMagicImport = async () => {
    if (!magicText) return;
    setIsMagicParsing(true);
    try {
      const res = await fetch('/api/parse-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: magicText, aiConfig: getAIConfigPayload() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.ingredients && Array.isArray(data.ingredients)) {
        const newIngredients = data.ingredients.map((ing: any) => ({
          item: {
            id: `unlinked-${Math.random().toString(36).substr(2, 9)}`,
            name: ing.name,
            calories: ing.calories || 0,
            protein: ing.protein || 0,
            carbs: ing.carbs || 0,
            fats_total: ing.fats_total || 0,
            fiber: ing.fiber || 0,
            sugars_total: ing.sugars_total || 0,
            is_unlinked: true
          },
          quantity: ing.quantity || 1
        }));
        setRecipeIngredients([...recipeIngredients, ...newIngredients]);
        setMagicText('');
        setShowMagicImport(false);
      }
    } catch (err: any) {
      alert("Failed to parse recipe: " + err.message);
    } finally {
      setIsMagicParsing(false);
    }
  };

  const handleEstimateRecipe = async () => {
    if (!recipeInstructions) return;
    setIsEstimating(true);
    try {
      const res = await fetch('/api/estimate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newItem.name, instructions: recipeInstructions, aiConfig: getAIConfigPayload() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setEstimationResult(data);
      setNewItem({
        ...newItem,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fats_total: data.fats_total,
        fiber: data.fiber,
        sugars_total: data.sugars_total,
        description: `Serving Size: ${data.serving_size}\n\n${data.explanation || ''}\n\nRecipe Instructions:\n${recipeInstructions}`
      });
      setShowReview(true);
    } catch (err: any) {
      alert("Failed to estimate recipe: " + err.message);
    } finally {
      setIsEstimating(false);
    }
  };

  const handleParseUrl = async () => {
    if (!url) return;
    setIsParsing(true);
    try {
      const res = await fetch('/api/parse-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, aiConfig: getAIConfigPayload() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setNewItem({
        name: data.name,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fats_total: data.fats_total,
        fiber: data.fiber,
        sugars_total: data.sugars_total,
        source_url: url
      });
      setAddMode('manual');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleEditItem = (item: KitchenItem) => {
    setEditingId(item.id);
    setNewItem({
      name: item.name,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fats_total: item.fats_total,
      fiber: item.fiber,
      sugars_total: item.sugars_total,
      source_url: item.source_url,
      description: item.description
    });
    
    if ((item as any).recipe_ingredients) {
      setAddMode('recipe');
      setRecipeIngredients((item as any).recipe_ingredients.map((ri: any) => ({
        item: { id: ri.id, name: ri.name } as KitchenItem, // Partial item for display
        quantity: ri.quantity
      })));
      setRecipeInstructions((item as any).instructions || '');
      // Note: We don't store servings in the DB yet, but we can assume or add it later if needed efficiently.
      setRecipeServings(1); 
    } else {
      setAddMode('manual');
    }
    setShowAdd(true);
  };

  const handleSaveItem = async () => {
    if (!newItem.name || isSavingItem) return;
    if (!user) {
      pendingSaveAfterAuthRef.current = true;
      alert('Please sign in to save this kitchen item. We will continue automatically right after sign in.');
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }
    setIsSavingItem(true);
    setLoading(true);

    let itemToSave = { ...newItem, user_id: user?.id };

    if (addMode === 'recipe') {
      // If we are in the AI review flow, skip ingredient-based recalculation
      if (showReview) {
        itemToSave = {
          ...itemToSave,
          instructions: recipeInstructions || null
        } as any;
      } else {
        // Fallback for original ingredient-based calculation
        if (recipeIngredients.length === 0) {
          setLoading(false);
          return;
        }
        
        const cals = Math.round(recipeIngredients.reduce((sum, ri) => sum + (ri.item.calories * ri.quantity), 0) / recipeServings);
        const prot = parseFloat((recipeIngredients.reduce((sum, ri) => sum + (ri.item.protein * ri.quantity), 0) / recipeServings).toFixed(1));
        const fibr = parseFloat((recipeIngredients.reduce((sum, ri) => sum + (ri.item.fiber * ri.quantity), 0) / recipeServings).toFixed(1));
        const carb = parseFloat((recipeIngredients.reduce((sum, ri) => sum + (ri.item.carbs * ri.quantity), 0) / recipeServings).toFixed(1));
        const fats = parseFloat((recipeIngredients.reduce((sum, ri) => sum + (ri.item.fats_total * ri.quantity), 0) / recipeServings).toFixed(1));
        const sugr = parseFloat((recipeIngredients.reduce((sum, ri) => sum + (ri.item.sugars_total * ri.quantity), 0) / recipeServings).toFixed(1));

        itemToSave = {
          ...itemToSave,
          calories: cals,
          protein: prot,
          fiber: fibr,
          carbs: carb,
          fats_total: fats,
          sugars_total: sugr,
          instructions: recipeInstructions || null,
          recipe_ingredients: recipeIngredients.map(ri => ({
            id: ri.item.id,
            name: ri.item.name,
            quantity: ri.quantity
          }))
        } as any;
      }
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('kitchen_items')
          .update(itemToSave)
          .eq('id', editingId);

        if (!error) {
          setShowAdd(false);
          resetNewItem();
          await fetchItems();
        } else {
          console.error("Error updating item:", error);
          alert("Failed to update item.");
        }
      } else {
        const { error } = await supabase
          .from('kitchen_items')
          .insert([itemToSave]);

        if (!error) {
          setShowAdd(false);
          resetNewItem();
          await fetchItems();
        } else {
          console.error("Error saving item:", error);
          alert("Failed to save. Ensure your recipe passes all validation constraints.");
        }
      }
    } finally {
      setLoading(false);
      setIsSavingItem(false);
    }
  };

  saveAfterAuthHandlerRef.current = handleSaveItem;

  const deleteItem = async (id: string) => {
    const { error } = await supabase
      .from('kitchen_items')
      .delete()
      .eq('id', id);
    if (!error) fetchItems();
  };

  const resetNewItem = () => {
    setNewItem({ name: '', calories: 0, protein: 0, carbs: 0, fats_total: 0, fiber: 0, sugars_total: 0, description: '' });
    setUrl('');
    setRecipeIngredients([]);
    setRecipeInstructions('');
    setRecipeServings(1);
    setAddMode('manual');
    setEditingId(null);
    setEstimationResult(null);
    setShowReview(false);
    setLabelImage(null);
    setLabelPreview(null);
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
        showAdd?: boolean;
        addMode?: 'manual' | 'url' | 'recipe' | 'label';
        url?: string;
        editingId?: string | null;
        newItem?: Partial<KitchenItem>;
        recipeIngredients?: { item: KitchenItem; quantity: number }[];
        recipeInstructions?: string;
        recipeServings?: number;
        magicText?: string;
        showMagicImport?: boolean;
        estimationResult?: any;
        showReview?: boolean;
        labelImage?: string | null;
        labelMimeType?: string;
      };

      if (typeof parsed.showAdd === 'boolean') setShowAdd(parsed.showAdd);
      if (parsed.addMode) setAddMode(parsed.addMode);
      if (typeof parsed.url === 'string') setUrl(parsed.url);
      if (typeof parsed.editingId !== 'undefined') setEditingId(parsed.editingId);
      if (parsed.newItem) setNewItem(parsed.newItem);
      if (Array.isArray(parsed.recipeIngredients)) setRecipeIngredients(parsed.recipeIngredients);
      if (typeof parsed.recipeInstructions === 'string') setRecipeInstructions(parsed.recipeInstructions);
      if (typeof parsed.recipeServings === 'number') setRecipeServings(parsed.recipeServings);
      if (typeof parsed.magicText === 'string') setMagicText(parsed.magicText);
      if (typeof parsed.showMagicImport === 'boolean') setShowMagicImport(parsed.showMagicImport);
      if (typeof parsed.estimationResult !== 'undefined') setEstimationResult(parsed.estimationResult);
      if (typeof parsed.showReview === 'boolean') setShowReview(parsed.showReview);
      if (typeof parsed.labelImage !== 'undefined') setLabelImage(parsed.labelImage);
      if (typeof parsed.labelMimeType === 'string') setLabelMimeType(parsed.labelMimeType);
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !draftHydratedRef.current) return;
    const payload = {
      showAdd,
      addMode,
      url,
      editingId,
      newItem,
      recipeIngredients,
      recipeInstructions,
      recipeServings,
      magicText,
      showMagicImport,
      estimationResult,
      showReview,
      labelImage,
      labelMimeType,
    };
    window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
  }, [
    draftStorageKey,
    showAdd,
    addMode,
    url,
    editingId,
    newItem,
    recipeIngredients,
    recipeInstructions,
    recipeServings,
    magicText,
    showMagicImport,
    estimationResult,
    showReview,
    labelImage,
    labelMimeType,
  ]);

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLabelFile = (file: File | undefined) => {
    if (!file) return;

    setLabelMimeType(file.type);
    setLabelPreview(URL.createObjectURL(file));

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (base64) setLabelImage(base64);
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen && !isPage) return null;

  const content = (
    <div className={`relative w-full ${isPage ? '' : 'max-w-2xl max-h-[90vh] shadow-2xl rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200'} bg-white dark:bg-zinc-900 overflow-hidden flex flex-col`}>
        <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center">
              <ChefHat className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">The Kitchen</h2>
              <p className="text-xs text-zinc-500 font-medium">Your personal food bucket & favorites</p>
            </div>
          </div>
          {!isPage && (
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="p-4 sm:p-8 flex-1 overflow-y-auto">
          {showAdd ? (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl overflow-x-auto no-scrollbar">
                  <button 
                    onClick={() => setAddMode('manual')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${addMode === 'manual' ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-zinc-500'}`}
                  >
                    Manual
                  </button>
                  <button 
                    onClick={() => setAddMode('url')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${addMode === 'url' ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-zinc-500'}`}
                  >
                    URL
                  </button>
                  <button 
                    onClick={() => setAddMode('recipe')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap ${addMode === 'recipe' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100 shadow-sm' : 'text-zinc-500'}`}
                  >
                    <ChefHat className="w-3.5 h-3.5" /> Recipe
                  </button>
                  <button 
                    onClick={() => setAddMode('label')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap ${addMode === 'label' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-100 shadow-sm' : 'text-zinc-500'}`}
                  >
                    <Camera className="w-3.5 h-3.5" /> Scan
                  </button>
                </div>
                {editingId && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-800">Editing Item</span>
                )}
              </div>

              {addMode === 'recipe' ? (
                <>
                  {/* Simplified Recipe UI */}
                  {!showReview ? (
                    <div className="space-y-6">
                      <input 
                        type="text" 
                        placeholder="Recipe Name (e.g. Grandma's Lasagna)"
                        className="w-full px-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl outline-none focus:border-amber-500 transition-all font-bold text-xl"
                        value={newItem.name}
                        onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                      />

                      {/* Magic Import Section */}
                      <div className="flex flex-col gap-2 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Magic Import</span>
                          </div>
                          <button 
                            onClick={() => setShowMagicImport(!showMagicImport)}
                            className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
                          >
                            {showMagicImport ? 'Cancel' : 'Try Magic Import'}
                          </button>
                        </div>
                        
                        {showMagicImport && (
                          <div className="space-y-3 mt-2 animate-in slide-in-from-top-2 duration-200">
                            <textarea 
                              placeholder="Paste a list of ingredients (e.g. 200g chicken breast, 1 cup rice)..."
                              className="w-full bg-white dark:bg-zinc-800 border border-amber-100 dark:border-amber-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 min-h-[100px] font-medium resize-none shadow-inner"
                              value={magicText}
                              onChange={(e) => setMagicText(e.target.value)}
                            />
                            <button 
                              onClick={handleMagicImport}
                              disabled={isMagicParsing || !magicText.trim()}
                              className="w-full py-2 bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-amber-600 disabled:opacity-50 transition-all"
                            >
                              {isMagicParsing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Parse & Add'}
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <label className="px-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Recipe Instructions / Ingredients</label>
                        <textarea 
                          placeholder="Paste your recipe or instructions here. AI will estimate macros for one serving..."
                          className="w-full h-64 px-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl outline-none focus:border-amber-500 transition-all font-medium resize-none text-zinc-900 dark:text-white"
                          value={recipeInstructions}
                          onChange={(e) => setRecipeInstructions(e.target.value)}
                        />
                      </div>

                      {/* Ingredients List */}
                      {recipeIngredients.length > 0 && (
                        <div className="space-y-3">
                          <label className="px-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Ingredients</label>
                          <div className="flex flex-wrap gap-2">
                            {recipeIngredients.map((ri, idx) => (
                              <div key={ri.item.id} className="bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-xl flex items-center gap-2 border border-zinc-200 dark:border-zinc-700 animate-in zoom-in-95">
                                <span className="font-bold text-sm">{ri.item.name}</span>
                                <span className="text-[10px] text-zinc-400">× {ri.quantity}</span>
                                <button 
                                  onClick={() => setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx))}
                                  className="p-1 hover:text-red-500 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button 
                          onClick={() => setShowAdd(false)}
                          className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 transition-all"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleEstimateRecipe}
                          disabled={isEstimating || !recipeInstructions}
                          className="flex-[2] py-4 bg-amber-500 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-amber-600 transition-all disabled:opacity-50"
                        >
                          {isEstimating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ChefHat className="w-5 h-5" /> Estimate Macros</>}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-in zoom-in-95 duration-200">
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-[2rem] border border-amber-100 dark:border-amber-900/30">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white font-black text-sm">AI</div>
                          <div>
                            <h4 className="font-bold text-amber-900 dark:text-amber-100">Macro Estimation Complete</h4>
                            <p className="text-xs text-amber-700/70 dark:text-amber-300/50 font-medium">Review and adjust before saving</p>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-900/50 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/20 mb-6">
                           <div className="flex items-center gap-2 text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">
                             <Search className="w-3 h-3" /> Estimated Serving Size
                           </div>
                           <p className="text-lg font-bold text-zinc-900 dark:text-white">{estimationResult?.serving_size}</p>
                           {estimationResult?.explanation && (
                             <p className="text-[10px] text-zinc-500 mt-2 font-medium italic border-t border-zinc-100 dark:border-zinc-800 pt-2">{estimationResult.explanation}</p>
                           )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {[
                            { label: 'Calories', key: 'calories', color: 'bg-zinc-50 text-zinc-900 border-zinc-100 dark:bg-zinc-800 dark:text-white dark:border-zinc-700' },
                            { label: 'Prot (g)', key: 'protein', color: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/50' },
                            { label: 'Fibr (g)', key: 'fiber', color: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/50' },
                            { label: 'Carb (g)', key: 'carbs', color: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50' },
                            { label: 'Fats (g)', key: 'fats_total', color: 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900/50' },
                            { label: 'Sugr (g)', key: 'sugars_total', color: 'bg-pink-50 text-pink-600 border-pink-100 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-900/50' }
                          ].map((macro) => (
                            <div key={macro.key} className="flex flex-col gap-1.5">
                              <label className="px-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{macro.label}</label>
                              <input 
                                type="number" 
                                className={`w-full px-4 py-3 rounded-xl text-sm font-bold outline-none border transition-all ${macro.color} focus:border-indigo-500`}
                                value={(newItem[macro.key as keyof KitchenItem] as string | number) || ''}
                                onChange={(e) => setNewItem({...newItem, [macro.key]: e.target.value === '' ? '' as any : parseFloat(e.target.value)})}
                                onBlur={(e) => setNewItem({...newItem, [macro.key]: parseFloat(e.target.value) || 0})}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button 
                          onClick={() => setShowReview(false)}
                          className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 transition-all font-bold"
                        >
                          Back
                        </button>
                        <button 
                          onClick={handleSaveItem}
                          disabled={isSavingItem}
                          className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                        >
                          {isSavingItem ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Save Recipe & Macros
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : addMode === 'url' ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type="url" 
                      placeholder="Paste nutrition URL (e.g. USDA, MyFitnessPal)..."
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl outline-none focus:border-indigo-500 transition-all font-medium"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={handleParseUrl}
                    disabled={isParsing || !url}
                    className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isParsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Import Nutrition</>}
                  </button>
                </div>
              ) : addMode === 'label' ? (
                <div className="space-y-6">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Best with Nutrition Facts Labels</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Take a clear photo of the actual Nutrition Facts or Supplement Facts label on the product. This works most accurately with standard nutrition labels, not product packaging or brand names.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-4">
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleLabelFile(e.target.files?.[0])}
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleLabelFile(e.target.files?.[0])}
                    />

                    <div className="w-full border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl p-8 flex flex-col items-center gap-4">
                      <Camera className="w-10 h-10 text-zinc-300 dark:text-zinc-600" />
                      <span className="text-sm font-bold text-zinc-400">Add a nutrition label photo</span>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-widest">PNG, JPG, HEIC supported</span>
                      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => uploadInputRef.current?.click()}
                          className="py-3 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                          <Upload className="w-4 h-4" /> Upload From Device
                        </button>
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="py-3 px-4 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-200 dark:hover:bg-emerald-900/40 transition-colors"
                        >
                          <Camera className="w-4 h-4" /> Take Photo Now
                        </button>
                      </div>
                    </div>

                    {labelPreview && (
                      <div className="w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 relative h-64 bg-zinc-50 dark:bg-zinc-800">
                        <Image src={labelPreview} alt="Nutrition label preview" fill className="object-contain" />
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={async () => {
                      if (!labelImage) return;
                      setIsLabelParsing(true);
                      try {
                        const res = await fetch('/api/parse-label', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ image: labelImage, mimeType: labelMimeType, aiConfig: getAIConfigPayload() })
                        });
                        const data = await res.json();
                        if (data.error) {
                          alert(data.error);
                          return;
                        }
                        setNewItem({
                          name: data.name || 'Scanned Item',
                          calories: data.calories || 0,
                          protein: data.protein || 0,
                          carbs: data.carbs || 0,
                          fats_total: data.fats_total || 0,
                          fiber: data.fiber || 0,
                          sugars_total: data.sugars_total || 0,
                          description: `Serving: ${data.serving_size || 'N/A'} — ${data.rationale || 'Scanned from nutrition label'}`
                        });
                        setAddMode('manual'); // Switch to manual for review/edit before save
                        setLabelImage(null);
                        setLabelPreview(null);
                      } catch (err: any) {
                        alert('Failed to scan label: ' + err.message);
                      } finally {
                        setIsLabelParsing(false);
                      }
                    }}
                    disabled={isLabelParsing || !labelImage}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                  >
                    {isLabelParsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Camera className="w-5 h-5" /> Extract Nutrition</>}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <input 
                    type="text" 
                    placeholder="Item Name (e.g. Chicken Breast)"
                    className="w-full px-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl outline-none focus:border-indigo-500 transition-all font-bold text-xl"
                    value={newItem.name}
                    onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                  />
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { label: 'Calories', key: 'calories', color: 'bg-zinc-50 text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-white dark:border-zinc-700' },
                      { label: 'Protein (g)', key: 'protein', color: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/50' },
                      { label: 'Fiber (g)', key: 'fiber', color: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/50' },
                      { label: 'Carbs (g)', key: 'carbs', color: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50' },
                      { label: 'Fats (g)', key: 'fats_total', color: 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900/50' },
                      { label: 'Sugars (g)', key: 'sugars_total', color: 'bg-pink-50 text-pink-600 border-pink-100 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-900/50' }
                    ].map((macro) => (
                      <div key={macro.key} className="flex flex-col gap-1.5">
                        <label className="px-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{macro.label}</label>
                        <input 
                          type="number" 
                          className={`w-full px-4 py-3 rounded-xl text-sm font-bold outline-none border transition-all ${macro.color} focus:border-indigo-500`}
                          value={(newItem[macro.key as keyof KitchenItem] as string | number) || ''}
                          onChange={(e) => setNewItem({...newItem, [macro.key]: e.target.value === '' ? '' as any : parseFloat(e.target.value)})}
                          onBlur={(e) => setNewItem({...newItem, [macro.key]: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="px-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Notes / Description (Optional)</label>
                    <textarea 
                      placeholder="Add some details about this item..."
                      className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 min-h-[80px] font-medium resize-none text-zinc-900 dark:text-white"
                      value={newItem.description || ''}
                      onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowAdd(false)}
                      className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveItem}
                      disabled={!newItem.name || isSavingItem}
                      className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                      {isSavingItem ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Save Item
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input 
                    type="text" 
                    placeholder="Search your kitchen..."
                    className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl outline-none focus:border-indigo-500 transition-all font-medium"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => setShowAdd(true)}
                  className="px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-zinc-950/10"
                >
                  <Plus className="w-5 h-5" /> Add Item
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-zinc-300" /></div>
              ) : items.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto">
                    <ChefHat className="w-8 h-8 text-zinc-200" />
                  </div>
                  <div>
                    <p className="text-zinc-500 font-bold">Your kitchen is empty</p>
                    <p className="text-sm text-zinc-400">Save items you eat regularly for faster logging</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredItems.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => handleEditItem(item)}
                      className="group p-4 sm:p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] hover:border-indigo-500 dark:hover:border-indigo-500 transition-all shadow-sm hover:shadow-xl hover:scale-[1.01] cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-tight flex items-center gap-2">
                            {item.name}
                            {(item as any).recipe_ingredients && (
                              <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 text-[10px] px-2 py-1 rounded uppercase tracking-widest flex items-center gap-1">
                                <ChefHat className="w-2.5 h-2.5" /> Recipe
                              </span>
                            )}
                          </h3>
                          {item.source_url && (
                            <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-1">
                              <LinkIcon className="w-3 h-3" /> Source Linked
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteItem(item.id);
                          }}
                          className="p-2.5 -m-1 text-zinc-400 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all rounded-xl touch-manipulation"
                          aria-label={`Delete ${item.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { val: item.calories, label: 'Cals', color: 'text-zinc-900 dark:text-white' },
                          { val: item.protein, label: 'Prot', color: 'text-indigo-600 dark:text-indigo-400' },
                          { val: item.fiber, label: 'Fibr', color: 'text-emerald-600 dark:text-emerald-400' },
                          { val: item.carbs, label: 'Carb', color: 'text-amber-600 dark:text-amber-400' },
                          { val: item.fats_total, label: 'Fats', color: 'text-orange-600 dark:text-orange-400' },
                          { val: item.sugars_total, label: 'Sugr', color: 'text-pink-600 dark:text-pink-400' }
                        ].map((m) => (
                          <div key={m.label} className="bg-zinc-50 dark:bg-zinc-800/50 p-2.5 sm:p-3 rounded-2xl border border-zinc-100 dark:border-zinc-700/50 flex flex-col gap-0.5">
                            <span className={`block text-base sm:text-lg font-black ${m.color}`}>{m.val}</span>
                            <span className="text-xs sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest">{m.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
    </div>
  );

  if (isPage) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" onClick={onClose} />
      {content}
    </div>
  );
}
