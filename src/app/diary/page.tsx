'use client';

import DiaryView from "@/components/DiaryView";

export default function DiaryPage() {
  return (
    <div className="py-12 flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tight">Your History</h1>
        <p className="text-zinc-500 font-medium">Full timeline of your nutritional journey.</p>
      </header>
      <DiaryView />
    </div>
  );
}
