"use client";
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface User {
    id: number;
    name: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredAuth(): Pick<AuthContextType, 'user' | 'token'> {
    if (typeof window === 'undefined') {
        return { user: null, token: null };
    }

    const storedToken = localStorage.getItem('petposture_token');
    const storedUser = localStorage.getItem('petposture_user');

    if (!storedToken || !storedUser) {
        return { user: null, token: null };
    }

    try {
        return {
            token: storedToken,
            user: JSON.parse(storedUser) as User,
        };
    } catch {
        localStorage.removeItem('petposture_token');
        localStorage.removeItem('petposture_user');

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
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('petposture_token');
        localStorage.removeItem('petposture_user');
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
