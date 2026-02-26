'use client';

import NutritionTrends from "@/components/NutritionTrends";

export default function TrendsPage() {
  return (
    <div className="py-12 flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tight">Trends & Analytics</h1>
        <p className="text-zinc-500 font-medium">Weekly averages and long-term insights.</p>
      </header>
      <NutritionTrends />
    </div>
  );
}
