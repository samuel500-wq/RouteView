'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';

type User = {
  id: number;
  email: string;
  role: string;
  full_name: string;
  preferred_lang?: 'rw' | 'en';
} | null;

type RegisterPayload = {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  preferred_lang?: 'rw' | 'en';
};

type RegisterStaffPayload = {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: 'operator' | 'admin';
  invite_code: string;
};

type Ctx = {
  user: User;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  registerStaff: (payload: RegisterStaffPayload) => Promise<void>;
  logout: () => void;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('rv_user') : null;
      const token = getToken();
      if (raw && token) setUser(JSON.parse(raw));
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const persist = (token: string, u: any) => {
    setToken(token);
    setUser(u);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('rv_user', JSON.stringify(u));
    }
  };

  const login = async (email: string, password: string) => {
    const { token, user: u } = await api.login(email, password);
    persist(token, u);
  };

  const register = async (payload: RegisterPayload) => {
    const { token, user: u } = await api.register(payload);
    persist(token, u);
  };

  const registerStaff = async (payload: RegisterStaffPayload) => {
    const { token, user: u } = await api.registerStaff(payload);
    persist(token, u);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('rv_user');
    }
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, registerStaff, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('AuthProvider missing');
  return c;
}