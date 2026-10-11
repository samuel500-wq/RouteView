'use client';
import { createContext, ReactNode, useContext, useState } from 'react';
import Modal from './Modal';

type ConfirmOpts = { title: string; message: string; destructive?: boolean; confirmLabel?: string };
type Ctx = (opts: ConfirmOpts) => Promise<boolean>;
const ConfirmCtx = createContext<Ctx | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOpts; resolve: (v: boolean) => void } | null>(null);

  const confirm: Ctx = (opts) => new Promise<boolean>((resolve) => setState({ opts, resolve }));
  const close = (v: boolean) => { state?.resolve(v); setState(null); };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.opts.title || 'Confirm'}
        footer={
          <>
            <button onClick={() => close(false)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700">
              Cancel
            </button>
            <button onClick={() => close(true)}
                    className={`rounded-md px-3 py-1.5 text-sm text-white ${state?.opts.destructive ? 'bg-red-600' : 'bg-sky-600'}`}>
              {state?.opts.confirmLabel || 'Confirm'}
            </button>
          </>
        }>
        <p className="text-sm">{state?.opts.message}</p>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const c = useContext(ConfirmCtx);
  if (!c) throw new Error('ConfirmProvider missing');
  return c;
}