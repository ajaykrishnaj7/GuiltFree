'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import { X, Save, Target, Loader2, Info, Check, RotateCcw, TrendingUp, TrendingDown, Wand2, Activity } from 'lucide-react';
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

const METRIC_CONFIG: Record<string, { label: string, unit: string, desc: string }> = {
  weight: { label: 'Body Weight', unit: 'lbs', desc: 'Step on a calibrated scale first thing in the morning after using the restroom, before eating or drinking.' },
  body_fat: { label: 'Body Fat %', unit: '%', desc: 'Use a smart scale, calipers, or DEXA scan. If using calipers, measure at the exact same spots on chest, abdomen, and thigh each time.' },
  waist: { label: 'Waist Size', unit: 'in', desc: 'Measure around the narrowest part of your torso, typically just above your belly button. Keep the tape parallel to the floor, and do not suck in.' },
  belly: { label: 'Belly Circumference', unit: 'in', desc: 'Measure around the widest part of your belly, usually right over the belly button. Keep tape horizontal and do not pull too tight.' },
  chest: { label: 'Chest Size', unit: 'in', desc: 'Measure around the fullest part of your chest, keeping the tape horizontal.' },
  bicep: { label: 'Bicep Size', unit: 'in', desc: 'Measure around the thickest part of your flexed bicep.' },
  thigh: { label: 'Thigh Size', unit: 'in', desc: 'Measure around the thickest part of your upper leg while standing normally.' },
};

const FOCUS_METRICS: Record<string, string[]> = {
  maintain_weight: ['weight'],
  fat_loss_general: ['weight', 'body_fat', 'waist'],
  belly_fat_loss: ['weight', 'belly', 'waist'],
  visceral_fat_reduction: ['weight', 'waist', 'belly'],
  waist_reduction: ['weight', 'waist'],
  lean_muscle_gain: ['weight', 'body_fat', 'bicep', 'chest'],
  strength_gain: ['weight', 'bicep', 'chest', 'thigh'],
  body_recomposition: ['weight', 'body_fat', 'waist', 'bicep'],
  athletic_performance: ['weight', 'body_fat'],
  default: ['weight']
};

export default function ProfileSettings({ isOpen, onClose, isPage = false }: ProfileSettingsProps) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'macros' | 'ai' | 'tracker'>('macros');
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  
  const [remainingRequests, setRemainingRequests] = useState(5);
  const [goalSuggestionForm, setGoalSuggestionForm] = useState({
    age: '', heightCm: '', weightKg: '', country: '', sex: '', activityLevel: 'moderate', goalIntent: 'maintain_weight', mealsPerDay: '3',
  });
  const [goals, setGoals] = useState({
    daily_calorie_goal: 2000, daily_protein_goal_g: 150, daily_carbs_goal_g: 225, daily_fats_goal_g: 65, daily_fiber_goal_g: 30, daily_sugars_total_goal_g: 50, goal_focus: 'maintain_weight',
  });

  const [measurements, setMeasurements] = useState<any[]>([]);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);
  const [newMeasurementInputs, setNewMeasurementInputs] = useState<Record<string, string>>({});
  const [savingMeasurement, setSavingMeasurement] = useState<Record<string, boolean>>({});
  const [visibleInfo, setVisibleInfo] = useState<string | null>(null);

  const fetchGoalSuggestionUsage = useCallback(async () => {
    if (!user) return;
    const today = new Date().toLocaleDateString('en-CA');
    const { data, error } = await supabase.from('goal_suggestion_usage').select('request_count').eq('user_id', user.id).eq('day', today).single();
    if (error && error.code !== 'PGRST116') return;
    setRemainingRequests(Math.max(0, 5 - (data?.request_count || 0)));
  }, [user]);

  const fetchGoals = useCallback(async () => {
    if (!user) return setLoading(false);
    setLoading(true);
    const { data } = await supabase.from('profiles').select('daily_calorie_goal, daily_protein_goal_g, daily_carbs_goal_g, daily_fats_goal_g, daily_fiber_goal_g, daily_sugars_total_goal_g, goal_focus').eq('id', user?.id).single();
    if (data) {
      setGoals({
        daily_calorie_goal: data.daily_calorie_goal ?? 2000,
        daily_protein_goal_g: data.daily_protein_goal_g ?? 150,
        daily_carbs_goal_g: data.daily_carbs_goal_g ?? 225,
        daily_fats_goal_g: data.daily_fats_goal_g ?? 65,
        daily_fiber_goal_g: data.daily_fiber_goal_g ?? 30,
        daily_sugars_total_goal_g: data.daily_sugars_total_goal_g ?? 50,
        goal_focus: data.goal_focus ?? 'maintain_weight',
      });
      setGoalSuggestionForm(prev => ({ ...prev, goalIntent: data.goal_focus ?? 'maintain_weight' }));
    }
    setLoading(false);
  }, [user]);

  const fetchMeasurements = useCallback(async () => {
    if (!user) return;
    setLoadingMeasurements(true);
    const metricsToFetch = FOCUS_METRICS[goals.goal_focus] || FOCUS_METRICS.default;
    const { data, error } = await supabase
      .from('goal_measurements')
      .select('*')
      .eq('user_id', user.id)
      .in('metric_type', metricsToFetch)
      .order('date', { ascending: false });
    if (!error && data) setMeasurements(data);
    setLoadingMeasurements(false);
  }, [user, goals.goal_focus]);

  useEffect(() => {
    if (user && (isOpen || isPage)) {
      void fetchGoals();
      void fetchGoalSuggestionUsage();
    }
    if (!user) setLoading(false);
  }, [user, isOpen, isPage, fetchGoals, fetchGoalSuggestionUsage]);

  useEffect(() => {
    if (user && activeTab === 'tracker') void fetchMeasurements();
  }, [user, goals.goal_focus, activeTab, fetchMeasurements]);

  const handleSaveMacros = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) {
      window.localStorage.setItem('guiltfree.pending-goals', JSON.stringify(goals));
      alert('Please sign in to save goals.');
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('profiles').update(goals).eq('id', user?.id);
    if (!error) alert('Macro targets saved successfully!');
    else alert('Error saving macros');
    setSaving(false);
  };

  const handleSuggestGoals = async () => {
    if (!user) return alert('Please sign in to generate goal suggestions.');
    if (remainingRequests <= 0) return alert('Daily limit reached: 5 goal suggestions per day.');

    setSuggesting(true);
    setAiSuggestion(null);
    try {
      const aiSettings = loadAISettings(user.id);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Please sign in again to use goal suggestions.');

      const res = await fetch('/api/suggest-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ profile: goalSuggestionForm, aiConfig: aiSettings.useUserKey ? aiSettings : { useUserKey: false, provider: 'gemini', model: 'gemini-1.5-flash', apiKey: '' } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || 'Failed to suggest goals');

      setAiSuggestion(data);
      setRemainingRequests(typeof data.remaining === 'number' ? data.remaining : remainingRequests);
    } catch (err: any) {
      alert(err.message || 'Failed to generate goals');
    } finally {
      setSuggesting(false);
    }
  };

  const applyAiSuggestion = () => {
    if (!aiSuggestion) return;
    const newGoals = {
      daily_calorie_goal: aiSuggestion.daily_calorie_goal ?? goals.daily_calorie_goal,
      daily_protein_goal_g: aiSuggestion.daily_protein_goal_g ?? goals.daily_protein_goal_g,
      daily_carbs_goal_g: aiSuggestion.daily_carbs_goal_g ?? goals.daily_carbs_goal_g,
      daily_fats_goal_g: aiSuggestion.daily_fats_goal_g ?? goals.daily_fats_goal_g,
      daily_fiber_goal_g: aiSuggestion.daily_fiber_goal_g ?? goals.daily_fiber_goal_g,
      daily_sugars_total_goal_g: aiSuggestion.daily_sugars_total_goal_g ?? goals.daily_sugars_total_goal_g,
      goal_focus: goalSuggestionForm.goalIntent || goals.goal_focus,
    };
    setGoals(newGoals);
    setAiSuggestion(null);
    setActiveTab('macros');
  };

  const saveMeasurement = async (metric: string) => {
    if (!user || !newMeasurementInputs[metric]) return;
    const val = parseFloat(newMeasurementInputs[metric]);
    if (isNaN(val)) return alert('Invalid measurement value');
    
    setSavingMeasurement(p => ({...p, [metric]: true}));
    const date = new Date().toISOString().split('T')[0];
    
    // Check if measurement for today already exists
    const existing = measurements.find(m => m.metric_type === metric && m.date === date);
    let error;

    if (existing) {
      const res = await supabase.from('goal_measurements').update({ value: val }).eq('id', existing.id);
      error = res.error;
    } else {
      const res = await supabase.from('goal_measurements').insert({
        user_id: user.id,
        metric_type: metric,
        value: val,
        unit: METRIC_CONFIG[metric].unit,
        date: date
      });
      error = res.error;
    }

    if (!error) {
      setNewMeasurementInputs(p => ({...p, [metric]: ''}));
      await fetchMeasurements();
      alert('Measurement logged successfully!');
    } else {
      alert('Failed to log measurement.');
    }
    setSavingMeasurement(p => ({...p, [metric]: false}));
  };

  // Helper to get stats for a metric
  const getMetricStats = (metricId: string) => {
    const records = measurements.filter(m => m.metric_type === metricId).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (records.length < 2) return null;
    const baseline = records[0].value;
    const latest = records[records.length - 1].value;
    const diff = latest - baseline;
    const improved = diff < 0 ? 'down' : (diff > 0 ? 'up' : 'same'); // Interpretation depends on metric, but generally dropping is progress for weight/waist... wait, lean muscle wants UP.
    
    let isPositiveProgress = false;
    if (['bicep', 'chest', 'thigh', 'lean_muscle_gain'].includes(metricId) || (goals.goal_focus === 'lean_muscle_gain' && metricId === 'weight')) {
       isPositiveProgress = diff > 0;
    } else {
       isPositiveProgress = diff < 0; // standard fat loss
    }
    return { baseline, latest, diff: Math.abs(diff).toFixed(1), isPositiveProgress, improved };
  };

  if (!isOpen && !isPage) return null;

  const content = (
    <div className={`relative w-full ${isPage ? 'max-w-2xl mx-auto' : 'max-w-2xl shadow-2xl rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200'} bg-white dark:bg-zinc-900 overflow-hidden flex flex-col max-h-[90vh]`}>
        <div className="p-5 sm:p-8 shrink-0 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Your Goals</h2>
            </div>
            {!isPage && (
              <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"><X className="w-6 h-6" /></button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { id: 'macros', label: '1. Targets', icon: Target },
              { id: 'ai', label: '2. AI Coach', icon: Wand2 },
              { id: 'tracker', label: '3. Progress Tracker', icon: Activity },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                >
                  <Icon className="w-4 h-4" /> {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5 sm:p-8 overflow-y-auto flex-1 bg-zinc-50/30 dark:bg-zinc-950/20">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
          ) : (
            <>
              {/* CARD A: MACROS */}
              {activeTab === 'macros' && (
                <form onSubmit={handleSaveMacros} className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Daily Macro Targets</h3>
                      <button type="submit" disabled={saving} className="px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Targets
                      </button>
                    </div>

                    <div className="space-y-5">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Daily Calorie Limit</label>
                        <input
                          type="number"
                          value={goals.daily_calorie_goal === 0 ? 0 : (goals.daily_calorie_goal as number | string) || ''}
                          onChange={(e) => setGoals({...goals, daily_calorie_goal: e.target.value === '' ? '' as any : parseInt(e.target.value, 10)})}
                          onBlur={(e) => setGoals({...goals, daily_calorie_goal: parseInt(e.target.value, 10) || 0})}
                          className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-black text-2xl text-indigo-600 dark:text-indigo-400"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: 'Protein (g)', key: 'daily_protein_goal_g', color: 'text-rose-500' },
                          { label: 'Carbs (g)', key: 'daily_carbs_goal_g', color: 'text-amber-500' },
                          { label: 'Fats (g)', key: 'daily_fats_goal_g', color: 'text-cyan-500' },
                          { label: 'Fiber (g)', key: 'daily_fiber_goal_g', color: 'text-emerald-500' },
                          { label: 'Sugars (g)', key: 'daily_sugars_total_goal_g', color: 'text-purple-500' }
                        ].map((field) => (
                          <div key={field.key} className="flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{field.label}</label>
                            <input
                              type="number"
                              value={goals[field.key as keyof typeof goals] === 0 ? 0 : (goals[field.key as keyof typeof goals] as number | string) || ''}
                              onChange={(e) => setGoals({...goals, [field.key]: e.target.value === '' ? '' as any : parseInt(e.target.value, 10)})}
                              onBlur={(e) => setGoals({...goals, [field.key]: parseInt(e.target.value, 10) || 0})}
                              className={`w-full bg-transparent outline-none font-bold text-xl ${field.color}`}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Current Goal Focus</label>
                        <select value={goals.goal_focus} onChange={(e) => setGoals({ ...goals, goal_focus: e.target.value })} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold w-full truncate">
                          {GOAL_FOCUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <p className="text-xs text-zinc-500 mt-1 pl-1">Your Progress Tracker will automatically adjust to this focus.</p>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {/* CARD B: AI COACH */}
              {activeTab === 'ai' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">Ask the AI Coach <Wand2 className="w-4 h-4 text-indigo-500" /></h3>
                        <p className="text-xs text-zinc-500">Get personalized macro tracking recommendations.</p>
                      </div>
                      <div className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                        {remainingRequests}/5 Left
                      </div>
                    </div>

                    {!aiSuggestion ? (
                      <div className="space-y-5 mt-6">
                        <div className="grid grid-cols-2 gap-3">
                          <input type="number" placeholder="Age" value={goalSuggestionForm.age} onChange={(e) => setGoalSuggestionForm(prev => ({ ...prev, age: e.target.value }))} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none font-medium" />
                          <select value={goalSuggestionForm.sex} onChange={(e) => setGoalSuggestionForm(prev => ({ ...prev, sex: e.target.value }))} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none font-medium text-zinc-500">
                            <option value="">Sex...</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                          </select>
                          <input type="number" placeholder="Height (cm)" value={goalSuggestionForm.heightCm} onChange={(e) => setGoalSuggestionForm(prev => ({ ...prev, heightCm: e.target.value }))} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none font-medium" />
                          <input type="number" placeholder="Weight (kg)" value={goalSuggestionForm.weightKg} onChange={(e) => setGoalSuggestionForm(prev => ({ ...prev, weightKg: e.target.value }))} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none font-medium" />
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                          <select value={goalSuggestionForm.activityLevel} onChange={(e) => setGoalSuggestionForm(prev => ({ ...prev, activityLevel: e.target.value }))} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none font-medium">
                            <option value="sedentary">Sedentary (Little to no exercise)</option>
                            <option value="light">Light (Exercise 1-3 days/wk)</option>
                            <option value="moderate">Moderate (Exercise 3-5 days/wk)</option>
                            <option value="active">Active (Hard exercise 6-7 days/wk)</option>
                            <option value="very_active">Very Active (Physical job + training)</option>
                          </select>
                          <select value={goalSuggestionForm.goalIntent} onChange={(e) => setGoalSuggestionForm(prev => ({ ...prev, goalIntent: e.target.value }))} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none font-medium">
                            {GOAL_FOCUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </div>

                        <button type="button" onClick={handleSuggestGoals} disabled={suggesting || remainingRequests <= 0} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-200 dark:shadow-none disabled:opacity-50">
                          {suggesting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />} Generate Plan
                        </button>
                      </div>
                    ) : (
                      <div className="mt-6 space-y-6 animate-in slide-in-from-bottom-4">
                        <div className="p-5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-3xl">
                          <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed italic mb-4">"{aiSuggestion.rationale}"</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl shadow-sm text-center">
                              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Calories</span>
                              <span className="font-black text-xl text-indigo-600">{aiSuggestion.daily_calorie_goal}</span>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl shadow-sm text-center">
                              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Protein</span>
                              <span className="font-black text-xl text-rose-500">{aiSuggestion.daily_protein_goal_g}g</span>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl shadow-sm text-center">
                              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Carbs</span>
                              <span className="font-black text-xl text-amber-500">{aiSuggestion.daily_carbs_goal_g}g</span>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl shadow-sm text-center">
                              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Fats</span>
                              <span className="font-black text-xl text-cyan-500">{aiSuggestion.daily_fats_goal_g}g</span>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl shadow-sm text-center">
                              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Fiber</span>
                              <span className="font-black text-xl text-emerald-500">{aiSuggestion.daily_fiber_goal_g}g</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button onClick={() => setAiSuggestion(null)} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all">
                            <X className="w-5 h-5" /> Discard
                          </button>
                          <button onClick={applyAiSuggestion} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none">
                            <Check className="w-5 h-5" /> Accept & Save
                          </button>
                        </div>
                        <button onClick={handleSuggestGoals} disabled={suggesting || remainingRequests <= 0} className="w-full py-3 text-zinc-400 font-bold text-sm flex justify-center items-center gap-2 hover:text-zinc-600 transition-colors">
                          <RotateCcw className="w-4 h-4" /> Retry Suggestion
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CARD C: PROGRESS TRACKER */}
              {activeTab === 'tracker' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                    <div className="mb-6">
                      <h3 className="font-bold text-lg flex items-center gap-2">Progress Tracker <Activity className="w-4 h-4 text-emerald-500" /></h3>
                      <p className="text-xs text-zinc-500">Currently adapting to <strong>'{GOAL_FOCUS_OPTIONS.find(o => o.value === goals.goal_focus)?.label}'</strong>.</p>
                    </div>

                    <div className="space-y-8">
                      {loadingMeasurements ? (
                         <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
                      ) : (
                         (FOCUS_METRICS[goals.goal_focus] || FOCUS_METRICS.default).map(metricId => {
                           const config = METRIC_CONFIG[metricId];
                           if (!config) return null;
                           const stats = getMetricStats(metricId);
                           const historyLogs = measurements.filter(m => m.metric_type === metricId).slice(0, 5); // show last 5
                           
                           return (
                             <div key={metricId} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 pb-6 last:pb-0">
                               <div className="flex items-center justify-between mb-3">
                                 <h4 className="font-black text-zinc-900 dark:text-white flex items-center gap-2">
                                   {config.label}
                                   <button 
                                      onClick={() => setVisibleInfo(visibleInfo === metricId ? null : metricId)}
                                      className="text-zinc-400 hover:text-indigo-500 transition-colors bg-zinc-100 dark:bg-zinc-800 rounded-full p-1"
                                   >
                                     <Info className="w-3.5 h-3.5" />
                                   </button>
                                 </h4>
                                 {stats && (
                                   <div className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${stats.isPositiveProgress ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                                     {stats.isPositiveProgress ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                     {stats.diff} {config.unit} overall
                                   </div>
                                 )}
                               </div>

                               {visibleInfo === metricId && (
                                 <div className="mb-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/20 rounded-2xl animate-in zoom-in-95">
                                   <p className="text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed"><strong>How to measure:</strong> {config.desc}</p>
                                 </div>
                               )}

                               <div className="flex gap-2">
                                 <div className="relative flex-1">
                                   <input 
                                     type="number" 
                                     step="0.1"
                                     value={newMeasurementInputs[metricId] || ''}
                                     onChange={(e) => setNewMeasurementInputs(p => ({...p, [metricId]: e.target.value}))}
                                     placeholder={`Today's ${config.label}`}
                                     className="w-full pl-4 pr-12 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:border-emerald-500 font-bold"
                                   />
                                   <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 uppercase tracking-widest">{config.unit}</span>
                                 </div>
                                 <button 
                                    onClick={() => saveMeasurement(metricId)}
                                    disabled={!newMeasurementInputs[metricId] || savingMeasurement[metricId]}
                                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 text-white rounded-2xl font-bold transition-all disabled:opacity-50 min-w-[80px] flex justify-center items-center"
                                 >
                                   {savingMeasurement[metricId] ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log'}
                                 </button>
                               </div>

                               {historyLogs.length > 0 && (
                                 <div className="mt-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800">
                                    {historyLogs.map(log => (
                                      <div key={log.id} className="flex justify-between items-center p-3 text-sm border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
                                        <span className="text-zinc-500 font-medium">{new Date(log.date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</span>
                                        <span className="font-bold text-zinc-900 dark:text-white">{log.value} {log.unit}</span>
                                      </div>
                                    ))}
                                 </div>
                               )}
                             </div>
                           );
                         })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
    </div>
  );

  if (isPage) return content;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" onClick={onClose} />
      {content}
    </div>
  );
}
