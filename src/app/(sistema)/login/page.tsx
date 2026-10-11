'use client';

import { useActionState } from 'react';
import { fazerLogin } from './actions';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export default function LoginPage() {
  const [state, formAction, pendente] = useActionState(fazerLogin, { erro: null });

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-dim px-4">
      <div className="w-full max-w-sm rounded bg-surface border border-outline-variant p-8">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Logos Company</p>
          <h1 className="mt-1 text-2xl font-semibold text-on-surface">Argus</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Gestão de operação</p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <Field label="Usuário" name="username" autoComplete="username" required />
          <Field label="Senha" name="senha" type="password" autoComplete="current-password" required />
          {state.erro && <Alert variant="error">{state.erro}</Alert>}
          <Button type="submit" fullWidth disabled={pendente}>
            {pendente ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
