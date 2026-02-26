'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { User, Phone, Calendar, Ruler, UserCircle2, Mail, LogOut, Save, Loader2, Key, Zap, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { AIProvider, AISettings, DEFAULT_AI_SETTINGS, PROVIDER_MODELS, saveAISettings, loadAISettings } from '@/lib/aiSettings';
import Link from 'next/link';

const PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI (ChatGPT API)',
  anthropic: 'Anthropic (Claude)',
  groq: 'Groq',
  openrouter: 'OpenRouter (Free Router Last)',
};

const KEY_PLACEHOLDERS: Record<AIProvider, string> = {
  gemini: 'AIza...',
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
  groq: 'gsk_...',
  openrouter: 'sk-or-...',
};

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const draftHydratedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiSettingsError, setAISettingsError] = useState<string | null>(null);
  const [aiSettings, setAISettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [showPrimaryApiKey, setShowPrimaryApiKey] = useState(false);
  const [visibleProviderKeys, setVisibleProviderKeys] = useState<Partial<Record<AIProvider, boolean>>>({});
  const [profile, setProfile] = useState({
    full_name: '',
    phone: '',
    dob: '',
    weight: '',
    height: '',
    sex: ''
  });
  const draftScope = user?.id || 'anon';
  const draftStorageKey = `guiltfree.profile-page-draft.${draftScope}`;

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('full_name, phone, dob, weight, height, sex')
      .eq('id', user?.id)
      .single();

    if (data && !draftHydratedRef.current) {
      setProfile({
        full_name: data.full_name || '',
        phone: data.phone || '',
        dob: data.dob || '',
        weight: data.weight?.toString() || '',
        height: data.height?.toString() || '',
        sex: data.sex || ''
      });
    }
    setLoading(false);
  }, [user]);

  const hydrateAISettingsFromDB = useCallback(async () => {
    if (!user) return;
    try {
      setAISettingsError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/ai-settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data?.settings) {
        setAISettingsError(data?.error || 'Failed to load AI settings');
        return;
      }
      setAISettings(data.settings);
      saveAISettings(user.id, data.settings);
    } catch (error: unknown) {
      setAISettingsError(error instanceof Error ? error.message : 'Failed to load AI settings');
    }
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
        profile?: typeof profile;
      };
      if (parsed.profile) setProfile(parsed.profile);
      draftHydratedRef.current = true;
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (user) {
      void fetchProfile();
      if (!draftHydratedRef.current) {
        setAISettings(loadAISettings(user.id));
      }
      void hydrateAISettingsFromDB();
      return;
    }
    setLoading(false);
    setAISettings(DEFAULT_AI_SETTINGS);
    setProfile({
      full_name: '',
      phone: '',
      dob: '',
      weight: '',
      height: '',
      sex: ''
    });
  }, [user, fetchProfile, hydrateAISettingsFromDB]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = { profile };
    window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
  }, [draftStorageKey, profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
        dob: profile.dob || null,
        weight: parseFloat(profile.weight) || null,
        height: parseFloat(profile.height) || null,
        sex: profile.sex
      })
      .eq('id', user?.id);

    if (!error) {
      alert('Profile updated!');
    }
    setSaving(false);
  };

  const handleSaveAISettings = () => {
    if (!user) return;
    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Please sign in again.');

        const res = await fetch('/api/ai-settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ settings: aiSettings }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save AI settings');
        setAISettings(data.settings);
        saveAISettings(user.id, data.settings);
        setAISettingsError(null);
        alert('AI settings updated!');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to save AI settings';
        setAISettingsError(message);
        alert(message);
      }
    })();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-8 sm:py-12 px-4 pb-32 lg:pb-12">
        <div className="rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Your AI Nutrition Copilot</h1>
          <p className="mt-3 text-zinc-500 text-base sm:text-lg">
            Sign in to unlock secure profile settings, custom goals, BYOK AI, smart meal logging, and daily trend coaching.
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
              <Target className="w-5 h-5 text-indigo-500 mb-2" />
              <p className="font-bold">Goal Builder</p>
              <p className="text-sm text-zinc-500">Calorie + macro targets tailored to your goal focus.</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
              <Sparkles className="w-5 h-5 text-amber-500 mb-2" />
              <p className="font-bold">AI Suggestions</p>
              <p className="text-sm text-zinc-500">Actionable day-end advice based on goal reach.</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
              <ShieldCheck className="w-5 h-5 text-emerald-500 mb-2" />
              <p className="font-bold">BYOK Secure</p>
              <p className="text-sm text-zinc-500">Use your own API keys with encrypted storage.</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/" className="px-5 py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm">Go to Home</Link>
            <Link href="/goals" className="px-5 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 font-bold text-sm">Explore Goals</Link>
            <Link href="/trends" className="px-5 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 font-bold text-sm">Explore Trends</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-12 px-4 pb-32 lg:pb-12">
      <div className="flex flex-col gap-8">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Profile</h1>
          {user && (
            <button 
              onClick={() => signOut()}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all text-sm sm:text-base"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          )}
        </div>


        <form onSubmit={handleSave} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-5 sm:p-8 shadow-sm flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Account Email</label>
              <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-zinc-500">
                <Mail className="w-4 h-4" />
                <span className="font-medium">{user?.email}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="text" 
                  value={profile.full_name}
                  onChange={(e) => setProfile({...profile, full_name: e.target.value})}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="tel" 
                  value={profile.phone}
                  onChange={(e) => setProfile({...profile, phone: e.target.value})}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Date of Birth</label>
              <div className="relative w-full">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <input 
                  type="date" 
                  value={profile.dob}
                  onChange={(e) => setProfile({...profile, dob: e.target.value})}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold appearance-none min-h-[48px]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Weight (kg/lbs)</label>
              <div className="relative">
                <Zap className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="number" 
                  value={profile.weight}
                  step="0.1"
                  onChange={(e) => setProfile({...profile, weight: e.target.value})}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Height (cm/in)</label>
              <div className="relative">
                <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="number" 
                  value={profile.height}
                  step="0.1"
                  onChange={(e) => setProfile({...profile, height: e.target.value})}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Sex</label>
              <div className="relative">
                <UserCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <select 
                  value={profile.sex}
                  onChange={(e) => setProfile({...profile, sex: e.target.value})}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold appearance-none"
                >
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-4">
            <button 
              type="submit"
              disabled={saving}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Save className="w-5 h-5" /> Save Profile</>}
            </button>
            
            <button 
              type="button"
              className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
            >
              <Key className="w-4 h-4" />
              Reset Password
            </button>
          </div>
        </form>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-5 sm:p-8 shadow-sm flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black tracking-tight">AI Provider</h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Bring your own key</span>
          </div>
          {aiSettingsError && (
            <div className="rounded-xl border border-red-300/60 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300">
              {aiSettingsError}
            </div>
          )}

          <div className="flex items-center justify-between rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-zinc-900 dark:text-white">Use your API key</span>
              <span className="text-xs text-zinc-500">If disabled, app falls back to project key (Gemini only).</span>
            </div>
            <button
              type="button"
              onClick={() => setAISettings(prev => ({ ...prev, useUserKey: !prev.useUserKey }))}
              className={`h-8 w-14 rounded-full transition-colors ${aiSettings.useUserKey ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
              aria-label="Toggle user API key"
            >
              <span className={`block h-6 w-6 rounded-full bg-white transition-transform ${aiSettings.useUserKey ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Provider</label>
              <select
                value={aiSettings.provider}
                onChange={(e) => {
                  const provider = e.target.value as AIProvider;
                  setAISettings(prev => ({
                    ...prev,
                    provider,
                    model: PROVIDER_MODELS[provider][0],
                    apiKey: (prev.apiKeys?.[provider] || '').toString(),
                  }));
                }}
                className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold"
              >
                {Object.keys(PROVIDER_MODELS).map((providerKey) => {
                  const provider = providerKey as AIProvider;
                  return <option key={provider} value={provider}>{PROVIDER_LABELS[provider]}</option>;
                })}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">API Key</label>
            <div className="flex items-center gap-2">
              <input
                type={showPrimaryApiKey ? 'text' : 'password'}
                value={aiSettings.apiKey}
                onChange={(e) => setAISettings(prev => ({
                  ...prev,
                  apiKey: e.target.value,
                  apiKeys: {
                    ...(prev.apiKeys || {}),
                    [prev.provider]: e.target.value,
                  },
                }))}
                placeholder={KEY_PLACEHOLDERS[aiSettings.provider]}
                className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold"
              />
              <button
                type="button"
                onClick={() => setShowPrimaryApiKey((v) => !v)}
                className="px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-300 whitespace-nowrap"
              >
                {showPrimaryApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              Stored encrypted in your account settings. Required when &quot;Use your API key&quot; is enabled.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Multi-Provider Keys (Fallback Chain)</p>
            <p className="text-xs text-zinc-500">When BYOK is enabled, app tries your selected provider first, then your other saved keys (Gemini, OpenAI, Anthropic, Groq, OpenRouter free router last). If all your keys fail or hit limits, it falls back to system Gemini.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(Object.keys(PROVIDER_MODELS) as AIProvider[]).map((provider) => (
                <div key={provider} className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{PROVIDER_LABELS[provider]}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type={visibleProviderKeys[provider] ? 'text' : 'password'}
                      value={aiSettings.apiKeys?.[provider] || ''}
                      onChange={(e) => setAISettings((prev) => {
                        const nextApiKeys = {
                          ...(prev.apiKeys || {}),
                          [provider]: e.target.value,
                        };
                        return {
                          ...prev,
                          apiKeys: nextApiKeys,
                          apiKey: provider === prev.provider ? e.target.value : prev.apiKey,
                        };
                      })}
                      placeholder={KEY_PLACEHOLDERS[provider]}
                      className="w-full px-3 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-indigo-500 outline-none transition-all text-sm font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setVisibleProviderKeys((prev) => ({ ...prev, [provider]: !prev[provider] }))}
                      className="px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 whitespace-nowrap"
                    >
                      {visibleProviderKeys[provider] ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveAISettings}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" /> Save AI Settings
          </button>
        </div>
      </div>
    </div>
  );
}
