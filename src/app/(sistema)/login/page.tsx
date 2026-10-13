'use client';

import { useActionState } from 'react';
import { fazerLogin } from './actions';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { LogoArgus } from '@/components/shopping/Logo';

const RECURSOS = ['Câmeras com IA', 'Contagem de visitantes', 'Mapa de calor', 'Rotas e fluxo', 'Zonas mortas', 'Comparativo de períodos', 'Busca de criança perdida', 'Pergunte ao Argus'];

export default function LoginPage() {
  const [state, formAction, pendente] = useActionState(fazerLogin, { erro: null });

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-950 text-white">
      {/* Foto do Caruaru Shopping de fundo, escurecida para o texto ler bem */}
      <div aria-hidden className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/login-caruaru-shopping.jpg)' }} />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/55 to-slate-950/20" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-slate-950/20" />

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-10 px-4 py-10 lg:flex-row lg:justify-between lg:gap-16 lg:px-8">
        <section className="max-w-xl text-center lg:text-left">
          <div className="mb-8 flex items-center justify-center gap-4 lg:justify-start">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-lg">
              <img src="/caruaru-shopping.png" alt="Caruaru Shopping" className="h-full w-full object-contain" />
            </span>
            <span className="h-10 w-px bg-white/30" />
            <span className="flex flex-col items-start">
              <LogoArgus className="h-9 text-white" />
              {/* Mesma largura do logotipo ARGUS */}
              <span className="mt-1 whitespace-nowrap text-[8.2px] font-medium uppercase tracking-[0.12em] text-white/70">Inteligência Patrimonial</span>
            </span>
          </div>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">O Caruaru Shopping inteiro, em tempo real.</h1>
          <ul className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start">
            {RECURSOS.map((r) => (
              <li key={r} className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
                {r}
              </li>
            ))}
          </ul>
        </section>

        <section className="w-full max-w-sm rounded-2xl bg-surface p-8 text-on-surface shadow-2xl ring-1 ring-black/5">
          <h2 className="text-xl font-semibold">Entrar no painel</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Acesso restrito à equipe do Caruaru Shopping.</p>
          <form action={formAction} className="mt-6 flex flex-col gap-4">
            <Field label="Usuário" name="username" autoComplete="username" autoFocus required />
            <Field label="Senha" name="senha" type="password" autoComplete="current-password" required />
            {state.erro && <Alert variant="error">{state.erro}</Alert>}
            <Button type="submit" fullWidth disabled={pendente}>
              {pendente ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
          <p className="mt-5 text-center text-xs text-on-surface-variant">Esqueceu a senha? Fale com o administrador do sistema.</p>
        </section>
      </main>

      <footer className="relative z-10 pb-4 text-center text-[11px] text-white/40">Desenvolvido por Logos Company</footer>
    </div>
  );
}
