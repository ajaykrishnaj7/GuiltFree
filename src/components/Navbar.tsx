'use client';
import { useEffect, useState } from 'react';

import { useAuth } from './AuthProvider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AuthModal from './AuthModal';
import { LayoutDashboard, History, BarChart3, ChefHat, LogIn, User, Target } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export default function Navbar() {
  const { user, loading } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Home', icon: LayoutDashboard },
    { href: '/history', label: 'History', icon: History },
    { href: '/trends', label: 'Trends', icon: BarChart3 },
    { href: '/kitchen', label: 'Kitchen', icon: ChefHat },
    { href: '/goals', label: 'Goals', icon: Target },
    { href: '/profile', label: 'Profile', icon: User },
  ];
  useEffect(() => {
    const openAuth = () => setIsAuthOpen(true);
    window.addEventListener('open-auth-modal', openAuth as EventListener);
    return () => window.removeEventListener('open-auth-modal', openAuth as EventListener);
  }, []);

  return (
    <>
      <nav className="w-full flex items-center justify-between py-6 px-4 sm:px-0 gap-4">
        {/* Left Col: Logo */}
        <div className="flex-1 flex items-center">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-8 h-8 bg-zinc-950 dark:bg-white rounded-lg flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
              <span className="text-white dark:text-zinc-950 font-black text-lg">G</span>
            </div>
            <span className="text-xl font-black tracking-tighter">GuiltFree</span>
          </Link>
        </div>
        
        {/* Center Col: Desktop Navigation */}
        <div className="hidden lg:flex items-center justify-center gap-8 px-4">
          {navLinks.filter(l => ['Home', 'History', 'Trends', 'Kitchen', 'Goals'].includes(l.label)).map((link) => (
            <Link 
              key={link.href}
              href={link.href} 
              className={`text-[10px] uppercase font-black tracking-widest flex items-center gap-2 transition-all hover:translate-y-[-1px] ${
                pathname === link.href ? 'text-indigo-600' : 'text-zinc-400 hover:text-indigo-600'
              }`}
            >
              <link.icon className="w-3.5 h-3.5" />
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right Col: User Info & Actions */}
        <div className="flex-1 flex items-center justify-end gap-2 sm:gap-4">
          {!loading && (
            user ? (
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="hidden xl:flex flex-col items-end pr-2 border-r border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest leading-none">Account</span>
                  <span className="text-sm font-black text-zinc-900 dark:text-white truncate max-w-[100px]">{user.email?.split('@')[0]}</span>
                </div>
                
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <Link 
                    href="/kitchen"
                    className={`p-2.5 rounded-2xl transition-all active:scale-95 ${
                      pathname === '/kitchen' ? 'bg-amber-50 text-amber-500' : 'text-zinc-500 hover:bg-zinc-100 hover:text-amber-500'
                    }`}
                    title="The Kitchen"
                  >
                    <ChefHat className="w-5 h-5" />
                  </Link>
                  <Link 
                    href="/goals"
                    className={`p-2.5 rounded-2xl transition-all active:scale-95 ${
                      pathname === '/goals' ? 'bg-indigo-50 text-indigo-600' : 'text-zinc-500 hover:bg-zinc-100 hover:text-indigo-600'
                    }`}
                    title="Goals"
                  >
                    <Target className="w-5 h-5" />
                  </Link>
                  <Link 
                    href="/profile"
                    className={`p-2.5 rounded-2xl transition-all active:scale-95 ${
                      pathname === '/profile' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                    title="Profile"
                  >
                    <User className="w-5 h-5" />
                  </Link>
                  <ThemeToggle />
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsAuthOpen(true)}
                className="px-6 py-2.5 bg-zinc-950 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-[13px] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-2xl shadow-zinc-950/20 uppercase tracking-widest"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            )
          )}
        </div>
      </nav>

      {/* Mobile Navigation Bar (Fixed Bottom) */}
      <div className="lg:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-1rem)] max-w-md px-1 pb-[max(env(safe-area-inset-bottom),0.25rem)]">
          <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-white dark:border-zinc-800 rounded-[2rem] p-2 flex items-center justify-around shadow-2xl shadow-zinc-950/20">
            {[
              { href: '/', icon: LayoutDashboard, label: 'Home' },
              { href: '/history', icon: History, label: 'History' },
              { href: '/trends', icon: BarChart3, label: 'Trends' },
              { href: '/kitchen', icon: ChefHat, label: 'Kitchen' },
              { href: '/profile', icon: User, label: 'Profile' },
            ].map((link) => (
              <Link 
                key={link.href}
                href={link.href} 
                className={`flex flex-col items-center gap-1 py-2 px-3 min-h-14 rounded-2xl transition-all group ${
                  pathname === link.href ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-zinc-100 text-zinc-500'
                }`}
              >
                <link.icon className={`w-5 h-5 ${pathname === link.href ? 'text-indigo-600' : 'group-hover:text-indigo-600'}`} />
                <span className={`text-[11px] font-black uppercase tracking-tight ${
                  pathname === link.href ? 'text-indigo-700' : 'text-zinc-400 group-hover:text-zinc-900'
                }`}>
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}
