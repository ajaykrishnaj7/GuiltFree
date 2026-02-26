'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import { BarChart3, TrendingUp, Calendar, Loader2 } from 'lucide-react';
import { loadAISettings } from '@/lib/aiSettings';

interface DailyStats {
  date: string;
  calories: number;
  protein: number;
  fiber: number;
  carbs: number;
  fats: number;
  sugars: number;
}

interface GoalProfile {
  daily_calorie_goal: number | null;
  daily_protein_goal_g: number | null;
  daily_carbs_goal_g: number | null;
  daily_fats_goal_g: number | null;
  daily_fiber_goal_g: number | null;
  daily_sugars_total_goal_g: number | null;
  goal_focus: string | null;
}

interface DailySuggestion {
  title: string;
  message: string;
  goal_impact: string;
  action_plan: string[];
  foods_to_add: string[];
  foods_to_limit: string[];
}

export default function NutritionTrends() {
  const { user, session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [allMeals, setAllMeals] = useState<any[]>([]);
  const [goals, setGoals] = useState<GoalProfile | null>(null);
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly'>('weekly');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dailySuggestion, setDailySuggestion] = useState<DailySuggestion | null>(null);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [suggestionNotice, setSuggestionNotice] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const getFriendlyFallbackReason = (details?: string) => {
    if (!details) return 'AI unavailable';
    const lower = details.toLowerCase();
    if (lower.includes('missing api key')) return 'missing API key';
    if (lower.includes('quota') || lower.includes('rate limit')) return 'quota or rate limit reached';
    if (
      lower.includes('invalid api key') ||
      lower.includes('api key not valid') ||
      lower.includes('not valid') ||
      lower.includes('permission denied')
    ) return 'invalid API key';
    if (lower.includes('model') && lower.includes('not found')) return 'selected model is unavailable';
    if (lower.includes('unsupported location') || lower.includes('location')) return 'provider/location restriction';
    if (lower.includes('unexpected token') || lower.includes('json')) return 'AI returned malformed response';
    if (lower.includes('fetch failed') || lower.includes('enotfound') || lower.includes('network')) return 'network/provider connectivity issue';
    return 'provider temporarily unavailable';
  };

  const toPushServerKey = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;
    setPushEnabled(window.localStorage.getItem(`guiltfree.push-enabled.${user.id}`) === '1');
  }, [user]);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [mealsRes, profileRes] = await Promise.all([
      supabase
        .from('meals')
        .select('id, name, type, created_at, total_calories, total_protein, total_fiber, total_carbs, total_fats, total_sugars_total')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true }),
      supabase
        .from('profiles')
        .select('daily_calorie_goal, daily_protein_goal_g, daily_carbs_goal_g, daily_fats_goal_g, daily_fiber_goal_g, daily_sugars_total_goal_g, goal_focus')
        .eq('id', user.id)
        .single()
    ]);

    if (profileRes.data) {
      setGoals(profileRes.data as GoalProfile);
    }

    if (mealsRes.data) {
      const grouped = mealsRes.data.reduce((acc: any, meal: any) => {
        const date = new Date(meal.created_at).toLocaleDateString();
        if (!acc[date]) {
          acc[date] = { date, calories: 0, protein: 0, fiber: 0, carbs: 0, fats: 0, sugars: 0 };
        }
        acc[date].calories += meal.total_calories || 0;
        acc[date].protein += meal.total_protein || 0;
        acc[date].fiber += meal.total_fiber || 0;
        acc[date].carbs += meal.total_carbs || 0;
        acc[date].fats += meal.total_fats || 0;
        acc[date].sugars += meal.total_sugars_total || 0;
        return acc;
      }, {});

      const statsArray = Object.values(grouped) as DailyStats[];
      setStats(statsArray);
      setAllMeals(mealsRes.data);
      if (statsArray.length > 0) {
        const today = new Date().toLocaleDateString();
        const hasToday = statsArray.some((entry) => entry.date === today);
        setSelectedDate(hasToday ? today : statsArray[statsArray.length - 1].date);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      void fetchStats();
      return;
    }
    if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading, fetchStats]);

  const selectedDayData = stats.find(s => s.date === selectedDate);
  const todayDateLabel = new Date().toLocaleDateString();
  const suggestionDateLabel = selectedDate || todayDateLabel;
  const suggestionDayData = stats.find(s => s.date === suggestionDateLabel) || null;
  const visibleStats = useMemo(
    () => stats.slice(timeframe === 'weekly' ? -7 : -30),
    [stats, timeframe]
  );

  useEffect(() => {
    const viewport = timelineRef.current;
    if (!viewport || typeof viewport.scrollTo !== 'function') return;
    const id = window.requestAnimationFrame(() => {
      viewport.scrollTo({ left: viewport.scrollWidth, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [timeframe, visibleStats.length]);

  const generateDailySuggestion = async (notify = false) => {
    if (!user || !goals || !suggestionDayData) return;
    setIsSuggestionLoading(true);
    setSuggestionNotice(null);
    try {
      const aiSettings = loadAISettings(user.id);
      const res = await fetch('/api/day-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date(suggestionDateLabel).toLocaleDateString('en-CA'),
          totals: suggestionDayData,
          goals: {
            calories: goals.daily_calorie_goal ?? 2000,
            protein: goals.daily_protein_goal_g ?? 150,
            carbs: goals.daily_carbs_goal_g ?? 225,
            fats: goals.daily_fats_goal_g ?? 65,
            fiber: goals.daily_fiber_goal_g ?? 30,
            sugars: goals.daily_sugars_total_goal_g ?? 50,
          },
          goalContext: {
            focus: goals.goal_focus ?? 'maintain_weight',
          },
          aiConfig: aiSettings.useUserKey ? aiSettings : { useUserKey: false, provider: 'gemini', model: 'gemini-1.5-flash', apiKey: '' },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSuggestionNotice(data.error || data.details || 'Could not generate AI suggestion right now.');
        return;
      }
      setDailySuggestion({
        title: data.title,
        message: data.message,
        goal_impact: data.goal_impact || '',
        action_plan: Array.isArray(data.action_plan) ? data.action_plan : [],
        foods_to_add: Array.isArray(data.foods_to_add) ? data.foods_to_add : [],
        foods_to_limit: Array.isArray(data.foods_to_limit) ? data.foods_to_limit : [],
      });
      if (data.source === 'fallback') {
        const reason = getFriendlyFallbackReason(data.details);
        const nextAvailableText = data.next_available_at
          ? ` Next available: ${new Date(data.next_available_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
          : '';
        const detailText = typeof data.details === 'string' && data.details.trim().length > 0
          ? ` Details: ${data.details}`
          : '';
        setSuggestionNotice(`Using local fallback suggestion (${reason}).${nextAvailableText}${detailText}`);
      }

      if (notify && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(data.title, { body: data.message });
      }
    } catch (error) {
      console.error('Daily suggestion error', error);
    } finally {
      setIsSuggestionLoading(false);
    }
  };

  const dispatchPushSuggestion = useCallback(async () => {
    if (!session?.access_token || !user) return;
    try {
      const aiSettings = loadAISettings(user.id);
      const res = await fetch('/api/push/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          aiConfig: aiSettings.useUserKey ? aiSettings : { useUserKey: false, provider: 'gemini', model: 'gemini-1.5-flash', apiKey: '' },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || 'Push dispatch failed');
      setDailySuggestion({
        title: data.title,
        message: data.message,
        goal_impact: data.goal_impact || '',
        action_plan: Array.isArray(data.action_plan) ? data.action_plan : [],
        foods_to_add: Array.isArray(data.foods_to_add) ? data.foods_to_add : [],
        foods_to_limit: Array.isArray(data.foods_to_limit) ? data.foods_to_limit : [],
      });
    } catch (error) {
      console.error('Push dispatch error', error);
    }
  }, [session, user]);

  const subscribeToPush = async () => {
    if (typeof window === 'undefined' || !session?.access_token || !user) return false;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      console.error('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY');
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.register('/sw.js');
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toPushServerKey(publicKey),
    });

    const saveRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    if (!saveRes.ok) {
      await subscription.unsubscribe();
      return false;
    }

    window.localStorage.setItem(`guiltfree.push-enabled.${user.id}`, '1');
    return true;
  };

  const unsubscribeFromPush = async () => {
    if (typeof window === 'undefined' || !session?.access_token || !user) return;
    if (!('serviceWorker' in navigator)) return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    await subscription.unsubscribe();
    window.localStorage.setItem(`guiltfree.push-enabled.${user.id}`, '0');
  };

  useEffect(() => {
    if (!pushEnabled || !user) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const now = new Date();
    const target = new Date();
    target.setHours(21, 0, 0, 0);
    const lastSentKey = `guiltfree.push-last-sent.${user.id}`;
    const todayKey = new Date().toLocaleDateString('en-CA');
    const trigger = () => {
      if (window.localStorage.getItem(lastSentKey) === todayKey) return;
      void dispatchPushSuggestion();
      window.localStorage.setItem(lastSentKey, todayKey);
    };

    if (now >= target) {
      trigger();
      return;
    }

    const timeout = window.setTimeout(trigger, target.getTime() - now.getTime());
    return () => window.clearTimeout(timeout);
  }, [pushEnabled, user, dispatchPushSuggestion]);

  const getAverages = (period: number) => {
    const periodStats = stats.slice(-period);
    if (periodStats.length === 0) return { calories: 0, protein: 0, fiber: 0, carbs: 0, fats: 0, sugars: 0 };

    const total = periodStats.reduce((acc, s) => ({
      calories: acc.calories + s.calories,
      protein: acc.protein + s.protein,
      fiber: acc.fiber + s.fiber,
      carbs: acc.carbs + s.carbs,
      fats: acc.fats + s.fats,
      sugars: acc.sugars + s.sugars,
    }), { calories: 0, protein: 0, fiber: 0, carbs: 0, fats: 0, sugars: 0 });

    return {
      calories: Math.round(total.calories / periodStats.length),
      protein: Math.round(total.protein / periodStats.length),
      fiber: Math.round(total.fiber / periodStats.length),
      carbs: Math.round(total.carbs / periodStats.length),
      fats: Math.round(total.fats / periodStats.length),
      sugars: Math.round(total.sugars / periodStats.length),
    };
  };

  const getGoalPercentage = (value: number, goal?: number | null) => {
    if (!goal || goal <= 0) return null;
    return Math.round((value / goal) * 100);
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border border-zinc-200 dark:border-zinc-800 px-6">
        <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-6 h-6 text-zinc-400" />
        </div>
        <h3 className="text-lg font-bold mb-2">Your trends dashboard is waiting</h3>
        <p className="text-zinc-500 text-sm max-w-xs mx-auto mb-6">
          Sign in to unlock weekly and monthly macro averages, timeline insights, and end-of-day AI suggestions.
        </p>
      </div>
    );
  }

  const weeklyAvg = getAverages(7);
  const monthlyAvg = getAverages(30);

  return (
    <div className="flex flex-col gap-6 pb-20 min-h-[60vh]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Weekly Summary */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
              <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="font-bold text-lg">Weekly Average</h3>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black">{weeklyAvg.calories}</span>
              <span className="text-zinc-500 text-sm font-bold pb-1 uppercase tracking-tighter">kcal / day</span>
            </div>
            <span className="text-sm sm:text-xs font-bold text-zinc-500 uppercase tracking-widest">
              Goal Reach: {getGoalPercentage(weeklyAvg.calories, goals?.daily_calorie_goal) ?? '—'}%
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-zinc-600 dark:text-zinc-400">
              <div className="flex flex-col">
                <span className="text-sm sm:text-[10px] uppercase font-bold tracking-widest opacity-60">P</span>
                <span className="font-bold text-base sm:text-sm">{weeklyAvg.protein}g</span>
                <span className="text-sm sm:text-xs uppercase font-semibold opacity-70">{getGoalPercentage(weeklyAvg.protein, goals?.daily_protein_goal_g) ?? '—'}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm sm:text-[10px] uppercase font-bold tracking-widest opacity-60">Fib</span>
                <span className="font-bold text-base sm:text-sm">{weeklyAvg.fiber}g</span>
                <span className="text-sm sm:text-xs uppercase font-semibold opacity-70">{getGoalPercentage(weeklyAvg.fiber, goals?.daily_fiber_goal_g) ?? '—'}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm sm:text-[10px] uppercase font-bold tracking-widest opacity-60">C</span>
                <span className="font-bold text-base sm:text-sm">{weeklyAvg.carbs}g</span>
                <span className="text-sm sm:text-xs uppercase font-semibold opacity-70">{getGoalPercentage(weeklyAvg.carbs, goals?.daily_carbs_goal_g) ?? '—'}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm sm:text-[10px] uppercase font-bold tracking-widest opacity-60">F</span>
                <span className="font-bold text-base sm:text-sm">{weeklyAvg.fats}g</span>
                <span className="text-sm sm:text-xs uppercase font-semibold opacity-70">{getGoalPercentage(weeklyAvg.fats, goals?.daily_fats_goal_g) ?? '—'}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm sm:text-[10px] uppercase font-bold tracking-widest opacity-60">S</span>
                <span className="font-bold text-base sm:text-sm">{weeklyAvg.sugars}g</span>
                <span className="text-sm sm:text-xs uppercase font-semibold opacity-70">{getGoalPercentage(weeklyAvg.sugars, goals?.daily_sugars_total_goal_g) ?? '—'}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Summary */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
              <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="font-bold text-lg">Monthly Average</h3>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black">{monthlyAvg.calories}</span>
              <span className="text-zinc-500 text-sm font-bold pb-1 uppercase tracking-tighter">kcal / day</span>
            </div>
            <span className="text-sm sm:text-xs font-bold text-zinc-500 uppercase tracking-widest">
              Goal Reach: {getGoalPercentage(monthlyAvg.calories, goals?.daily_calorie_goal) ?? '—'}%
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-zinc-600 dark:text-zinc-400">
              <div className="flex flex-col">
                <span className="text-sm sm:text-[10px] uppercase font-bold tracking-widest opacity-60">P</span>
                <span className="font-bold text-base sm:text-sm">{monthlyAvg.protein}g</span>
                <span className="text-sm sm:text-xs uppercase font-semibold opacity-70">{getGoalPercentage(monthlyAvg.protein, goals?.daily_protein_goal_g) ?? '—'}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm sm:text-[10px] uppercase font-bold tracking-widest opacity-60">Fib</span>
                <span className="font-bold text-base sm:text-sm">{monthlyAvg.fiber}g</span>
                <span className="text-sm sm:text-xs uppercase font-semibold opacity-70">{getGoalPercentage(monthlyAvg.fiber, goals?.daily_fiber_goal_g) ?? '—'}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm sm:text-[10px] uppercase font-bold tracking-widest opacity-60">C</span>
                <span className="font-bold text-base sm:text-sm">{monthlyAvg.carbs}g</span>
                <span className="text-sm sm:text-xs uppercase font-semibold opacity-70">{getGoalPercentage(monthlyAvg.carbs, goals?.daily_carbs_goal_g) ?? '—'}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm sm:text-[10px] uppercase font-bold tracking-widest opacity-60">F</span>
                <span className="font-bold text-base sm:text-sm">{monthlyAvg.fats}g</span>
                <span className="text-sm sm:text-xs uppercase font-semibold opacity-70">{getGoalPercentage(monthlyAvg.fats, goals?.daily_fats_goal_g) ?? '—'}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm sm:text-[10px] uppercase font-bold tracking-widest opacity-60">S</span>
                <span className="font-bold text-base sm:text-sm">{monthlyAvg.sugars}g</span>
                <span className="text-sm sm:text-xs uppercase font-semibold opacity-70">{getGoalPercentage(monthlyAvg.sugars, goals?.daily_sugars_total_goal_g) ?? '—'}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Progress Chart (iOS Style) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-4 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-bold text-xl flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            Timeline
          </h3>
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button 
              onClick={() => setTimeframe('weekly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${timeframe === 'weekly' ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-zinc-500'}`}
            >
              7D
            </button>
            <button 
              onClick={() => setTimeframe('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${timeframe === 'monthly' ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-zinc-500'}`}
            >
              30D
            </button>
          </div>
        </div>

        <div ref={timelineRef} className="overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
          <div className="flex items-end h-48 gap-4 min-w-max pb-2">
            {visibleStats.map((day, i) => {
              const maxMacro = Math.max(...stats.map(s => Math.max(s.protein, s.carbs, s.fats)), 100);
              const isActive = selectedDate === day.date;
              
              return (
                <div 
                  key={i} 
                  className={`flex flex-col items-center gap-3 flex-shrink-0 transition-all duration-300 ${isActive ? 'scale-105' : 'opacity-80 hover:opacity-100'}`}
                >
                  <div className="flex items-end gap-1 h-36 px-2">
                    {/* Protein Bar */}
                    <div className="group/bar relative flex flex-col items-center h-full w-5">
                      <div 
                        className="w-2.5 sm:w-3 bg-indigo-50 dark:bg-zinc-800 rounded-full h-full absolute top-0"
                      />
                      <div 
                        className="w-2.5 sm:w-3 bg-indigo-500 rounded-full transition-all duration-700 relative shadow-sm group-hover/bar:bg-indigo-400"
                        style={{ height: `${Math.max(12, (day.protein / maxMacro) * 100)}%` }}
                      >
                         <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] py-1.5 px-2.5 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-all pointer-events-none whitespace-nowrap z-20 font-black shadow-xl">
                            P: {Math.round(day.protein)}g
                         </div>
                      </div>
                    </div>

                    {/* Carbs Bar */}
                    <div className="group/bar relative flex flex-col items-center h-full w-5">
                      <div 
                        className="w-2.5 sm:w-3 bg-emerald-50 dark:bg-zinc-800 rounded-full h-full absolute top-0"
                      />
                      <div 
                        className="w-2.5 sm:w-3 bg-emerald-500 rounded-full transition-all duration-700 relative shadow-sm group-hover/bar:bg-emerald-400"
                        style={{ height: `${Math.max(12, (day.carbs / maxMacro) * 100)}%` }}
                      >
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] py-1.5 px-2.5 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-all pointer-events-none whitespace-nowrap z-20 font-black shadow-xl">
                            C: {Math.round(day.carbs)}g
                         </div>
                      </div>
                    </div>

                    {/* Fats Bar */}
                    <div className="group/bar relative flex flex-col items-center h-full w-5">
                      <div 
                        className="w-2.5 sm:w-3 bg-amber-50 dark:bg-zinc-800 rounded-full h-full absolute top-0"
                      />
                      <div 
                        className="w-2.5 sm:w-3 bg-amber-500 rounded-full transition-all duration-700 relative shadow-sm group-hover/bar:bg-amber-400"
                        style={{ height: `${Math.max(12, (day.fats / maxMacro) * 100)}%` }}
                      >
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] py-1.5 px-2.5 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-all pointer-events-none whitespace-nowrap z-20 font-black shadow-xl">
                            F: {Math.round(day.fats)}g
                         </div>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setSelectedDate(day.date)}
                    className="flex flex-col items-center gap-1 group/btn min-h-[44px] min-w-[44px]"
                  >
                    <span className={`text-sm sm:text-[10px] font-black uppercase tracking-tight ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 group-hover/btn:text-zinc-600'}`}>
                      {new Date(day.date).toLocaleDateString([], { weekday: 'short' })}
                    </span>
                    <span className={`text-sm sm:text-[9px] font-bold ${isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
                      {day.calories}
                    </span>
                    {isActive && <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-1" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Detail Card */}
        {selectedDayData && (
          <div className="mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-800 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex flex-col">
                <span className="text-sm sm:text-[10px] text-zinc-400 uppercase font-black tracking-widest">Detail View</span>
                <h4 className="text-2xl font-black">
                  {new Date(selectedDayData.date).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                </h4>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{selectedDayData.calories}</span>
                <span className="text-sm sm:text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">Total Calories</span>
                <span className="text-sm sm:text-xs text-zinc-500 font-bold uppercase tracking-tighter">
                  {getGoalPercentage(selectedDayData.calories, goals?.daily_calorie_goal) ?? '—'}% of goal
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
               <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-3xl border border-indigo-100 dark:border-indigo-900/50">
                 <span className="text-sm sm:text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-bold tracking-widest block mb-1 text-center">Protein</span>
                 <div className="text-xl font-black text-center text-indigo-700 dark:text-indigo-300">{selectedDayData.protein.toFixed(1)}g</div>
                 <div className="text-sm sm:text-xs text-center text-indigo-500 font-bold mt-1">{getGoalPercentage(selectedDayData.protein, goals?.daily_protein_goal_g) ?? '—'}%</div>
               </div>
               <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-3xl border border-emerald-100 dark:border-emerald-900/50">
                 <span className="text-sm sm:text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-widest block mb-1 text-center">Fiber</span>
                 <div className="text-xl font-black text-center text-emerald-700 dark:text-emerald-300">{selectedDayData.fiber.toFixed(1)}g</div>
                 <div className="text-sm sm:text-xs text-center text-emerald-500 font-bold mt-1">{getGoalPercentage(selectedDayData.fiber, goals?.daily_fiber_goal_g) ?? '—'}%</div>
               </div>
               <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-3xl border border-amber-100 dark:border-amber-900/50">
                 <span className="text-sm sm:text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold tracking-widest block mb-1 text-center">Carbs</span>
                 <div className="text-xl font-black text-center text-amber-700 dark:text-amber-300">{selectedDayData.carbs.toFixed(1)}g</div>
                 <div className="text-sm sm:text-xs text-center text-amber-500 font-bold mt-1">{getGoalPercentage(selectedDayData.carbs, goals?.daily_carbs_goal_g) ?? '—'}%</div>
               </div>
               <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-3xl border border-orange-100 dark:border-orange-900/50">
                 <span className="text-sm sm:text-[10px] text-orange-600 dark:text-orange-400 uppercase font-bold tracking-widest block mb-1 text-center">Fats</span>
                 <div className="text-xl font-black text-center text-orange-700 dark:text-orange-300">{selectedDayData.fats.toFixed(1)}g</div>
                 <div className="text-sm sm:text-xs text-center text-orange-500 font-bold mt-1">{getGoalPercentage(selectedDayData.fats, goals?.daily_fats_goal_g) ?? '—'}%</div>
               </div>
               <div className="bg-pink-50 dark:bg-pink-950/20 p-4 rounded-3xl border border-pink-100 dark:border-pink-900/50">
                 <span className="text-sm sm:text-[10px] text-pink-600 dark:text-pink-400 uppercase font-bold tracking-widest block mb-1 text-center">Sugars</span>
                 <div className="text-xl font-black text-center text-pink-700 dark:text-pink-300">{selectedDayData.sugars.toFixed(1)}g</div>
                 <div className="text-sm sm:text-xs text-center text-pink-500 font-bold mt-1">{getGoalPercentage(selectedDayData.sugars, goals?.daily_sugars_total_goal_g) ?? '—'}%</div>
               </div>
            </div>

            <div className="mt-10 flex flex-col gap-4">
              <span className="text-xs sm:text-[10px] text-zinc-400 uppercase font-black tracking-widest pl-1">Meals Breakdown</span>
              <div className="flex flex-col gap-3">
                {allMeals
                  .filter(m => new Date(m.created_at).toLocaleDateString() === selectedDate)
                  .map((meal, idx) => (
                    <div key={idx} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-5 rounded-[2rem] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-[11px] font-black uppercase tracking-widest rounded-full text-zinc-500">{meal.type}</span>
                          <h5 className="text-lg font-black text-zinc-800 dark:text-zinc-200">{meal.name}</h5>
                        </div>
                        <div className="grid grid-cols-5 gap-2 sm:gap-6 mt-4">
                          <div className="flex flex-col"><span className="text-xs sm:text-[10px] text-indigo-500 uppercase font-black tracking-widest mb-1">P</span><span className="text-sm font-black text-zinc-900 dark:text-white">{meal.total_protein.toFixed(1)}g</span></div>
                          <div className="flex flex-col"><span className="text-xs sm:text-[10px] text-emerald-500 uppercase font-black tracking-widest mb-1">Fib</span><span className="text-sm font-black text-zinc-900 dark:text-white">{meal.total_fiber.toFixed(1)}g</span></div>
                          <div className="flex flex-col"><span className="text-xs sm:text-[10px] text-amber-500 uppercase font-black tracking-widest mb-1">C</span><span className="text-sm font-black text-zinc-900 dark:text-white">{meal.total_carbs.toFixed(1)}g</span></div>
                          <div className="flex flex-col"><span className="text-xs sm:text-[10px] text-orange-500 uppercase font-black tracking-widest mb-1">F</span><span className="text-sm font-black text-zinc-900 dark:text-white">{meal.total_fats.toFixed(1)}g</span></div>
                          <div className="flex flex-col"><span className="text-xs sm:text-[10px] text-pink-500 uppercase font-black tracking-widest mb-1">S</span><span className="text-sm font-black text-zinc-900 dark:text-white">{meal.total_sugars_total.toFixed(1)}g</span></div>
                        </div>
                      </div>
                      <div className="flex items-end flex-col gap-1">
                        <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 leading-none">{meal.total_calories}</span>
                        <span className="text-[11px] text-zinc-400 font-black uppercase tracking-widest">kcal</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-sm flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg">End-of-day AI Suggestion</h3>
            <p className="text-xs text-zinc-500">Uses selected day in detail view (defaults to today).</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void generateDailySuggestion(false)}
              disabled={isSuggestionLoading || !suggestionDayData}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 disabled:opacity-50"
            >
              {isSuggestionLoading ? 'Generating...' : 'Generate'}
            </button>
            <button
              onClick={async () => {
                if (!user) return;
                const next = !pushEnabled;
                if (next) {
                  const ok = await subscribeToPush();
                  if (ok) setPushEnabled(true);
                  return;
                }
                await unsubscribeFromPush();
                setPushEnabled(false);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold ${pushEnabled ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}
            >
              {pushEnabled ? 'Push: On' : 'Enable Push'}
            </button>
          </div>
        </div>
        {dailySuggestion ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-sm font-black mb-1">{dailySuggestion.title}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{dailySuggestion.message}</p>
            {dailySuggestion.goal_impact && (
              <div className="mt-2 rounded-xl border border-indigo-300/30 bg-indigo-500/10 p-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-1">Goal Impact</p>
                <p className="text-xs text-zinc-700 dark:text-zinc-200">{dailySuggestion.goal_impact}</p>
              </div>
            )}
            {dailySuggestion.action_plan.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Action Plan</p>
                <ul className="text-sm text-zinc-600 dark:text-zinc-300 list-disc pl-5 space-y-1">
                  {dailySuggestion.action_plan.map((step, idx) => <li key={`${step}-${idx}`}>{step}</li>)}
                </ul>
              </div>
            )}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {dailySuggestion.foods_to_add.length > 0 && (
                <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">Add More</p>
                  <p className="text-xs text-zinc-700 dark:text-zinc-200">{dailySuggestion.foods_to_add.join(', ')}</p>
                </div>
              )}
              {dailySuggestion.foods_to_limit.length > 0 && (
                <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-1">Limit</p>
                  <p className="text-xs text-zinc-700 dark:text-zinc-200">{dailySuggestion.foods_to_limit.join(', ')}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No suggestion yet.</p>
        )}
        {suggestionNotice && (
          <p className="text-xs text-amber-600 dark:text-amber-400">{suggestionNotice}</p>
        )}
      </div>
    </div>
  );
}
