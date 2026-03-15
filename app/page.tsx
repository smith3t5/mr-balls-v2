// Landing page — no auth, just redirect to dashboard
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // If user already selected, go straight to dashboard
    const stored = localStorage.getItem('mrb_user');
    if (stored) {
      router.replace('/dashboard');
    } else {
      // No user selected yet — layout will show the picker
      router.replace('/dashboard');
    }
  }, [router]);

  // Brief splash while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 mb-6 shadow-2xl shadow-amber-500/20">
          <Sparkles className="w-8 h-8 text-slate-900" />
        </div>
        <h1 className="text-4xl font-black bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 bg-clip-text text-transparent mb-2">
          M.R. B.A.L.L.S.
        </h1>
        <p className="text-xs text-gray-500 tracking-widest uppercase">The Oracle v2.0</p>
      </div>
    </div>
  );
}
