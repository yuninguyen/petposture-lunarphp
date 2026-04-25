"use client";
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface User {
    id: number;
    name: string;
    email: string;
    roles: string[];
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function setCookie(name: string, value: string, days: number) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
}

function getCookie(name: string) {
    const nameEQ = name + "=";
    const ca = typeof document !== 'undefined' ? document.cookie.split(';') : [];
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function eraseCookie(name: string) {
    document.cookie = name + '=; Max-Age=-99999999; path=/;';
}

function readStoredAuth(): Pick<AuthContextType, 'user' | 'token'> {
    if (typeof window === 'undefined') {
        return { user: null, token: null };
    }

    const storedToken = localStorage.getItem('petposture_token') || getCookie('petposture_token');
    const storedUser = localStorage.getItem('petposture_user') || getCookie('petposture_user');

    if (!storedToken || !storedUser) {
        return { user: null, token: null };
    }

    try {
        const user = JSON.parse(storedUser) as User;
        return {
            token: storedToken,
            user,
        };
    } catch {
        localStorage.removeItem('petposture_token');
        localStorage.removeItem('petposture_user');
        eraseCookie('petposture_token');
        eraseCookie('petposture_user');

        return { user: null, token: null };
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const initialAuth = readStoredAuth();
    const [user, setUser] = useState<User | null>(initialAuth.user);
    const [token, setToken] = useState<string | null>(initialAuth.token);

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('petposture_token', newToken);
        localStorage.setItem('petposture_user', JSON.stringify(newUser));

        // Also set cookies for middleware
        setCookie('petposture_token', newToken, 7);
        setCookie('petposture_user', JSON.stringify(newUser), 7);
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('petposture_token');
        localStorage.removeItem('petposture_user');

        // Also erase cookies
        eraseCookie('petposture_token');
        eraseCookie('petposture_user');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
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
