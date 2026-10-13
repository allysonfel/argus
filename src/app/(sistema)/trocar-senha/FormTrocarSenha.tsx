'use client';

import { useActionState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { trocarSenha } from './actions';

export function FormTrocarSenha() {
  const [state, acao, pendente] = useActionState(trocarSenha, { erro: null });
  return (
    <form action={acao} className="mt-6 flex flex-col gap-4">
      <Field label="Senha atual (ou provisória)" name="atual" type="password" autoComplete="current-password" required />
      <Field label="Senha nova" name="nova" type="password" autoComplete="new-password" required hint="Pelo menos 8 caracteres, com letras e números." />
      <Field label="Repita a senha nova" name="confirmar" type="password" autoComplete="new-password" required />
      {state.erro && <Alert variant="error">{state.erro}</Alert>}
      <Button type="submit" fullWidth disabled={pendente}>
        {pendente ? 'Salvando…' : 'Salvar e entrar'}
      </Button>
    </form>
  );
}
