"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { User, Lock, Mail, ChevronRight } from 'lucide-react';

export default function AuthPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { login } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const endpoint = isLogin ? '/api/login' : '/api/register';
        const body = isLogin ? { email, password } : { name, email, password };

        try {
            const res = await fetch(`http://localhost:8000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (res.ok && data.token) {
                login(data.token, data.user);
                router.push('/shop'); // Redirect to Shop or Dashboard after successful auth
            } else {
                setError(data.message || (isLogin ? "Invalid credentials" : "Registration failed"));
            }
        } catch (err) {
            setError("Could not connect to the authentication server.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#f4f6f8] font-hanken flex flex-col">
            <Header />

            <div className="flex-1 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-zinc-100 max-w-md w-full relative overflow-hidden">

                    <div className="mb-10 text-center">
                        <div className="inline-flex overflow-hidden rounded-full border border-zinc-100 bg-[#f8f9fa] p-1 mb-8 shadow-sm">
                            <button
                                type="button"
                                onClick={() => setIsLogin(true)}
                                className={`px-6 py-2 rounded-full text-[12px] font-bold uppercase tracking-widest transition-colors ${isLogin ? 'bg-white shadow text-[#df8448] border border-zinc-50' : 'text-zinc-400 hover:text-[#3e4c57]'}`}
                            >
                                Sign In
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsLogin(false)}
                                className={`px-6 py-2 rounded-full text-[12px] font-bold uppercase tracking-widest transition-colors ${!isLogin ? 'bg-white shadow text-[#df8448] border border-zinc-50' : 'text-zinc-400 hover:text-[#3e4c57]'}`}
                            >
                                Register
                            </button>
                        </div>

                        <h1 className="text-[28px] font-bold text-[#3e4c57] leading-tight mb-2">
                            {isLogin ? 'Sign In' : 'Sign Up'}
                        </h1>
                        <p className="text-zinc-500 text-[14px]">
                            {isLogin ? 'Enter your details to access your account.' : 'Create an account to track orders & save preferences.'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">

                        {!isLogin && (
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

                        <div className="space-y-1 relative">
                            <label className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400 ml-1">Secure Password</label>
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

                        {error && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-[12px] font-medium px-1 bg-red-50 p-3 rounded-lg border border-red-100">
                                {error}
                            </motion.div>
                        )}

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-[#df8448] text-white py-5 rounded-xl font-bold uppercase tracking-[0.25em] text-[13px] hover:bg-[#c9713a] disabled:opacity-50 transition-all shadow-xl shadow-orange-100 flex items-center justify-center gap-3 group"
                            >
                                {isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </form>

                </div>
            </div>

            <Footer />
        </main>
    );
}
