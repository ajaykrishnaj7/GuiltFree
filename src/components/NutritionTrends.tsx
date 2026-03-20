'use client';

import { useCallback, useEffect, useState } from 'react';
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
  const [activityPeriod, setActivityPeriod] = useState<'D' | 'W' | 'M' | '3M' | '6M' | '9M' | 'Y'>('D');
  const [activitySelectedDate, setActivitySelectedDate] = useState<string | null>(null);
  const [dailySuggestion, setDailySuggestion] = useState<DailySuggestion | null>(null);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [suggestionNotice, setSuggestionNotice] = useState<string | null>(null);

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
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - 365);

    const [mealsRes, profileRes] = await Promise.all([
      supabase
        .from('meals')
        .select('id, name, type, created_at, total_calories, total_protein, total_fiber, total_carbs, total_fats, total_sugars_total')
        .eq('user_id', user.id)
        .gte('created_at', lookbackDate.toISOString())
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

  const buildActivityPeriodStats = (period: 'D' | 'W' | 'M' | '3M' | '6M' | '9M' | 'Y') => {
    const byDate = new Map(stats.map((entry) => [entry.date, entry]));
    const now = new Date();
    const days: DailyStats[] = [];

    const pushDay = (dateObj: Date) => {
      const key = dateObj.toLocaleDateString();
      const existing = byDate.get(key);
      days.push(existing || {
        date: key,
        calories: 0,
        protein: 0,
        fiber: 0,
        carbs: 0,
        fats: 0,
        sugars: 0,
      });
    };

    if (period === 'D') {
      pushDay(now);
      return days;
    }

    if (period === 'W') {
      const start = new Date(now);
      const dayOfWeek = start.getDay(); // Sun=0
      start.setDate(start.getDate() - dayOfWeek);
      for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
        pushDay(new Date(d));
      }
      return days;
    }

    if (period === 'M') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
        pushDay(new Date(d));
      }
      return days;
    }

    const lookbackDays = period === '3M' ? 90 : period === '6M' ? 180 : period === '9M' ? 270 : 365;
    const start = new Date(now);
    start.setDate(start.getDate() - (lookbackDays - 1));
    for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
      pushDay(new Date(d));
    }
    return days;
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
  const activityStats = buildActivityPeriodStats(activityPeriod);
  const activityAverages = activityStats.length > 0
    ? activityStats.reduce((acc, day) => ({
      calories: acc.calories + day.calories,
      protein: acc.protein + day.protein,
      fiber: acc.fiber + day.fiber,
      carbs: acc.carbs + day.carbs,
      fats: acc.fats + day.fats,
      sugars: acc.sugars + day.sugars,
    }), { calories: 0, protein: 0, fiber: 0, carbs: 0, fats: 0, sugars: 0 })
    : { calories: 0, protein: 0, fiber: 0, carbs: 0, fats: 0, sugars: 0 };
  const activityAverageValues = {
    calories: activityStats.length > 0 ? activityAverages.calories / activityStats.length : 0,
    protein: activityStats.length > 0 ? activityAverages.protein / activityStats.length : 0,
    fiber: activityStats.length > 0 ? activityAverages.fiber / activityStats.length : 0,
    carbs: activityStats.length > 0 ? activityAverages.carbs / activityStats.length : 0,
    fats: activityStats.length > 0 ? activityAverages.fats / activityStats.length : 0,
    sugars: activityStats.length > 0 ? activityAverages.sugars / activityStats.length : 0,
  };
  const selectedActivityDay = activitySelectedDate
    ? activityStats.find((day) => day.date === activitySelectedDate) || null
    : null;
  const effectiveSelectedActivityDay = selectedActivityDay || (activityPeriod === 'D' ? (activityStats[activityStats.length - 1] ?? null) : null);
  const todayDateLabel = new Date().toLocaleDateString();
  const suggestionDateLabel = effectiveSelectedActivityDay?.date || todayDateLabel;
  const suggestionDayData = effectiveSelectedActivityDay || stats.find((s) => s.date === todayDateLabel) || null;
  const activityDisplay = effectiveSelectedActivityDay || activityAverageValues;
  const activityDisplayLabel = effectiveSelectedActivityDay
    ? new Date(effectiveSelectedActivityDay.date).toLocaleDateString([], { month: 'short', day: 'numeric' })
    : `${activityPeriod} average`;
  const maxProtein = Math.max(...activityStats.map((d) => d.protein), goals?.daily_protein_goal_g ?? 1, 1);
  const maxFiber = Math.max(...activityStats.map((d) => d.fiber), goals?.daily_fiber_goal_g ?? 1, 1);
  const maxCarbs = Math.max(...activityStats.map((d) => d.carbs), goals?.daily_carbs_goal_g ?? 1, 1);
  const maxFats = Math.max(...activityStats.map((d) => d.fats), goals?.daily_fats_goal_g ?? 1, 1);
  const maxSugars = Math.max(...activityStats.map((d) => d.sugars), goals?.daily_sugars_total_goal_g ?? 1, 1);
  const useScrollableActivityBars = activityStats.length > 30;
  const activitySelectedMeals = effectiveSelectedActivityDay
    ? allMeals.filter((meal) => new Date(meal.created_at).toLocaleDateString() === effectiveSelectedActivityDay.date)
    : [];

  return (
    <div className="flex flex-col gap-6 pb-20 min-h-[60vh]">
      <div
        className="bg-zinc-950 text-white rounded-[2rem] p-4 sm:p-6 border border-zinc-800 shadow-xl order-2"
        onClick={() => setActivitySelectedDate(null)}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-xl sm:text-2xl font-black tracking-tight">Activity</h3>
          <div className="grid grid-cols-4 sm:flex items-center gap-1 bg-zinc-800 rounded-2xl p-1 w-full sm:w-auto max-w-full">
            {(['D', 'W', 'M', '3M', '6M', '9M', 'Y'] as const).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => {
                  setActivityPeriod(period);
                  setActivitySelectedDate(null);
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-black tracking-widest transition-all min-h-[36px] ${activityPeriod === period ? 'bg-zinc-300 text-zinc-900' : 'text-zinc-400 hover:text-zinc-100'}`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs uppercase font-black tracking-widest text-zinc-400">
            {effectiveSelectedActivityDay ? 'Selected Day' : 'Period Average'}: {activityDisplayLabel}
          </p>
          <button
            type="button"
            onClick={() => setActivitySelectedDate(null)}
            className="text-[11px] font-black text-zinc-300 hover:text-white uppercase tracking-widest"
          >
            Avg
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="text-[10px] uppercase tracking-widest font-black text-violet-300">Calories</p>
            <p className="text-2xl font-black">{Math.round(activityDisplay.calories || 0)} <span className="text-zinc-400 text-lg">kcal</span></p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="text-[10px] uppercase tracking-widest font-black text-indigo-300">Protein</p>
            <p className="text-2xl font-black">{Math.round(activityDisplay.protein || 0)} <span className="text-zinc-400 text-lg">g</span></p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="text-[10px] uppercase tracking-widest font-black text-emerald-300">Fiber</p>
            <p className="text-2xl font-black">{Math.round(activityDisplay.fiber || 0)} <span className="text-zinc-400 text-lg">g</span></p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="text-[10px] uppercase tracking-widest font-black text-amber-300">Carbs</p>
            <p className="text-2xl font-black">{Math.round(activityDisplay.carbs || 0)} <span className="text-zinc-400 text-lg">g</span></p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="text-[10px] uppercase tracking-widest font-black text-orange-300">Fats</p>
            <p className="text-2xl font-black">{Math.round(activityDisplay.fats || 0)} <span className="text-zinc-400 text-lg">g</span></p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="text-[10px] uppercase tracking-widest font-black text-pink-300">Sugars</p>
            <p className="text-2xl font-black">{Math.round(activityDisplay.sugars || 0)} <span className="text-zinc-400 text-lg">g</span></p>
          </div>
        </div>

        <div className="space-y-4">
          <div onClick={() => setActivitySelectedDate(null)}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-indigo-300 font-black">Protein</p>
              <p className="text-sm text-zinc-300">{Math.round(activityDisplay.protein || 0)} / {goals?.daily_protein_goal_g ?? 0}g</p>
            </div>
            <div className={`h-24 border border-zinc-800 rounded-xl p-2 ${useScrollableActivityBars ? 'overflow-x-auto' : ''}`}>
              <div className={`h-full flex items-end gap-1 ${useScrollableActivityBars ? 'min-w-max' : 'w-full'}`}>
              {activityStats.map((day, idx) => (
                <button
                  key={`pro-${idx}`}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActivitySelectedDate(day.date); }}
                  className={`${useScrollableActivityBars ? 'w-2.5 sm:w-3 shrink-0' : 'flex-1'} rounded-t-sm ${activitySelectedDate === day.date ? 'bg-indigo-400' : 'bg-indigo-300/80 hover:bg-indigo-300'}`}
                  style={{ height: `${Math.max(4, (day.protein / maxProtein) * 100)}%` }}
                />
              ))}
              </div>
            </div>
          </div>
          <div onClick={() => setActivitySelectedDate(null)}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-emerald-300 font-black">Fiber</p>
              <p className="text-sm text-zinc-300">{Math.round(activityDisplay.fiber || 0)} / {goals?.daily_fiber_goal_g ?? 0}g</p>
            </div>
            <div className={`h-24 border border-zinc-800 rounded-xl p-2 ${useScrollableActivityBars ? 'overflow-x-auto' : ''}`}>
              <div className={`h-full flex items-end gap-1 ${useScrollableActivityBars ? 'min-w-max' : 'w-full'}`}>
              {activityStats.map((day, idx) => (
                <button
                  key={`fib-${idx}`}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActivitySelectedDate(day.date); }}
                  className={`${useScrollableActivityBars ? 'w-2.5 sm:w-3 shrink-0' : 'flex-1'} rounded-t-sm ${activitySelectedDate === day.date ? 'bg-emerald-400' : 'bg-emerald-300/80 hover:bg-emerald-300'}`}
                  style={{ height: `${Math.max(4, (day.fiber / maxFiber) * 100)}%` }}
                />
              ))}
              </div>
            </div>
          </div>
          <div onClick={() => setActivitySelectedDate(null)}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-amber-300 font-black">Carbs</p>
              <p className="text-sm text-zinc-300">{Math.round(activityDisplay.carbs || 0)} / {goals?.daily_carbs_goal_g ?? 0}g</p>
            </div>
            <div className={`h-24 border border-zinc-800 rounded-xl p-2 ${useScrollableActivityBars ? 'overflow-x-auto' : ''}`}>
              <div className={`h-full flex items-end gap-1 ${useScrollableActivityBars ? 'min-w-max' : 'w-full'}`}>
              {activityStats.map((day, idx) => (
                <button
                  key={`carb-${idx}`}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActivitySelectedDate(day.date); }}
                  className={`${useScrollableActivityBars ? 'w-2.5 sm:w-3 shrink-0' : 'flex-1'} rounded-t-sm ${activitySelectedDate === day.date ? 'bg-amber-400' : 'bg-amber-300/80 hover:bg-amber-300'}`}
                  style={{ height: `${Math.max(4, (day.carbs / maxCarbs) * 100)}%` }}
                />
              ))}
              </div>
            </div>
          </div>
          <div onClick={() => setActivitySelectedDate(null)}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-orange-300 font-black">Fats</p>
              <p className="text-sm text-zinc-300">{Math.round(activityDisplay.fats || 0)} / {goals?.daily_fats_goal_g ?? 0}g</p>
            </div>
            <div className={`h-24 border border-zinc-800 rounded-xl p-2 ${useScrollableActivityBars ? 'overflow-x-auto' : ''}`}>
              <div className={`h-full flex items-end gap-1 ${useScrollableActivityBars ? 'min-w-max' : 'w-full'}`}>
              {activityStats.map((day, idx) => (
                <button
                  key={`fat-${idx}`}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActivitySelectedDate(day.date); }}
                  className={`${useScrollableActivityBars ? 'w-2.5 sm:w-3 shrink-0' : 'flex-1'} rounded-t-sm ${activitySelectedDate === day.date ? 'bg-orange-400' : 'bg-orange-300/80 hover:bg-orange-300'}`}
                  style={{ height: `${Math.max(4, (day.fats / maxFats) * 100)}%` }}
                />
              ))}
              </div>
            </div>
          </div>
          <div onClick={() => setActivitySelectedDate(null)}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-pink-300 font-black">Sugars</p>
              <p className="text-sm text-zinc-300">{Math.round(activityDisplay.sugars || 0)} / {goals?.daily_sugars_total_goal_g ?? 0}g</p>
            </div>
            <div className={`h-24 border border-zinc-800 rounded-xl p-2 ${useScrollableActivityBars ? 'overflow-x-auto' : ''}`}>
              <div className={`h-full flex items-end gap-1 ${useScrollableActivityBars ? 'min-w-max' : 'w-full'}`}>
              {activityStats.map((day, idx) => (
                <button
                  key={`sug-${idx}`}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActivitySelectedDate(day.date); }}
                  className={`${useScrollableActivityBars ? 'w-2.5 sm:w-3 shrink-0' : 'flex-1'} rounded-t-sm ${activitySelectedDate === day.date ? 'bg-pink-400' : 'bg-pink-300/80 hover:bg-pink-300'}`}
                  style={{ height: `${Math.max(4, (day.sugars / maxSugars) * 100)}%` }}
                />
              ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[10px] uppercase tracking-widest font-black text-zinc-400 mb-2">Meals Breakdown</p>
          {effectiveSelectedActivityDay ? (
            activitySelectedMeals.length > 0 ? (
              <div className="space-y-3">
                {activitySelectedMeals.map((meal, idx) => (
                  <div key={`${meal.id}-${idx}`} className="bg-zinc-950 border border-zinc-800 p-4 rounded-[1.5rem] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-1 bg-zinc-800 text-[10px] font-black uppercase tracking-widest rounded-full text-zinc-300">
                          {meal.type}
                        </span>
                        <h5 className="text-base font-black text-zinc-100">{meal.name}</h5>
                      </div>
                      <div className="grid grid-cols-5 gap-2 sm:gap-4 mt-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-indigo-300 uppercase font-black tracking-widest mb-1">P</span>
                          <span className="text-sm font-black text-zinc-100">{Number(meal.total_protein || 0).toFixed(1)}g</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-emerald-300 uppercase font-black tracking-widest mb-1">Fib</span>
                          <span className="text-sm font-black text-zinc-100">{Number(meal.total_fiber || 0).toFixed(1)}g</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-amber-300 uppercase font-black tracking-widest mb-1">C</span>
                          <span className="text-sm font-black text-zinc-100">{Number(meal.total_carbs || 0).toFixed(1)}g</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-orange-300 uppercase font-black tracking-widest mb-1">F</span>
                          <span className="text-sm font-black text-zinc-100">{Number(meal.total_fats || 0).toFixed(1)}g</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-pink-300 uppercase font-black tracking-widest mb-1">S</span>
                          <span className="text-sm font-black text-zinc-100">{Number(meal.total_sugars_total || 0).toFixed(1)}g</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-end flex-col gap-1">
                      <span className="text-2xl font-black text-violet-300 leading-none">{Math.round(Number(meal.total_calories || 0))}</span>
                      <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">kcal</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">No meals logged on this day.</p>
            )
          ) : (
            <p className="text-sm text-zinc-400">Tap any bar to see that day&apos;s meals. Tap outside bars to clear selection.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 order-1">
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

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-sm flex flex-col gap-4 order-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg">End-of-day AI Suggestion</h3>
            <p className="text-xs text-zinc-500">Uses selected day in Activity (defaults to today).</p>
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
