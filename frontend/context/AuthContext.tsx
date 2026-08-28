"use client";

import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { fetchApi, fetchJson } from '@/lib/fetchApi';

export interface User {
    id: number;
    name: string;
    email: string;
    roles: string[];
    created_at?: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (user: User) => void;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refresh = async () => {
        try {
            const response = await fetchJson<{ data: User }>('/api/me');
            setUser(response.data);
        } catch {
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void refresh();
    }, []);

    const login = (authenticatedUser: User) => {
        setUser(authenticatedUser);
        setIsLoading(false);
    };

    const logout = async () => {
        try {
            await fetchApi('/api/logout', { method: 'POST' });
        } finally {
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout, refresh }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
