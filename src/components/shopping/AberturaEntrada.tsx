'use client';

import { useEffect, useState } from 'react';
import { LogoA, LogoArgus } from '@/components/shopping/Logo';

/** Cookie curto criado no login (ver login/actions.ts): a abertura só toca logo depois de entrar. */
const COOKIE = 'argus-abertura';
const DURACAO_MS = 5000;

// Abertura do sistema depois do login: o "A" do Argus acende, uma linha de
// varredura (como a de uma câmera) revela o nome, aparece o "bem-vindo" e
// tudo se dissolve revelando o painel. Clicar pula.
// O servidor só renderiza este componente quando o cookie existe, então a
// abertura já vem na primeira pintura (o painel não pisca antes).
export function AberturaEntrada({ nome }: { nome: string }) {
  const [fase, setFase] = useState<'nada' | 'tocando' | 'saindo'>('tocando');

  useEffect(() => {
    document.cookie = `${COOKIE}=; path=/; max-age=0`;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t1 = setTimeout(() => setFase('saindo'), reduzido ? 600 : DURACAO_MS - 600);
    const t2 = setTimeout(() => setFase('nada'), reduzido ? 900 : DURACAO_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Ao sair, o painel por trás entra animado (ver .entrada-animada em tema.css).
  useEffect(() => {
    if (fase !== 'tocando') document.querySelector('.entrada-animada')?.classList.add('revelar');
  }, [fase]);

  if (fase === 'nada') return null;
  const primeiroNome = nome.split(' ')[0];

  return (
    <div
      role="presentation"
      onClick={() => setFase('saindo')}
      onTransitionEnd={() => fase === 'saindo' && setFase('nada')}
      className={`abertura fixed inset-0 z-[100] flex cursor-pointer items-center justify-center overflow-hidden bg-slate-950 text-white transition-[opacity,filter] duration-500 ${fase === 'saindo' ? 'pointer-events-none opacity-0 blur-sm' : 'opacity-100'}`}
    >
      <style>{`
        @keyframes ab-fundo { from { transform: scale(1.12); opacity: 0 } to { transform: scale(1); opacity: .28 } }
        @keyframes ab-a { 0% { transform: scale(.6); opacity: 0; filter: blur(8px) } 60% { opacity: 1; filter: blur(0) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes ab-anel { 0% { transform: scale(.5); opacity: .8 } 100% { transform: scale(2.6); opacity: 0 } }
        @keyframes ab-revela { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0 0 0) } }
        @keyframes ab-varre { 0% { left: 0; opacity: 0 } 10% { opacity: 1 } 90% { opacity: 1 } 100% { left: 100%; opacity: 0 } }
        @keyframes ab-sobe { from { transform: translateY(10px); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes ab-barra { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        @keyframes ab-ponto { 0%, 80%, 100% { opacity: .2 } 40% { opacity: 1 } }
        @keyframes ab-grade { from { opacity: 0 } 40% { opacity: .5 } to { opacity: .15 } }
        .abertura .fundo { animation: ab-fundo 2.6s ease-out both }
        .abertura .grade { animation: ab-grade 2s ease-out both }
        .abertura .a { animation: ab-a .8s cubic-bezier(.2,.8,.2,1) both }
        .abertura .anel { animation: ab-anel 1.4s ease-out .35s both }
        .abertura .nome { animation: ab-revela .8s cubic-bezier(.6,0,.2,1) .7s both }
        .abertura .varre { animation: ab-varre .8s cubic-bezier(.6,0,.2,1) .7s both }
        .abertura .s1 { animation: ab-sobe .5s ease-out 1.35s both }
        .abertura .s2 { animation: ab-sobe .5s ease-out 1.6s both }
        .abertura .barra { animation: ab-barra 3s cubic-bezier(.4,0,.2,1) 1.7s both; transform-origin: left }
        .abertura .ponto { animation: ab-ponto 1.2s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .abertura * { animation-duration: 1ms !important; animation-delay: 0s !important } }
      `}</style>

      {/* Foto do shopping bem apagada + grade de "visão de câmera" */}
      <div aria-hidden className="fundo absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/login-caruaru-shopping.jpg)' }} />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgb(2_6_23/.85)_70%)]" />
      <div
        aria-hidden
        className="grade absolute inset-0"
        style={{ backgroundImage: 'linear-gradient(rgb(96 165 250/.12) 1px, transparent 1px), linear-gradient(90deg, rgb(96 165 250/.12) 1px, transparent 1px)', backgroundSize: '48px 48px' }}
      />

      <div className="relative flex flex-col items-center text-center">
        <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
          <span aria-hidden className="anel absolute inset-0 rounded-full border-2 border-sky-400/70" />
          <span aria-hidden className="absolute inset-2 rounded-full bg-sky-500/10 blur-xl" />
          <LogoA className="a relative h-16 text-white drop-shadow-[0_0_18px_rgb(56_189_248/.55)]" />
        </div>

        <div className="relative">
          <div className="nome flex flex-col items-center">
            <LogoArgus className="h-10 text-white sm:h-12" />
            <span className="mt-2 text-[10px] font-medium uppercase tracking-[0.3em] text-white/70 sm:text-xs">Inteligência Patrimonial</span>
          </div>
          <span aria-hidden className="varre absolute -top-2 opacity-0 h-[calc(100%+16px)] w-0.5 bg-sky-300 shadow-[0_0_16px_4px_rgb(56_189_248/.7)]" />
        </div>

        <p className="s1 mt-10 text-xl font-semibold sm:text-2xl">Bem-vindo{primeiroNome ? `, ${primeiroNome}` : ''}</p>
        <div className="s2 mt-3 flex flex-col items-center">
          <p className="text-sm text-white/70">
            Carregando painel
            <span className="ponto">.</span>
            <span className="ponto [animation-delay:.2s]">.</span>
            <span className="ponto [animation-delay:.4s]">.</span>
          </p>
          <span className="mt-3 block h-0.5 w-48 overflow-hidden rounded-full bg-white/10">
            <span className="barra block h-full w-full rounded-full bg-sky-400 shadow-[0_0_8px_rgb(56_189_248/.8)]" />
          </span>
        </div>
      </div>
    </div>
  );
}
