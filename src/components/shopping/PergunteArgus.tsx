'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { perguntarArgus, type RespostaArgus } from '@/app/(sistema)/shopping/acoes';
import { LogoA } from './Logo';
import { GraficoBarras, GraficoLinhas } from './Graficos';
import { cn } from '@/lib/cn';

const SUGESTOES = ['Qual corredor mais cresceu em outubro?', 'Qual o horário de pico hoje?', 'Quantas pessoas estão no shopping agora?', 'Quais são as zonas mortas?', 'Quantas pessoas entraram hoje?'];
const LIMITE_DIA = 30;
const CHAVE_USO = 'argus-perguntas-uso';

type Mensagem = { de: 'voce'; texto: string } | { de: 'argus'; resposta: RespostaArgus };

function usoHoje(): number {
  try {
    const u = JSON.parse(localStorage.getItem(CHAVE_USO) || '{}');
    return u.dia === new Date().toISOString().slice(0, 10) ? u.n : 0;
  } catch {
    return 0;
  }
}

function registrarUso(n: number) {
  try {
    localStorage.setItem(CHAVE_USO, JSON.stringify({ dia: new Date().toISOString().slice(0, 10), n }));
  } catch {
    // sem localStorage: o limite só não persiste entre recarregamentos
  }
}

export function PergunteArgus() {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [usadas, setUsadas] = useState(0);
  const [pensando, iniciar] = useTransition();
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => setUsadas(usoHoje()), []);
  useEffect(() => fimRef.current?.scrollIntoView({ behavior: 'smooth' }), [mensagens, pensando]);

  function enviar(pergunta: string) {
    const q = pergunta.trim();
    if (!q || pensando || usadas >= LIMITE_DIA) return;
    setTexto('');
    setMensagens((m) => [...m, { de: 'voce', texto: q }]);
    const n = usadas + 1;
    setUsadas(n);
    registrarUso(n);
    iniciar(async () => {
      const resposta = await perguntarArgus(q);
      setMensagens((m) => [...m, { de: 'argus', resposta }]);
    });
  }

  return (
    <>
      <button
        onClick={() => setAberto((a) => !a)}
        aria-label="Pergunte ao Argus"
        title="Pergunte ao Argus"
        className="fixed bottom-5 right-5 z-50 flex print:hidden h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition-transform hover:scale-105"
      >
        <LogoA className={cn('h-6', pensando && 'animate-pulse')} />
      </button>

      {aberto && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[min(640px,calc(100vh-8rem))] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded border border-outline-variant bg-surface shadow-xl">
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
