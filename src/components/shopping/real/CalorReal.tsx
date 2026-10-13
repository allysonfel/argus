'use client';

import { useMemo, useRef, useState } from 'react';
import { Numero, Secao, Tabela } from '@/components/shopping/Comum';
import { Planta } from '@/components/shopping/Planta';
import { desenharPessoas } from '@/components/shopping/casos/PlayerCaso';
import { ErroCaso } from '@/components/shopping/casos/useCaso';
import { partesDoNome } from '@/components/shopping/cameras/tipos';
import { POSICAO_NA_PLANTA } from '@/lib/shopping/casos';
import type { Andar } from '@/lib/shopping/planta';
import { Calor, amostras, carregarCamerasReais, desenharCalor, movimento, pessoasAgora, type CameraReal } from '@/lib/shopping/real';
import { MosaicoReal, useCamerasReais } from './MosaicoReal';

const botao = (ativo: boolean) =>
  `h-8 rounded-sm border px-3 text-xs font-medium transition-colors ${ativo ? 'border-primary bg-primary-container text-on-primary-container' : 'border-outline-variant text-on-surface hover:bg-surface-container-low'}`;

export function CalorReal({ urlMotor }: { urlMotor: string }) {
  const { cameras, erro } = useCamerasReais(urlMotor, carregarCamerasReais);
  const [modo, setModo] = useState<'acumulando' | 'inteiro'>('acumulando');
  const [pessoas, setPessoas] = useState(true);
  const [andarPlanta, setAndarPlanta] = useState<Andar>('T');
  // Uma grade por câmera, que soma conforme o vídeo anda; e a do vídeo inteiro.
  const calores = useRef(new Map<string, Calor>());
  const inteiros = useRef(new Map<string, Float32Array>());
  const offscreen = useRef<HTMLCanvasElement | null>(null);

  const ranking = useMemo(() => (cameras ?? []).map((c) => ({ c, mov: movimento(c.caso) })).sort((a, b) => b.mov - a.mov), [cameras]);
  const maxMov = ranking[0]?.mov || 1;

  if (erro) return <ErroCaso erro={erro} urlMotor={urlMotor} />;
  if (!cameras) return <p className="text-sm text-on-surface-variant">Carregando as câmeras…</p>;

  function desenhar(cam: CameraReal, ctx: CanvasRenderingContext2D, t: number, w: number, h: number, onde: 'mosaico' | 'ampliada') {
    if (!offscreen.current) offscreen.current = document.createElement('canvas');
    const id = cam.caso.camera;
    let grade: Float32Array;
    if (modo === 'inteiro') {
      if (!inteiros.current.has(id)) inteiros.current.set(id, new Calor(amostras(cam.caso)).somarAte(Infinity).slice());
      grade = inteiros.current.get(id)!;
    } else {
      const k = `${id}|${onde}`;
      if (!calores.current.has(k)) calores.current.set(k, new Calor(amostras(cam.caso)));
      grade = calores.current.get(k)!.somarAte(t);
    }
    desenharCalor(ctx, grade, w, h, offscreen.current);
    if (pessoas) desenharPessoas(ctx, cam.caso.pessoas, t, w, h, { rotular: () => null });
  }

  const doAndar = ranking.filter((r) => (POSICAO_NA_PLANTA[r.c.caso.camera]?.andar ?? r.c.caso.andar) === andarPlanta);

  return (
    <div className="flex flex-col gap-6">
      <Secao titulo="Calor nas câmeras" descricao="O vídeo real de cada câmera com o calor por cima: onde as pessoas passaram e ficaram (azul = pouco, vermelho = muito). Clique numa câmera para ampliar e arrastar no tempo.">
        <MosaicoReal
          urlMotor={urlMotor}
          cameras={cameras}
          desenhar={desenhar}
          legenda={(c, t) => `${pessoasAgora(c.caso, t)} na imagem agora · ${c.caso.pessoas.length} pessoas no vídeo`}
          controles={
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setModo('acumulando')} className={botao(modo === 'acumulando')}>
                Somando com o vídeo
              </button>
              <button onClick={() => setModo('inteiro')} className={botao(modo === 'inteiro')}>
                Vídeo inteiro
              </button>
              <button onClick={() => setPessoas(!pessoas)} className={botao(pessoas)}>
                Mostrar pessoas
              </button>
            </div>
          }
          detalhe={(c) => (
            <div className="grid grid-cols-2 gap-4">
              <Numero rotulo="Pessoas no vídeo" valor={c.caso.pessoas.length} detalhe={`em ${Math.round(c.caso.duracao_s)} s`} />
              <Numero rotulo="Movimento" valor={Math.round(movimento(c.caso))} detalhe="pessoas × segundos por minuto" />
            </div>
          )}
        />
      </Secao>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao
          titulo="Mapa das câmeras"
          descricao="Onde fica cada câmera de demonstração. Quanto mais forte o marcador, mais movimento ela registrou."
          className="xl:col-span-2"
          acao={
            <div className="flex rounded-sm bg-surface-container p-1">
              {(['T', 'P1'] as Andar[]).map((a) => (
                <button key={a} onClick={() => setAndarPlanta(a)} className={`h-8 rounded-sm px-3 text-sm font-medium ${andarPlanta === a ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
                  {a === 'T' ? 'Térreo' : 'Piso 1'}
                </button>
              ))}
            </div>
          }
        >
          <Planta
            andar={andarPlanta}
            marcadores={doAndar
              .filter((r) => POSICAO_NA_PLANTA[r.c.caso.camera])
              .map((r) => {
                const p = POSICAO_NA_PLANTA[r.c.caso.camera];
                const rel = r.mov / maxMov;
                return { x: p.x, y: p.y, rotulo: `${p.rotulo} · ${Math.round(r.mov)}`, tom: rel > 0.6 ? 'alerta' : rel > 0.25 ? 'info' : 'ok' };
              })}
          />
          <p className="mt-2 text-xs text-on-surface-variant">Número = pessoas × segundos por minuto de vídeo. Vermelho = mais movimento, azul = médio, verde = pouco.</p>
        </Secao>
        <Secao titulo="Câmeras, da mais para a menos movimentada">
          <Tabela
            cabecalho={['Câmera', 'Movimento']}
            alinharDireita={[1]}
            linhas={ranking.map((r) => [
              <span key="n" className="text-xs">
                {partesDoNome(r.c.caso.nome).codigo} {partesDoNome(r.c.caso.nome).titulo}
              </span>,
              <span key="v" className="flex items-center justify-end gap-2">
                <span className="hidden h-1.5 w-16 rounded-full bg-surface-container sm:inline-block">
                  <span className="block h-1.5 rounded-full bg-[var(--serie-1)]" style={{ width: `${(100 * r.mov) / maxMov}%` }} />
                </span>
                {Math.round(r.mov)}
              </span>,
            ])}
          />
        </Secao>
      </div>
    </div>
  );
}
