'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';

type Lang = 'rw' | 'en';

const DICT = {
  rw: {
    // ---------- Navigation ----------
    'nav.home': 'Ahabanza',
    'nav.plan': 'Tegura urugendo',
    'nav.routes': 'Ingendo',
    'nav.map': 'Ikarita',
    'nav.places': 'Ahantu',
    'nav.tickets': 'Bileti',
    'nav.admin': 'Ibibaho',
    'nav.staff': 'Abakozi',
    'nav.staffArea': 'Ahantu h’abakozi',
    'nav.staffSignin': 'Kwinjira kw’abakozi',
    'nav.menu': 'Kugenda',
    'nav.signin': 'Injira',
    'nav.signout': 'Sohoka',
    'nav.account': 'Konti',

    // ---------- Home ----------
    'home.tagline': 'Ubwikorezi bwa Kigali mu buryo bworoshye',
    'home.cta.plan': 'Tegura urugendo',
    'home.cta.map': 'Reba bisi kuri ikarita',
    'home.assistant': 'Baza RouteView',

    // ---------- Plan ----------
    'plan.from': 'Aho uva',
    'plan.to': 'Aho ujya',
    'plan.find': 'Shakisha',
    'plan.noOptions': 'Nta nzira yabonetse',

    // ---------- Chat ----------
    'chat.placeholder': 'Baza ikibazo…',
    'chat.send': 'Ohereza'
  },
  en: {
    // ---------- Navigation ----------
    'nav.home': 'Home',
    'nav.plan': 'Plan',
    'nav.routes': 'Routes',
    'nav.map': 'Map',
    'nav.places': 'Places',
    'nav.tickets': 'Tickets',
    'nav.admin': 'Console',
    'nav.staff': 'Staff',
    'nav.staffArea': 'Staff area',
    'nav.staffSignin': 'Staff sign-in',
    'nav.menu': 'Navigate',
    'nav.signin': 'Sign in',
    'nav.signout': 'Sign out',
    'nav.account': 'Account',

    // ---------- Home ----------
    'home.tagline': 'Kigali public transport, made simple',
    'home.cta.plan': 'Plan a journey',
    'home.cta.map': 'See buses on the map',
    'home.assistant': 'Ask RouteView',

    // ---------- Plan ----------
    'plan.from': 'From',
    'plan.to': 'To',
    'plan.find': 'Search',
    'plan.noOptions': 'No options found',

    // ---------- Chat ----------
    'chat.placeholder': 'Ask a question…',
    'chat.send': 'Send'
  }
} as const;

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: keyof typeof DICT['en']) => string;
};

const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('rw');

  useEffect(() => {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem('rv_lang') : null;
    if (v === 'rw' || v === 'en') setLangState(v);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== 'undefined') window.localStorage.setItem('rv_lang', l);
  };

  const t = (k: keyof typeof DICT['en']) => {
    const dict = DICT[lang] as Record<string, string>;
    return dict[k] || k;
  };

  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const c = useContext(I18nCtx);
  if (!c) throw new Error('I18nProvider missing');
  return c;
}