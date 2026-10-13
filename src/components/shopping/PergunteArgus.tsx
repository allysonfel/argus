'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { perguntarArgus, type RespostaArgus } from '@/app/(sistema)/shopping/acoes';
import { LogoA } from './Logo';
import { GraficoBarras, GraficoLinhas } from './Graficos';
import { cn } from '@/lib/cn';

const SUGESTOES = ['Qual corredor mais cresceu em outubro?', 'Qual o horário de pico hoje?', 'Quantas pessoas estão no shopping agora?', 'Quais são as zonas mortas?', 'Quantas pessoas entraram hoje?'];
type Mensagem = { de: 'voce'; texto: string } | { de: 'argus'; resposta: RespostaArgus };

// O limite diário é contado no servidor (por usuário); aqui só mostramos.
export function PergunteArgus({ limiteDia, usadasHoje }: { limiteDia: number; usadasHoje: number }) {
  const LIMITE_DIA = limiteDia;
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [usadas, setUsadas] = useState(usadasHoje);
  const [pensando, iniciar] = useTransition();
  const fimRef = useRef<HTMLDivElement>(null);

  // Painel montado sempre (pra animar a abertura e o fechamento).
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    if (aberto) setVisivel(true);
    else {
      const t = setTimeout(() => setVisivel(false), 220);
      return () => clearTimeout(t);
    }
  }, [aberto]);
  useEffect(() => fimRef.current?.scrollIntoView({ behavior: 'smooth' }), [mensagens, pensando]);

  function enviar(pergunta: string) {
    const q = pergunta.trim();
    if (!q || pensando || usadas >= LIMITE_DIA) return;
    setTexto('');
    setMensagens((m) => [...m, { de: 'voce', texto: q }]);
    iniciar(async () => {
      const resposta = await perguntarArgus(q);
      if (resposta.usadasHoje !== undefined) setUsadas(resposta.usadasHoje);
      setMensagens((m) => [...m, { de: 'argus', resposta }]);
    });
  }

  return (
    <>
      <button
        onClick={() => setAberto((a) => !a)}
        aria-label="Pergunte ao Argus"
        title="Pergunte ao Argus"
        aria-expanded={aberto}
        className={cn(
          'group fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition-all duration-300 ease-out hover:scale-110 hover:shadow-xl active:scale-90 print:hidden',
          aberto && 'rotate-[360deg] shadow-xl ring-4 ring-primary/25'
        )}
      >
        {/* onda ao redor enquanto fechado, pra chamar atenção */}
        {!aberto && <span className="absolute inset-0 animate-ping rounded-full bg-primary/30 [animation-duration:2.4s]" />}
        <span className={cn('absolute transition-all duration-300', aberto ? 'scale-50 opacity-0' : 'scale-100 opacity-100')}>
          <LogoA className={cn('h-6', pensando && 'animate-pulse')} />
        </span>
        <span className={cn('absolute text-xl leading-none transition-all duration-300', aberto ? 'scale-100 opacity-100' : 'scale-50 opacity-0')}>✕</span>
      </button>

      {visivel && (
        <div
          className={cn(
            'fixed bottom-24 right-5 z-50 flex h-[min(640px,calc(100vh-8rem))] w-[min(420px,calc(100vw-2.5rem))] origin-bottom-right flex-col overflow-hidden rounded-md border border-outline-variant bg-surface shadow-2xl transition-all duration-200 ease-out',
            aberto ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-95 opacity-0'
          )}
          style={{ animation: aberto ? 'argus-abrir 220ms ease-out' : undefined }}
        >
          <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary">
                <LogoA className="h-3.5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-on-surface">Pergunte ao Argus</p>
                <p className="text-[11px] text-on-surface-variant">Respostas a partir dos dados do shopping</p>
              </div>
            </div>
            <button onClick={() => setAberto(false)} className="rounded-sm px-2 py-1 text-sm text-on-surface-variant hover:bg-surface-container-low" aria-label="Fechar">
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {mensagens.length === 0 && (
              <div>
                <p className="mb-3 text-sm text-on-surface-variant">Pergunte sobre o movimento do shopping. Sugestões:</p>
                <div className="flex flex-col gap-2">
                  {SUGESTOES.map((s) => (
                    <button key={s} onClick={() => enviar(s)} className="rounded-sm border border-outline-variant px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container-low">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensagens.map((m, i) =>
              m.de === 'voce' ? (
                <div key={i} className="ml-10 rounded bg-primary-container px-3 py-2 text-sm text-on-primary-container">
                  {m.texto}
                </div>
              ) : (
                <div key={i} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
                    <LogoA className="h-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-on-surface">{m.resposta.texto}</p>
                    {m.resposta.grafico && (
                      <div className="mt-2 rounded-sm border border-outline-variant p-2">
                        {m.resposta.grafico.tipo === 'linhas' ? (
                          <GraficoLinhas dados={m.resposta.grafico.dados} x={m.resposta.grafico.x} formatoX={m.resposta.grafico.formatoX} series={[{ chave: 'valor', nome: m.resposta.grafico.serie }]} altura={180} />
                        ) : (
                          <GraficoBarras dados={m.resposta.grafico.dados} x={m.resposta.grafico.x} series={[{ chave: 'valor', nome: m.resposta.grafico.serie }]} horizontal altura={Math.max(160, m.resposta.grafico.dados.length * 28)} />
                        )}
                      </div>
                    )}
                    {m.resposta.periodo && <p className="mt-1.5 text-[11px] text-on-surface-variant">Período: {m.resposta.periodo} · estimativa</p>}
                  </div>
                </div>
              )
            )}
            {pensando && (
              <div className="flex items-center gap-2.5 text-sm text-on-surface-variant">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-on-primary">
                  <LogoA className="h-3 animate-pulse" />
                </span>
                Analisando os dados...
              </div>
            )}
            <div ref={fimRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar(texto);
            }}
            className="border-t border-outline-variant p-3"
          >
            <div className="flex gap-2">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={usadas >= LIMITE_DIA ? 'Limite de perguntas de hoje atingido' : 'Ex.: qual corredor mais cresceu em outubro?'}
                disabled={usadas >= LIMITE_DIA}
                className="h-10 min-w-0 flex-1 rounded-sm border border-outline-variant bg-surface px-3 text-sm text-on-surface outline-none focus:border-primary"
              />
              <button type="submit" disabled={pensando || !texto.trim()} className="h-10 rounded-sm bg-primary px-4 text-sm font-medium text-on-primary disabled:opacity-50">
                Enviar
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-on-surface-variant">
              {usadas}/{LIMITE_DIA} perguntas hoje · usa só dados agregados, nunca imagens
            </p>
          </form>
        </div>
      )}
    </>
  );
}
