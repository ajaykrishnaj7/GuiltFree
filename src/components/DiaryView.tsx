'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import { Calendar, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, Utensils, Clock, Loader2, Target, Zap, X, Trash2, Edit2 } from 'lucide-react';
import EditMealModal from './EditMealModal';

interface Meal {
  id: string;
  created_at: string;
  name: string;
  type: string;
  description?: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  total_fiber: number;
  total_sugars_total: number;
  raw_input: string;
}

interface Profile {
  daily_calorie_goal: number;
  daily_protein_goal_g: number | null;
  daily_carbs_goal_g: number | null;
  daily_fats_goal_g: number | null;
  daily_fiber_goal_g: number | null;
  daily_sugars_total_goal_g: number | null;
}

interface MealItem {
  id: string;
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
}

export default function DiaryView() {
  const { user, loading: authLoading } = useAuth();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50 | 100>(10);
  const [totalMealsCount, setTotalMealsCount] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState<(Meal & { items?: MealItem[] }) | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Meal | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(30);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const todayDate = new Date();
  const maxFilterDate = todayDate.toLocaleDateString('en-CA');
  const minDateObj = new Date(todayDate);
  minDateObj.setDate(minDateObj.getDate() - 180);
  const minFilterDate = minDateObj.toLocaleDateString('en-CA');
  const defaultStartObj = new Date(todayDate);
  defaultStartObj.setDate(defaultStartObj.getDate() - 30);
  const [filterFrom, setFilterFrom] = useState(defaultStartObj.toLocaleDateString('en-CA'));
  const [filterTo, setFilterTo] = useState(maxFilterDate);

  const formatDateRangeLabel = (value: string) => {
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatMealDate = (value: string, mobile = false) =>
    new Date(value).toLocaleString([], mobile ? {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    } : {
      weekday: 'short',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  const sortMealsDesc = (mealList: Meal[]) =>
    [...mealList].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const clearPendingTimers = () => {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const clampFilterDate = (value: string) => {
    if (!value) return minFilterDate;
    if (value < minFilterDate) return minFilterDate;
    if (value > maxFilterDate) return maxFilterDate;
    return value;
  };

  const finalizeDelete = async (mealToDelete: Meal) => {
    clearPendingTimers();
    setPendingDelete(null);
    setUndoSecondsLeft(30);

    try {
      const { error } = await supabase
        .from('meals')
        .delete()
        .eq('id', mealToDelete.id);

      if (error) throw error;

      if (selectedMeal?.id === mealToDelete.id) {
        setSelectedMeal(null);
      }
      await fetchData();
    } catch (err: any) {
      setMeals(prev => sortMealsDesc([...prev, mealToDelete]));
      console.error('Error deleting meal:', err);
      alert('Failed to delete meal: ' + err.message);
    }
  };

  const undoDelete = () => {
    if (!pendingDelete) return;
    clearPendingTimers();
    setPendingDelete(null);
    setUndoSecondsLeft(30);
    void fetchData();
  };

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize - 1;

      const [mealsRes, todayMealsRes, profileRes] = await Promise.all([
        supabase
          .from('meals')
          .select('*', { count: 'exact' })
          .gte('created_at', new Date(`${filterFrom}T00:00:00`).toISOString())
          .lte('created_at', new Date(`${filterTo}T23:59:59.999`).toISOString())
          .order('created_at', { ascending: false })
          .range(startIndex, endIndex),
        supabase
          .from('meals')
          .select('*')
          .gte('created_at', (() => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            return d.toISOString();
          })())
          .lt('created_at', (() => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + 1);
            return d.toISOString();
          })()),
        supabase
          .from('profiles')
          .select('daily_calorie_goal, daily_protein_goal_g, daily_carbs_goal_g, daily_fats_goal_g, daily_fiber_goal_g, daily_sugars_total_goal_g')
          .eq('id', user.id)
          .single()
      ]);

      if (mealsRes.data) {
        setMeals(mealsRes.data);
      }
      if (mealsRes.count !== null) {
        setTotalMealsCount(mealsRes.count || 0);
      }
      if (todayMealsRes.data) {
        setTodayMeals(todayMealsRes.data);
      }
      if (profileRes.data) setProfile(profileRes.data);
    } catch (err) {
      console.error('Data fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, filterFrom, filterTo, user]);

  useEffect(() => {
    if (user) {
      fetchData();
      const handleMealSaved = () => fetchData();
      window.addEventListener('meal-saved', handleMealSaved);
      return () => window.removeEventListener('meal-saved', handleMealSaved);
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading, fetchData]);

  useEffect(() => {
    return () => {
      clearPendingTimers();
    };
  }, []);

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(totalMealsCount / pageSize));
    if (currentPage > pages) {
      setCurrentPage(pages);
    }
  }, [totalMealsCount, currentPage, pageSize]);

  const fetchMealDetails = async (meal: Meal) => {
    setSelectedMeal({ ...meal });
    const { data, error } = await supabase
      .from('meal_items')
      .select('*')
      .eq('meal_id', meal.id);

    if (error) {
      console.error('Meal details fetch failed:', error);
      return;
    }

    setSelectedMeal({ ...meal, items: data || [] });
  };

  const handleDeleteMeal = async (mealId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this meal? This action cannot be undone.')) return;

    const mealToDelete = meals.find(m => m.id === mealId) || (selectedMeal ? meals.find(m => m.id === selectedMeal.id) : null);
    if (!mealToDelete) return;

    if (pendingDelete) {
      await finalizeDelete(pendingDelete);
    }

    setMeals(prev => prev.filter(m => m.id !== mealId));
    setTotalMealsCount(prev => Math.max(prev - 1, 0));
    setTodayMeals(prev => prev.filter(m => m.id !== mealId));
    if (selectedMeal?.id === mealId) {
      setSelectedMeal(null);
    }

    setPendingDelete(mealToDelete);
    setUndoSecondsLeft(30);

    deleteTimerRef.current = setTimeout(() => {
      void finalizeDelete(mealToDelete);
    }, 30000);

    countdownRef.current = setInterval(() => {
      setUndoSecondsLeft(prev => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const totalPages = Math.max(1, Math.ceil(totalMealsCount / pageSize));
  const pageStartItem = totalMealsCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEndItem = Math.min(currentPage * pageSize, totalMealsCount);
  
  const dailyTotals = todayMeals.reduce((acc, m: any) => ({
    calories: acc.calories + m.total_calories,
    protein: acc.protein + m.total_protein,
    carbs: acc.carbs + m.total_carbs,
    fats: acc.fats + m.total_fats,
    fiber: acc.fiber + (m.total_fiber || 0),
    sugars_total: acc.sugars_total + (m.total_sugars_total || 0),
  }), { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sugars_total: 0 });

  const calorieGoal = profile?.daily_calorie_goal || 2000;
  const calPercent = Math.min(Math.round((dailyTotals.calories / calorieGoal) * 100), 100);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border border-zinc-200 dark:border-zinc-800 px-6">
        <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-6 h-6 text-zinc-400" />
        </div>
        <h3 className="text-lg font-bold mb-2">Your Diary is waiting</h3>
        <p className="text-zinc-500 text-sm max-w-xs mx-auto mb-6">
          Sign in to track your meals and see your nutritional progress over time.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">
      {/* Daily Summary Card */}
      <div className="bg-indigo-600 dark:bg-indigo-500 rounded-[2.5rem] p-5 sm:p-8 text-white shadow-2xl shadow-indigo-500/20 relative overflow-hidden group">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-white/20 transition-colors duration-700" />
        
        <div className="relative">
          <div className="flex items-center gap-2 mb-6 opacity-90">
            <Target className="w-4 h-4" />
            <span className="text-sm sm:text-xs font-bold uppercase tracking-widest">Today's Progress</span>
          </div>
          
          <div className="flex flex-col gap-6">
            <div className="flex items-end justify-between">
              <div className="flex flex-col">
                <span className="text-5xl sm:text-4xl font-black">{dailyTotals.calories}</span>
                <span className="text-sm sm:text-xs uppercase font-bold tracking-tighter opacity-80">Calories consumed</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-2xl sm:text-xl font-bold opacity-80">{calorieGoal}</span>
                <span className="text-sm sm:text-xs uppercase font-bold tracking-tighter opacity-60">Daily Goal</span>
              </div>
            </div>

            {/* Progress Bars Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs sm:text-[10px] uppercase font-bold tracking-widest opacity-80">
                  <span>Calories</span>
                  <span>{calPercent}%</span>
                </div>
                <div className="w-full h-3 sm:h-2.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                  <div className="h-full bg-white rounded-full transition-all duration-1000" style={{ width: `${calPercent}%` }} />
                </div>
              </div>

              {profile?.daily_protein_goal_g && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs sm:text-[10px] uppercase font-bold tracking-widest opacity-80">
                    <span>Protein</span>
                    <span>{Math.round(dailyTotals.protein)} / {profile.daily_protein_goal_g}g</span>
                  </div>
                  <div className="w-full h-3 sm:h-2.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                    <div className="h-full bg-cyan-300 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(103,232,249,0.6)]" style={{ width: `${Math.min((dailyTotals.protein / profile.daily_protein_goal_g) * 100, 100)}%` }} />
                  </div>
                </div>
              )}

              {profile?.daily_fiber_goal_g && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs sm:text-[10px] uppercase font-bold tracking-widest opacity-80">
                    <span>Fiber</span>
                    <span>{Math.round(dailyTotals.fiber || 0)} / {profile.daily_fiber_goal_g}g</span>
                  </div>
                  <div className="w-full h-3 sm:h-2.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                    <div className="h-full bg-emerald-400 rounded-full transition-all duration-1000" style={{ width: `${Math.min(((dailyTotals.fiber || 0) / profile.daily_fiber_goal_g) * 100, 100)}%` }} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="flex flex-col">
                  <span className="text-xs sm:text-[10px] uppercase font-bold tracking-widest opacity-60">Carbs</span>
                  <span className="text-2xl sm:text-xl font-black">{Math.round(dailyTotals.carbs)}g</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs sm:text-[10px] uppercase font-bold tracking-widest opacity-60">Fats</span>
                  <span className="text-2xl sm:text-xl font-black">{Math.round(dailyTotals.fats)}g</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs sm:text-[10px] uppercase font-bold tracking-widest opacity-60">Sugars</span>
                  <span className="text-2xl sm:text-xl font-black">{Math.round(dailyTotals.sugars_total)}g</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 pb-28 sm:pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-1 sm:px-2 gap-2">
          <h2 className="text-4xl sm:text-2xl font-bold tracking-tight leading-none">Recent Activity</h2>
          <div className="flex items-start gap-2 text-base sm:text-sm font-medium text-zinc-500">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="leading-tight break-words">{formatDateRangeLabel(filterFrom)} to {formatDateRangeLabel(filterTo)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-[10px] font-bold uppercase tracking-widest text-zinc-400">From</label>
              <input
                type="date"
                min={minFilterDate}
                max={maxFilterDate}
                value={filterFrom}
                onChange={(e) => {
                  const nextFrom = clampFilterDate(e.target.value);
                  setFilterFrom(nextFrom);
                  if (nextFrom > filterTo) setFilterTo(nextFrom);
                  setCurrentPage(1);
                }}
                className="px-3 py-2.5 min-h-[44px] bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-indigo-500 text-base sm:text-sm font-semibold"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-[10px] font-bold uppercase tracking-widest text-zinc-400">To</label>
              <input
                type="date"
                min={minFilterDate}
                max={maxFilterDate}
                value={filterTo}
                onChange={(e) => {
                  const nextTo = clampFilterDate(e.target.value);
                  setFilterTo(nextTo);
                  if (nextTo < filterFrom) setFilterFrom(nextTo);
                  setCurrentPage(1);
                }}
                className="px-3 py-2.5 min-h-[44px] bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-indigo-500 text-base sm:text-sm font-semibold"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: '7D', days: 7 },
              { label: '30D', days: 30 },
              { label: '90D', days: 90 },
              { label: '180D', days: 180 }
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setDate(end.getDate() - preset.days);
                  const startStr = start.toLocaleDateString('en-CA');
                  setFilterFrom(startStr < minFilterDate ? minFilterDate : startStr);
                  setFilterTo(maxFilterDate);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 min-h-[40px] rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs sm:text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="text-sm sm:text-[11px] text-zinc-400 font-medium">
            Filter supports only the last 180 days.
          </p>
        </div>

        {meals.length === 0 ? (
          <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border border-zinc-200 dark:border-zinc-800 px-6">
            <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Utensils className="w-6 h-6 text-zinc-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">No logs yet</h3>
            <p className="text-zinc-500 text-sm max-w-xs mx-auto">
              Try typing something like "3 eggs and avocado toast" in the bar above!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {meals.map((meal) => (
              <div
                key={meal.id} 
                onClick={() => fetchMealDetails(meal)}
                className="group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 sm:p-6 hover:shadow-xl hover:scale-[1.01] transition-all cursor-pointer overflow-hidden shadow-sm"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative flex items-center justify-between gap-3 sm:gap-4 pr-2 sm:pr-6">
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 min-w-0 flex-wrap">
                      <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="text-xs sm:text-[10px] text-zinc-400 uppercase font-bold tracking-[0.12em] sm:tracking-widest break-words">
                        <span className="sm:hidden">{formatMealDate(meal.created_at, true)}</span>
                        <span className="hidden sm:inline">{formatMealDate(meal.created_at)}</span>
                      </span>
                      <span className="text-[10px] text-zinc-300 dark:text-zinc-700 hidden sm:inline">•</span>
                      <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded text-xs sm:text-[10px] font-black uppercase tracking-widest shrink-0">
                        {meal.type || 'Meal'}
                      </span>
                    </div>
                    <h4 className="text-2xl sm:text-lg font-black text-zinc-900 dark:text-white truncate lg:max-w-md">
                      {meal.name || meal.raw_input}
                    </h4>
                    <div className="grid grid-cols-5 gap-2 sm:gap-4 mt-2 text-xs sm:text-xs uppercase font-bold tracking-tight text-zinc-400">
                      <span>P: <b className="text-zinc-800 dark:text-zinc-200">{Math.round(meal.total_protein)}g</b></span>
                      <span>Fib: <b className="text-zinc-800 dark:text-zinc-200">{Math.round(meal.total_fiber || 0)}g</b></span>
                      <span>C: <b className="text-zinc-800 dark:text-zinc-200">{Math.round(meal.total_carbs)}g</b></span>
                      <span>F: <b className="text-zinc-800 dark:text-zinc-200">{Math.round(meal.total_fats)}g</b></span>
                      <span>S: <b className="text-zinc-800 dark:text-zinc-200">{Math.round(meal.total_sugars_total || 0)}g</b></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                    <div className="flex flex-col items-end">
                      <span className="text-3xl sm:text-2xl font-black text-zinc-950 dark:text-white outline-indigo-500 leading-none">
                        {meal.total_calories}
                      </span>
                      <span className="text-xs sm:text-[10px] text-zinc-400 uppercase font-bold tracking-tighter">kcal</span>
                    </div>
                    
                    <button 
                      onClick={(e) => handleDeleteMeal(meal.id, e)}
                      className="h-10 w-10 sm:h-auto sm:w-auto p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all z-10"
                      title="Delete meal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <ChevronRight className="text-zinc-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all w-5 h-5" />
                  </div>
                </div>
              </div>
            ))}

            {totalMealsCount > 0 && (
              <div className="flex flex-col gap-3 sm:gap-2 sm:flex-row sm:items-center sm:justify-between pt-3">
                <span className="text-sm sm:text-xs text-zinc-500 font-medium">
                  Showing {pageStartItem}-{pageEndItem} of {totalMealsCount}
                </span>
                <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end">
                  <div className="flex items-center gap-2 mr-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Per page</label>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        const nextSize = parseInt(e.target.value, 10) as 10 | 20 | 50 | 100;
                        setPageSize(nextSize);
                        setCurrentPage(1);
                      }}
                      className="h-10 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm sm:text-xs font-bold outline-none"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage <= 1}
                    className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold disabled:opacity-40 flex items-center justify-center"
                    title="First page"
                    aria-label="First page"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold disabled:opacity-40 flex items-center justify-center"
                    title="Previous page"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-base sm:text-xs font-bold text-zinc-500 min-w-10 text-center">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold disabled:opacity-40 flex items-center justify-center"
                    title="Next page"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage >= totalPages}
                    className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold disabled:opacity-40 flex items-center justify-center"
                    title="Last page"
                    aria-label="Last page"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Meal Detail Modal */}
      {selectedMeal && (
        <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" onClick={() => setSelectedMeal(null)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[calc(100dvh-0.5rem)] sm:max-h-[90vh]">
            <div className="p-5 sm:p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-start sm:items-center bg-zinc-50/50 dark:bg-zinc-800/30 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  {new Date(selectedMeal.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
                <h2 className="text-4xl sm:text-2xl font-black text-zinc-900 dark:text-white capitalize leading-none sm:leading-tight">
                  {selectedMeal.name || selectedMeal.raw_input}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button 
                  onClick={() => setIsEditing(true)}
                  className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-xl hover:text-indigo-600 transition-all"
                  title="Edit meal"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDeleteMeal(selectedMeal.id)}
                  className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                  title="Delete meal"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => setSelectedMeal(null)} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors ml-1 sm:ml-2">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto overflow-x-hidden p-5 sm:p-8 pb-28 sm:pb-8 flex-1">
              {!selectedMeal.items ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-3xl border border-indigo-100 dark:border-indigo-800">
                      <span className="text-[10px] uppercase font-bold text-indigo-500 block mb-1">Total Calories</span>
                      <span className="text-4xl sm:text-3xl font-black text-indigo-700 dark:text-indigo-400">{selectedMeal.total_calories} kcal</span>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-3xl border border-emerald-100 dark:border-emerald-800">
                      <span className="text-[10px] uppercase font-bold text-emerald-500 block mb-1">Total Protein</span>
                      <span className="text-4xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400">{Math.round(selectedMeal.total_protein)}g</span>
                    </div>
                  </div>

                  {selectedMeal.description && (
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-2">Description / Notes</span>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed italic">
                        "{selectedMeal.description}"
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest ml-1">Breakdown</h3>
                    {selectedMeal.items.map((item, idx) => (
                      <div key={idx} className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-900 dark:text-white">{item.display_name || item.name}</span>
                            <span className="text-xs text-zinc-500">
                              Qty: {Number.isFinite(item.quantity) ? item.quantity : 1} {item.unit || 'serving'}
                            </span>
                          </div>
                          <span className="text-sm font-bold bg-white dark:bg-zinc-800 px-3 py-1 rounded-full border border-zinc-100 dark:border-zinc-700 shadow-sm">
                            {item.calories} kcal
                          </span>
                        </div>
                        {item.rationale && (
                          <p className="text-[11px] text-zinc-400 italic bg-white dark:bg-zinc-900/50 p-2 rounded-lg leading-relaxed">
                            &ldquo;{item.rationale}&rdquo;
                          </p>
                        )}
                        <div className="grid grid-cols-5 gap-2 sm:gap-4 mt-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">P</span>
                            <span className="text-sm font-black text-zinc-800 dark:text-zinc-200">{item.protein}g</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Fib</span>
                            <span className="text-sm font-black text-zinc-800 dark:text-zinc-200">{item.fiber}g</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">C</span>
                            <span className="text-sm font-black text-zinc-800 dark:text-zinc-200">{item.carbs}g</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">F</span>
                            <span className="text-sm font-black text-zinc-800 dark:text-zinc-200">{item.fats_total}g</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">S</span>
                            <span className="text-sm font-black text-zinc-800 dark:text-zinc-200">{item.sugars_total}g</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isEditing && selectedMeal && selectedMeal.items && (
        <EditMealModal
          meal={selectedMeal}
          items={selectedMeal.items}
          onClose={() => setIsEditing(false)}
          onSave={() => {
            fetchData();
            if (selectedMeal) {
              fetchMealDetails(selectedMeal);
            }
          }}
        />
      )}

      {pendingDelete && (
        <div className="fixed bottom-24 sm:bottom-5 left-1/2 -translate-x-1/2 z-[90] bg-zinc-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-zinc-700 flex items-center gap-4 w-[calc(100%-1.5rem)] sm:w-auto">
          <span className="text-xs font-bold">
            Deleted "{pendingDelete.name || 'meal'}". Undo in {undoSecondsLeft}s
          </span>
          <button
            onClick={undoDelete}
            className="px-3 py-1.5 rounded-lg bg-white text-zinc-900 text-xs font-black uppercase tracking-widest"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
