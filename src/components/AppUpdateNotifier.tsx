'use client';

import { RefreshCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface VersionPayload {
  version?: string;
  builtAt?: string;
}

export default function AppUpdateNotifier() {
  const currentVersionRef = useRef<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as VersionPayload;
        const nextVersion = (data.version || '').trim();
        if (!nextVersion) return;

        if (!currentVersionRef.current) {
          currentVersionRef.current = nextVersion;
          return;
        }

        if (nextVersion !== currentVersionRef.current && isMounted) {
          setLatestVersion(nextVersion);
        }
      } catch {
        // Silent: polling should never break app UI.
      }
    };

    void checkVersion();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkVersion();
      }
    }, 60000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!latestVersion) return null;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-24 sm:bottom-6 z-[95] w-[calc(100%-1.5rem)] sm:w-auto sm:min-w-[380px]">
      <div className="rounded-2xl border border-indigo-300/40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex flex-col">
          <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">New update available</p>
          <p className="text-xs text-zinc-500">A newer app version was deployed. Refresh to update now.</p>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={() => setLatestVersion(null)}
            className="h-10 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-bold"
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-10 px-4 rounded-xl bg-indigo-600 text-white text-sm font-black flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
