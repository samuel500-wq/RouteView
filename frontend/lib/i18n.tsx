'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';

type Lang = 'rw' | 'en';

const DICT = {
  rw: {
    'nav.home': 'Ahabanza',
    'nav.plan': 'Tegura urugendo',
    'nav.routes': 'Ingendo',
    'nav.map': 'Ikarita',
    'nav.places': 'Ahantu',
    'nav.tickets': 'Bileti',
    'nav.press': 'Itangazamakuru',
    'nav.admin': 'Ubuyobozi',
    'home.tagline': 'Ubwikorezi bwa Kigali mu buryo bworoshye',
    'home.cta.plan': 'Tegura urugendo',
    'home.cta.map': 'Reba bisi kuri ikarita',
    'home.assistant': 'Baza RouteView',
    'plan.from': 'Aho uva',
    'plan.to': 'Aho ujya',
    'plan.find': 'Shakisha',
    'plan.noOptions': 'Nta nzira yabonetse',
    'chat.placeholder': 'Baza ikibazo…',
    'chat.send': 'Ohereza'
  },
  en: {
    'nav.home': 'Home',
    'nav.plan': 'Plan',
    'nav.routes': 'Routes',
    'nav.map': 'Map',
    'nav.places': 'Places',
    'nav.tickets': 'Tickets',
    'nav.press': 'Press',
    'nav.admin': 'Admin',
    'home.tagline': 'Kigali public transport, made simple',
    'home.cta.plan': 'Plan a journey',
    'home.cta.map': 'See buses on the map',
    'home.assistant': 'Ask RouteView',
    'plan.from': 'From',
    'plan.to': 'To',
    'plan.find': 'Search',
    'plan.noOptions': 'No options found',
    'chat.placeholder': 'Ask a question…',
    'chat.send': 'Send'
  }
} as const;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: keyof typeof DICT['en']) => string };
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
  const t = (k: keyof typeof DICT['en']) => DICT[lang][k] || k;
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const c = useContext(I18nCtx);
  if (!c) throw new Error('I18nProvider missing');
  return c;
}