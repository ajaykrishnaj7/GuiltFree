'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Optionally trigger a session refresh if necessary
    supabase.auth.getSession().catch(console.error);

    // Start countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center animate-in fade-in zoom-in duration-500">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center text-green-600 dark:text-green-500">
            <CheckCircle2 className="w-8 h-8" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
          Email Confirmed!
        </h1>
        
        <p className="text-zinc-500 dark:text-zinc-400 mb-8">
          Thank you for verifying your email address.
        </p>

        <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl p-6 mb-8 border border-indigo-100 dark:border-indigo-500/20">
          <p className="text-indigo-600 dark:text-indigo-400 font-medium flex items-center justify-center gap-2">
            Redirecting to the app in <span className="text-2xl font-bold w-4">{countdown}</span> seconds...
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            If you are not redirected automatically, you can click the button below.
          </p>
          
          <button
            onClick={() => router.push('/')}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 group"
          >
            <span>Go to App Now</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
