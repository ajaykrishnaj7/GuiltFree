'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import { X, Save, Target, Loader2 } from 'lucide-react';
import { loadAISettings } from '@/lib/aiSettings';

interface ProfileSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  isPage?: boolean;
}

const GOAL_FOCUS_OPTIONS = [
  { value: 'maintain_weight', label: 'Maintain Weight' },
  { value: 'fat_loss_general', label: 'Fat Loss (General)' },
  { value: 'belly_fat_loss', label: 'Belly Fat Loss' },
  { value: 'visceral_fat_reduction', label: 'Visceral Fat Reduction' },
  { value: 'waist_reduction', label: 'Waist Size Reduction' },
  { value: 'lean_muscle_gain', label: 'Lean Muscle Gain' },
  { value: 'strength_gain', label: 'Strength Gain' },
  { value: 'body_recomposition', label: 'Body Recomposition' },
  { value: 'athletic_performance', label: 'Athletic Performance' },
  { value: 'endurance_improvement', label: 'Endurance Improvement' },
  { value: 'energy_boost', label: 'Daily Energy Boost' },
  { value: 'improve_recovery', label: 'Improve Recovery' },
  { value: 'improve_sleep', label: 'Improve Sleep Quality' },
  { value: 'blood_sugar_control', label: 'Blood Sugar Control' },
  { value: 'hormone_support', label: 'Hormone Support' },
  { value: 'heart_health', label: 'Heart Health' },
  { value: 'gut_health', label: 'Gut Health' },
  { value: 'digestive_comfort', label: 'Digestive Comfort' },
  { value: 'reduce_bloating', label: 'Reduce Bloating' },
  { value: 'high_protein_lifestyle', label: 'High-Protein Lifestyle' },
  { value: 'low_carb_lifestyle', label: 'Lower-Carb Lifestyle' },
  { value: 'plant_forward_nutrition', label: 'Plant-Forward Nutrition' },
  { value: 'healthy_aging', label: 'Healthy Aging' },
  { value: 'postpartum_recovery', label: 'Postpartum Recovery' },
];

export default function ProfileSettings({ isOpen, onClose, isPage = false }: ProfileSettingsProps) {
  const { user } = useAuth();
  const draftHydratedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [remainingRequests, setRemainingRequests] = useState(5);
  const [goalSuggestionForm, setGoalSuggestionForm] = useState({
    age: '',
    heightCm: '',
    weightKg: '',
    country: '',
    sex: '',
    activityLevel: 'moderate',
    goalIntent: 'maintain_weight',
    mealsPerDay: '3',
  });
  const [goals, setGoals] = useState({
    daily_calorie_goal: 2000,
    daily_protein_goal_g: 150,
    daily_carbs_goal_g: 225,
    daily_fats_goal_g: 65,
    daily_fiber_goal_g: 30,
    daily_sugars_total_goal_g: 50,
    goal_focus: 'maintain_weight',
  });
  const draftScope = user?.id || 'anon';
  const draftStorageKey = `guiltfree.profile-goals-draft.${draftScope}`;

  const fetchGoalSuggestionUsage = useCallback(async () => {
    if (!user) return;
    const today = new Date().toLocaleDateString('en-CA');
    const { data, error } = await supabase
      .from('goal_suggestion_usage')
      .select('request_count')
      .eq('user_id', user.id)
      .eq('day', today)
      .single();

    if (error && error.code !== 'PGRST116') return;
    const used = data?.request_count || 0;
    setRemainingRequests(Math.max(0, 5 - used));
  }, [user]);

  const fetchGoals = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('daily_calorie_goal, daily_protein_goal_g, daily_carbs_goal_g, daily_fats_goal_g, daily_fiber_goal_g, daily_sugars_total_goal_g, goal_focus')
      .eq('id', user?.id)
      .single();

    if (data && !draftHydratedRef.current) {
      setGoals({
        daily_calorie_goal: data.daily_calorie_goal ?? 2000,
        daily_protein_goal_g: data.daily_protein_goal_g ?? 150,
        daily_carbs_goal_g: data.daily_carbs_goal_g ?? 225,
        daily_fats_goal_g: data.daily_fats_goal_g ?? 65,
        daily_fiber_goal_g: data.daily_fiber_goal_g ?? 30,
        daily_sugars_total_goal_g: data.daily_sugars_total_goal_g ?? 50,
        goal_focus: data.goal_focus ?? 'maintain_weight',
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    draftHydratedRef.current = false;
  }, [draftStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || draftHydratedRef.current) return;
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        goals?: typeof goals;
        goalSuggestionForm?: typeof goalSuggestionForm;
      };
      if (parsed.goals) setGoals(parsed.goals);
      if (parsed.goalSuggestionForm) setGoalSuggestionForm(parsed.goalSuggestionForm);
      draftHydratedRef.current = true;
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (user && (isOpen || isPage)) {
      void fetchGoals();
      void fetchGoalSuggestionUsage();
      return;
    }
    if (!user) {
      setLoading(false);
    }
  }, [user, isOpen, isPage, fetchGoals, fetchGoalSuggestionUsage]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      window.localStorage.setItem('guiltfree.pending-goals', JSON.stringify(goals));
      alert('Please sign in to save goals. We will continue automatically after sign in.');
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }
    setSaving(true);
    
    const { error } = await supabase
      .from('profiles')
      .update(goals)
      .eq('id', user?.id);

    if (!error) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(draftStorageKey);
      }
      alert('Goals updated!');
      if (!isPage) onClose();
    }
    setSaving(false);
  };

  useEffect(() => {
    if (!user) return;
    const pending = window.localStorage.getItem('guiltfree.pending-goals');
    if (!pending) return;

    let pendingGoals = goals;
    if (pending) {
      try {
        pendingGoals = JSON.parse(pending) as typeof goals;
        setGoals(pendingGoals);
      } catch {
        window.localStorage.removeItem('guiltfree.pending-goals');
        return;
      }
    }

    const savePendingGoals = async () => {
      const { error } = await supabase
        .from('profiles')
        .update(pendingGoals)
        .eq('id', user.id);
      if (!error) {
        window.localStorage.removeItem('guiltfree.pending-goals');
        alert('Pending goals saved to your profile.');
      }
    };
    void savePendingGoals();
  }, [user, goals, draftStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = { goals, goalSuggestionForm };
    window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
  }, [draftStorageKey, goals, goalSuggestionForm]);

  const handleSuggestGoals = async () => {
    if (!user) {
      alert('Please sign in to generate goal suggestions.');
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }
    if (remainingRequests <= 0) {
      alert('Daily limit reached: 5 goal suggestions per day.');
      return;
    }

    setSuggesting(true);
    try {
      const aiSettings = loadAISettings(user.id);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Please sign in again to use goal suggestions.');
      }

      const res = await fetch('/api/suggest-goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          profile: goalSuggestionForm,
          aiConfig: aiSettings.useUserKey ? aiSettings : { useUserKey: false, provider: 'gemini', model: 'gemini-1.5-flash', apiKey: '' },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || 'Failed to suggest goals');

      setGoals({
        daily_calorie_goal: data.daily_calorie_goal ?? goals.daily_calorie_goal,
        daily_protein_goal_g: data.daily_protein_goal_g ?? goals.daily_protein_goal_g,
        daily_carbs_goal_g: data.daily_carbs_goal_g ?? goals.daily_carbs_goal_g,
        daily_fats_goal_g: data.daily_fats_goal_g ?? goals.daily_fats_goal_g,
        daily_fiber_goal_g: data.daily_fiber_goal_g ?? goals.daily_fiber_goal_g,
        daily_sugars_total_goal_g: data.daily_sugars_total_goal_g ?? goals.daily_sugars_total_goal_g,
        goal_focus: goalSuggestionForm.goalIntent || goals.goal_focus,
      });

      setRemainingRequests(typeof data.remaining === 'number' ? data.remaining : remainingRequests);
    } catch (err: any) {
      alert(err.message || 'Failed to generate goals');
    } finally {
      setSuggesting(false);
    }
  };

  if (!isOpen && !isPage) return null;

  const content = (
    <div className={`relative w-full ${isPage ? '' : 'max-w-md shadow-2xl rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200'} bg-white dark:bg-zinc-900 overflow-hidden`}>
        <div className="p-5 sm:p-8">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Your Goals</h2>
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

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="max-h-[60vh] overflow-y-auto pr-2 -mr-2 space-y-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-500 uppercase tracking-wider ml-1">Daily Calorie Goal</label>
                  <input
                    type="number"
                    value={goals.daily_calorie_goal}
                    onChange={(e) => setGoals({...goals, daily_calorie_goal: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Protein (g)', key: 'daily_protein_goal_g' },
                    { label: 'Carbs (g)', key: 'daily_carbs_goal_g' },
                    { label: 'Fats (g)', key: 'daily_fats_goal_g' },
                    { label: 'Fiber (g)', key: 'daily_fiber_goal_g' },
                    { label: 'Sugars (g)', key: 'daily_sugars_total_goal_g' }
                  ].map((field) => (
                    <div key={field.key} className="flex flex-col gap-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter ml-1">{field.label}</label>
                      <input
                        type="number"
                        value={goals[field.key as keyof typeof goals]}
                        onChange={(e) => setGoals({...goals, [field.key]: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter ml-1">Primary Goal Focus</label>
                  <select
                    value={goals.goal_focus}
                    onChange={(e) => setGoals({ ...goals, goal_focus: e.target.value })}
                    className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold"
                  >
                    {GOAL_FOCUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">AI Goal Suggestion</h3>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{remainingRequests}/5 left today</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Age"
                      value={goalSuggestionForm.age}
                      onChange={(e) => setGoalSuggestionForm(prev => ({ ...prev, age: e.target.value }))}
                      className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none font-bold"
                    />
                    <input
                      type="number"
                      placeholder="Height (cm)"
                      value={goalSuggestionForm.heightCm}
                      onChange={(e) => setGoalSuggestionForm(prev => ({ ...prev, heightCm: e.target.value }))}
                      className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none font-bold"
                    />
                    <input
                      type="number"
                      placeholder="Weight (kg)"
                      value={goalSuggestionForm.weightKg}
                      onChange={(e) => setGoalSuggestionForm(prev => ({ ...prev, weightKg: e.target.value }))}
                      className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none font-bold"
                    />
                    <input
                      type="text"
                      placeholder="Country"
                      value={goalSuggestionForm.country}
                      onChange={(e) => setGoalSuggestionForm(prev => ({ ...prev, country: e.target.value }))}
                      className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none font-bold"
                    />
                    <select
                      value={goalSuggestionForm.sex}
                      onChange={(e) => setGoalSuggestionForm(prev => ({ ...prev, sex: e.target.value }))}
                      className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none font-bold"
                    >
                      <option value="">Sex</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    <select
                      value={goalSuggestionForm.activityLevel}
                      onChange={(e) => setGoalSuggestionForm(prev => ({ ...prev, activityLevel: e.target.value }))}
                      className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none font-bold"
                    >
                      <option value="sedentary">Sedentary</option>
                      <option value="light">Light</option>
                      <option value="moderate">Moderate</option>
                      <option value="active">Active</option>
                      <option value="very_active">Very active</option>
                    </select>
                    <select
                      value={goalSuggestionForm.goalIntent}
                      onChange={(e) => setGoalSuggestionForm(prev => ({ ...prev, goalIntent: e.target.value }))}
                      className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none font-bold"
                    >
                      {GOAL_FOCUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      placeholder="Meals/day"
                      value={goalSuggestionForm.mealsPerDay}
                      onChange={(e) => setGoalSuggestionForm(prev => ({ ...prev, mealsPerDay: e.target.value }))}
                      className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none font-bold"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSuggestGoals}
                    disabled={suggesting || remainingRequests <= 0}
                    className="w-full py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-black disabled:opacity-50"
                  >
                    {suggesting ? 'Generating...' : 'Suggest Goals With AI'}
                  </button>
                </div>
              </div>

              <button 
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Save Goals</>}
              </button>
            </form>
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
