"use client";

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getApiBaseUrl } from '@/lib/api';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Lock, ChevronRight, CheckCircle2 } from 'lucide-react';

function ResetPasswordForm() {
    const params = useSearchParams();
    const router = useRouter();
    const token = params.get('token') ?? '';
    const email = params.get('email') ?? '';

    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmation) {
            setError('Passwords do not match.');
            return;
        }
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(`${getApiBaseUrl()}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, email, password, password_confirmation: confirmation }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Reset failed.');
            setDone(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong.');
        } finally {
            setIsLoading(false);
        }
    };

    if (done) {
        return (
            <div className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-zinc-100 max-w-md w-full text-center space-y-6">
                <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} />
                </div>
                <h2 className="text-[24px] font-bold text-[#3e4c57]">Password updated!</h2>
                <p className="text-zinc-500 text-[14px]">Your password has been reset. You can now sign in with your new password.</p>
                <button
                    onClick={() => router.push('/auth')}
                    className="bg-[#df8448] text-white px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-[12px] hover:bg-[#c9713a] transition-colors"
                >
                    Sign In
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-zinc-100 max-w-md w-full">
            <div className="mb-10 text-center">
                <h1 className="text-[28px] font-bold text-[#3e4c57] mb-2">Set New Password</h1>
                <p className="text-zinc-500 text-[14px]">Choose a strong password for your account.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1">
                    <label className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400 ml-1">New Password</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input
                            type="password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 rounded-xl bg-[#f8f9fa] border-2 border-transparent focus:border-[#df8448] focus:bg-white outline-none transition-all text-[#3e4c57] font-medium placeholder:text-zinc-300"
                            placeholder="Min. 8 characters"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400 ml-1">Confirm Password</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input
                            type="password"
                            required
                            minLength={8}
                            value={confirmation}
                            onChange={(e) => setConfirmation(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 rounded-xl bg-[#f8f9fa] border-2 border-transparent focus:border-[#df8448] focus:bg-white outline-none transition-all text-[#3e4c57] font-medium placeholder:text-zinc-300"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                {error && (
                    <div className="text-red-500 text-[12px] font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                        {error}
                    </div>
                )}

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-[#df8448] text-white py-5 rounded-xl font-bold uppercase tracking-[0.25em] text-[13px] hover:bg-[#c9713a] disabled:opacity-50 transition-all shadow-xl shadow-orange-100 flex items-center justify-center gap-3 group"
                    >
                        {isLoading ? 'Updating...' : 'Reset Password'}
                        {!isLoading && <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <main className="min-h-screen bg-[#f4f6f8] flex flex-col">
            <Header />
            <div className="flex-1 flex items-center justify-center p-4">
                <Suspense fallback={<div className="text-zinc-400">Loading...</div>}>
                    <ResetPasswordForm />
                </Suspense>
            </div>
            <Footer />
        </main>
    );
}
