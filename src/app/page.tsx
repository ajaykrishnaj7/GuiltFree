'use client';

import { useAuth } from '@/components/AuthProvider';
import MealLogger from '@/components/MealLogger';
import { Loader2, ChefHat, TrendingUp, History, Target, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-8 py-10 sm:py-14 px-4">
        <div className="text-center">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tighter mb-4 sm:mb-6">Track your food, <br/><span className="text-zinc-400">guilt-free.</span></h1>
          <p className="text-base sm:text-lg text-zinc-500 max-w-xl mx-auto font-medium">
            AI-powered nutrition logging built for fast mobile use. Scan labels, log dishes, track macro goals, and improve daily consistency.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}
              className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-black text-base"
            >
              Sign In / Sign Up To Start
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <Link href="/kitchen" className="group relative overflow-hidden bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 dark:from-emerald-500/10 dark:to-emerald-500/5 p-5 sm:p-8 rounded-3xl border border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-500 hover:-translate-y-2 active:translate-y-0 active:scale-[0.98] flex flex-col justify-between min-h-[220px] sm:min-h-[240px]">
            <ChefHat className="absolute -bottom-6 -right-6 w-48 h-48 text-emerald-500/5 dark:text-emerald-500/10 group-hover:text-emerald-500/10 dark:group-hover:text-emerald-500/20 transition-all duration-700 group-hover:scale-110 group-hover:-rotate-12" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30 flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-500">
                <ChefHat className="w-8 h-8" />
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white text-emerald-600 dark:text-emerald-400 transition-all duration-300">
                <ArrowRight className="w-6 h-6 transform -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
              </div>
            </div>
            
            <div className="relative z-10 mt-8">
              <h3 className="text-xl sm:text-3xl font-black text-emerald-950 dark:text-emerald-50 mb-2 tracking-tight">My Kitchen</h3>
              <p className="text-sm sm:text-base text-emerald-800/80 dark:text-emerald-200/80 font-medium leading-relaxed max-w-[85%]">Create personal recipes & magically log your favorite foods.</p>
            </div>
          </Link>

          <Link href="/trends" className="group relative overflow-hidden bg-gradient-to-br from-indigo-500/5 to-indigo-500/10 dark:from-indigo-500/10 dark:to-indigo-500/5 p-5 sm:p-8 rounded-3xl border border-indigo-500/20 hover:border-indigo-500/40 hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-500 hover:-translate-y-2 active:translate-y-0 active:scale-[0.98] flex flex-col justify-between min-h-[220px] sm:min-h-[240px]">
            <TrendingUp className="absolute -bottom-6 -right-6 w-48 h-48 text-indigo-500/5 dark:text-indigo-500/10 group-hover:text-indigo-500/10 dark:group-hover:text-indigo-500/20 transition-all duration-700 group-hover:scale-110 group-hover:-rotate-12" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-500">
                <TrendingUp className="w-8 h-8" />
              </div>
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white text-indigo-600 dark:text-indigo-400 transition-all duration-300">
                <ArrowRight className="w-6 h-6 transform -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
              </div>
            </div>
            
            <div className="relative z-10 mt-8">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-indigo-950 dark:text-indigo-50 mb-2 tracking-tight">Discover Trends</h3>
              <p className="text-sm sm:text-base text-indigo-800/80 dark:text-indigo-200/80 font-medium leading-relaxed max-w-[90%] sm:max-w-[85%]">Analyze your weekly progress and refine your nutrition.</p>
            </div>
          </Link>

          <Link href="/history" className="group relative overflow-hidden bg-gradient-to-br from-amber-500/5 to-amber-500/10 dark:from-amber-500/10 dark:to-amber-500/5 p-5 sm:p-8 rounded-3xl border border-amber-500/20 hover:border-amber-500/40 hover:shadow-2xl hover:shadow-amber-500/20 transition-all duration-500 hover:-translate-y-2 active:translate-y-0 active:scale-[0.98] flex flex-col justify-between min-h-[220px] sm:min-h-[240px]">
            <History className="absolute -bottom-6 -right-6 w-48 h-48 text-amber-500/5 dark:text-amber-500/10 group-hover:text-amber-500/10 dark:group-hover:text-amber-500/20 transition-all duration-700 group-hover:scale-110 group-hover:-rotate-12" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30 flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-500">
                <History className="w-8 h-8" />
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white text-amber-600 dark:text-amber-400 transition-all duration-300">
                <ArrowRight className="w-6 h-6 transform -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
              </div>
            </div>
            
            <div className="relative z-10 mt-8">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-amber-950 dark:text-amber-50 mb-2 tracking-tight">Review History</h3>
              <p className="text-sm sm:text-base text-amber-800/80 dark:text-amber-200/80 font-medium leading-relaxed max-w-[90%] sm:max-w-[85%]">Scroll through your diary and revisit your past meal logs.</p>
            </div>
          </Link>

          <Link href="/goals" className="group relative overflow-hidden bg-gradient-to-br from-pink-500/5 to-pink-500/10 dark:from-pink-500/10 dark:to-pink-500/5 p-5 sm:p-8 rounded-3xl border border-pink-500/20 hover:border-pink-500/40 hover:shadow-2xl hover:shadow-pink-500/20 transition-all duration-500 hover:-translate-y-2 active:translate-y-0 active:scale-[0.98] flex flex-col justify-between min-h-[220px] sm:min-h-[240px]">
            <Target className="absolute -bottom-6 -right-6 w-48 h-48 text-pink-500/5 dark:text-pink-500/10 group-hover:text-pink-500/10 dark:group-hover:text-pink-500/20 transition-all duration-700 group-hover:scale-110 group-hover:-rotate-12" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-400 to-pink-600 shadow-lg shadow-pink-500/30 flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-500">
                <Target className="w-8 h-8" />
              </div>
              <div className="w-12 h-12 rounded-full bg-pink-500/10 dark:bg-pink-500/20 flex items-center justify-center group-hover:bg-pink-500 group-hover:text-white text-pink-600 dark:text-pink-400 transition-all duration-300">
                <ArrowRight className="w-6 h-6 transform -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
              </div>
            </div>
            
            <div className="relative z-10 mt-8">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-pink-950 dark:text-pink-50 mb-2 tracking-tight">Set Goals</h3>
              <p className="text-sm sm:text-base text-pink-800/80 dark:text-pink-200/80 font-medium leading-relaxed max-w-[90%] sm:max-w-[85%]">Update your calorie and macro targets for a fresh start.</p>
            </div>
          </Link>
        </div>

        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 text-center">
          <p className="text-sm sm:text-base text-zinc-500">Your drafts can be prepared now and saved right after you sign in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pb-32">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black tracking-tight">Log Meal</h1>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">What did you eat today?</p>
        </div>
        <MealLogger />
      </div>

      <div className="flex flex-col gap-4 mt-4">
        <h2 className="text-xl font-bold tracking-tight">Explore</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <Link href="/kitchen" className="group relative overflow-hidden bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 dark:from-emerald-500/10 dark:to-emerald-500/5 p-5 sm:p-8 rounded-3xl border border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-500 hover:-translate-y-2 active:translate-y-0 active:scale-[0.98] flex flex-col justify-between min-h-[220px] sm:min-h-[240px]">
            <ChefHat className="absolute -bottom-6 -right-6 w-48 h-48 text-emerald-500/5 dark:text-emerald-500/10 group-hover:text-emerald-500/10 dark:group-hover:text-emerald-500/20 transition-all duration-700 group-hover:scale-110 group-hover:-rotate-12" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30 flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-500">
                <ChefHat className="w-8 h-8" />
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white text-emerald-600 dark:text-emerald-400 transition-all duration-300">
                <ArrowRight className="w-6 h-6 transform -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
              </div>
            </div>
            
            <div className="relative z-10 mt-8">
              <h3 className="text-xl sm:text-3xl font-black text-emerald-950 dark:text-emerald-50 mb-2 tracking-tight">My Kitchen</h3>
              <p className="text-sm sm:text-base text-emerald-800/80 dark:text-emerald-200/80 font-medium leading-relaxed max-w-[85%]">Create personal recipes & magically log your favorite foods.</p>
            </div>
          </Link>

          <Link href="/trends" className="group relative overflow-hidden bg-gradient-to-br from-indigo-500/5 to-indigo-500/10 dark:from-indigo-500/10 dark:to-indigo-500/5 p-5 sm:p-8 rounded-3xl border border-indigo-500/20 hover:border-indigo-500/40 hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-500 hover:-translate-y-2 active:translate-y-0 active:scale-[0.98] flex flex-col justify-between min-h-[220px] sm:min-h-[240px]">
            <TrendingUp className="absolute -bottom-6 -right-6 w-48 h-48 text-indigo-500/5 dark:text-indigo-500/10 group-hover:text-indigo-500/10 dark:group-hover:text-indigo-500/20 transition-all duration-700 group-hover:scale-110 group-hover:-rotate-12" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-500">
                <TrendingUp className="w-8 h-8" />
              </div>
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white text-indigo-600 dark:text-indigo-400 transition-all duration-300">
                <ArrowRight className="w-6 h-6 transform -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
              </div>
            </div>
            
            <div className="relative z-10 mt-8">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-indigo-950 dark:text-indigo-50 mb-2 tracking-tight">Discover Trends</h3>
              <p className="text-sm sm:text-base text-indigo-800/80 dark:text-indigo-200/80 font-medium leading-relaxed max-w-[90%] sm:max-w-[85%]">Analyze your weekly progress and refine your nutrition.</p>
            </div>
          </Link>

          <Link href="/history" className="group relative overflow-hidden bg-gradient-to-br from-amber-500/5 to-amber-500/10 dark:from-amber-500/10 dark:to-amber-500/5 p-5 sm:p-8 rounded-3xl border border-amber-500/20 hover:border-amber-500/40 hover:shadow-2xl hover:shadow-amber-500/20 transition-all duration-500 hover:-translate-y-2 active:translate-y-0 active:scale-[0.98] flex flex-col justify-between min-h-[220px] sm:min-h-[240px]">
            <History className="absolute -bottom-6 -right-6 w-48 h-48 text-amber-500/5 dark:text-amber-500/10 group-hover:text-amber-500/10 dark:group-hover:text-amber-500/20 transition-all duration-700 group-hover:scale-110 group-hover:-rotate-12" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30 flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-500">
                <History className="w-8 h-8" />
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white text-amber-600 dark:text-amber-400 transition-all duration-300">
                <ArrowRight className="w-6 h-6 transform -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
              </div>
            </div>
            
            <div className="relative z-10 mt-8">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-amber-950 dark:text-amber-50 mb-2 tracking-tight">Review History</h3>
              <p className="text-sm sm:text-base text-amber-800/80 dark:text-amber-200/80 font-medium leading-relaxed max-w-[90%] sm:max-w-[85%]">Scroll through your diary and revisit your past meal logs.</p>
            </div>
          </Link>

          <Link href="/goals" className="group relative overflow-hidden bg-gradient-to-br from-pink-500/5 to-pink-500/10 dark:from-pink-500/10 dark:to-pink-500/5 p-5 sm:p-8 rounded-3xl border border-pink-500/20 hover:border-pink-500/40 hover:shadow-2xl hover:shadow-pink-500/20 transition-all duration-500 hover:-translate-y-2 active:translate-y-0 active:scale-[0.98] flex flex-col justify-between min-h-[220px] sm:min-h-[240px]">
            <Target className="absolute -bottom-6 -right-6 w-48 h-48 text-pink-500/5 dark:text-pink-500/10 group-hover:text-pink-500/10 dark:group-hover:text-pink-500/20 transition-all duration-700 group-hover:scale-110 group-hover:-rotate-12" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-400 to-pink-600 shadow-lg shadow-pink-500/30 flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-500">
                <Target className="w-8 h-8" />
              </div>
              <div className="w-12 h-12 rounded-full bg-pink-500/10 dark:bg-pink-500/20 flex items-center justify-center group-hover:bg-pink-500 group-hover:text-white text-pink-600 dark:text-pink-400 transition-all duration-300">
                <ArrowRight className="w-6 h-6 transform -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
              </div>
            </div>
            
            <div className="relative z-10 mt-8">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-pink-950 dark:text-pink-50 mb-2 tracking-tight">Set Goals</h3>
              <p className="text-sm sm:text-base text-pink-800/80 dark:text-pink-200/80 font-medium leading-relaxed max-w-[90%] sm:max-w-[85%]">Update your calorie and macro targets for a fresh start.</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
