"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getApiBaseUrl } from '@/lib/api';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { User, Lock, Mail, ChevronRight, CheckCircle2 } from 'lucide-react';

type Mode = 'login' | 'register' | 'forgot' | 'forgot-sent';

export default function AuthPage() {
    const [mode, setMode] = useState<Mode>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { login } = useAuth();
    const router = useRouter();

    const getCartToken = () =>
        typeof window !== 'undefined' ? localStorage.getItem('petposture_cart_token') : null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const base = getApiBaseUrl();

            if (mode === 'forgot') {
                const res = await fetch(`${base}/api/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email }),
                });
                if (!res.ok) throw new Error('Request failed.');
                setMode('forgot-sent');
                return;
            }

            const endpoint = mode === 'login' ? '/api/login' : '/api/register';
            const cartToken = getCartToken();
            const body = mode === 'login'
                ? { email, password, ...(cartToken ? { cart_token: cartToken } : {}) }
                : { name, email, password };

            const res = await fetch(`${base}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (res.ok && data.token) {
                login(data.token, data.user);
                router.push('/shop');
            } else {
                setError(data.message || (mode === 'login' ? 'Invalid credentials' : 'Registration failed'));
            }
        } catch {
            setError('Could not connect to the server. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Forgot-sent confirmation screen ──────────────────────────────
    if (mode === 'forgot-sent') {
        return (
            <main className="min-h-screen bg-[#f4f6f8] flex flex-col">
                <Header />
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-zinc-100 max-w-md w-full text-center space-y-6">
                        <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 size={32} />
                        </div>
                        <h2 className="text-[24px] font-bold text-[#3e4c57]">Check your inbox</h2>
                        <p className="text-zinc-500 text-[14px] leading-relaxed">
                            If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link. Check your spam folder if you don&apos;t see it.
                        </p>
                        <button
                            onClick={() => { setMode('login'); setEmail(''); }}
                            className="text-[#df8448] text-[13px] font-bold underline underline-offset-2 hover:text-[#c9713a] transition-colors"
                        >
                            Back to Sign In
                        </button>
                    </div>
                </div>
                <Footer />
            </main>
        );
    }

    // ── Main auth form ────────────────────────────────────────────────
    return (
        <main className="min-h-screen bg-[#f4f6f8] font-hanken flex flex-col">
            <Header />

            <div className="flex-1 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-zinc-100 max-w-md w-full relative overflow-hidden">

                    {mode !== 'forgot' && (
                        <div className="mb-10 text-center">
                            <div className="inline-flex overflow-hidden rounded-full border border-zinc-100 bg-[#f8f9fa] p-1 mb-8 shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => { setMode('login'); setError(null); }}
                                    className={`px-6 py-2 rounded-full text-[12px] font-bold uppercase tracking-widest transition-colors ${mode === 'login' ? 'bg-white shadow text-[#df8448] border border-zinc-50' : 'text-zinc-400 hover:text-[#3e4c57]'}`}
                                >
                                    Sign In
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setMode('register'); setError(null); }}
                                    className={`px-6 py-2 rounded-full text-[12px] font-bold uppercase tracking-widest transition-colors ${mode === 'register' ? 'bg-white shadow text-[#df8448] border border-zinc-50' : 'text-zinc-400 hover:text-[#3e4c57]'}`}
                                >
                                    Register
                                </button>
                            </div>
                            <h1 className="text-[28px] font-bold text-[#3e4c57] leading-tight mb-2">
                                {mode === 'login' ? 'Sign In' : 'Sign Up'}
                            </h1>
                            <p className="text-zinc-500 text-[14px]">
                                {mode === 'login' ? 'Enter your details to access your account.' : 'Create an account to track orders & save preferences.'}
                            </p>
                        </div>
                    )}

                    {mode === 'forgot' && (
                        <div className="mb-10 text-center">
                            <h1 className="text-[28px] font-bold text-[#3e4c57] leading-tight mb-2">Forgot Password</h1>
                            <p className="text-zinc-500 text-[14px]">Enter your email and we&apos;ll send you a reset link.</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">

                        {mode === 'register' && (
                            <div className="space-y-1 relative">
                                <label className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400 ml-1">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full pl-12 pr-6 py-4 rounded-xl bg-[#f8f9fa] border-2 border-transparent focus:border-[#df8448] focus:bg-white outline-none transition-all text-[#3e4c57] font-medium placeholder:text-zinc-300"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1 relative">
                            <label className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400 ml-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-6 py-4 rounded-xl bg-[#f8f9fa] border-2 border-transparent focus:border-[#df8448] focus:bg-white outline-none transition-all text-[#3e4c57] font-medium placeholder:text-zinc-300"
                                    placeholder="email@example.com"
                                />
                            </div>
                        </div>

                        {mode !== 'forgot' && (
                            <div className="space-y-1 relative">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">Secure Password</label>
                                    {mode === 'login' && (
                                        <button
                                            type="button"
                                            onClick={() => { setMode('forgot'); setError(null); }}
                                            className="text-[11px] font-bold text-[#df8448] hover:text-[#c9713a] transition-colors"
                                        >
                                            Forgot password?
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-6 py-4 rounded-xl bg-[#f8f9fa] border-2 border-transparent focus:border-[#df8448] focus:bg-white outline-none transition-all text-[#3e4c57] font-medium placeholder:text-zinc-300"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        )}

                        {error && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-[12px] font-medium px-1 bg-red-50 p-3 rounded-lg border border-red-100">
                                {error}
                            </motion.div>
                        )}

                        <div className="pt-4 space-y-3">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-[#df8448] text-white py-5 rounded-xl font-bold uppercase tracking-[0.25em] text-[13px] hover:bg-[#c9713a] disabled:opacity-50 transition-all shadow-xl shadow-orange-100 flex items-center justify-center gap-3 group"
                            >
                                {isLoading ? 'Processing...' : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link'}
                                {!isLoading && <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                            </button>

                            {mode === 'forgot' && (
                                <button
                                    type="button"
                                    onClick={() => { setMode('login'); setError(null); }}
                                    className="w-full text-zinc-400 text-[12px] font-bold hover:text-[#3e4c57] transition-colors py-2"
                                >
                                    Back to Sign In
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>

            <Footer />
        </main>
    );
}
