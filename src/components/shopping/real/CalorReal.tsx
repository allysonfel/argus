'use client';

import { useMemo, useRef, useState } from 'react';
import { Numero, Secao, Tabela } from '@/components/shopping/Comum';
import { desenharPessoas } from '@/components/shopping/casos/PlayerCaso';
import { ErroCaso } from '@/components/shopping/casos/useCaso';
import { partesDoNome } from '@/components/shopping/cameras/tipos';
import { Calor, amostras, carregarCamerasReais, desenharCalor, movimento, pessoasAgora, type CameraReal } from '@/lib/shopping/real';
import { MapaCameras } from './MapaCameras';
import { MosaicoReal, useCamerasReais } from './MosaicoReal';

const botao = (ativo: boolean) =>
  `h-8 rounded-sm border px-3 text-xs font-medium transition-colors ${ativo ? 'border-primary bg-primary-container text-on-primary-container' : 'border-outline-variant text-on-surface hover:bg-surface-container-low'}`;

export function CalorReal({ urlMotor }: { urlMotor: string }) {
  const { cameras, erro } = useCamerasReais(urlMotor, carregarCamerasReais);
  const [modo, setModo] = useState<'acumulando' | 'inteiro'>('acumulando');
  const [pessoas, setPessoas] = useState(true);
  const [aberta, setAberta] = useState<string | null>(null);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <Secao
          titulo="Mapa das câmeras"
          descricao="Planta montada só com as 15 câmeras de demonstração, cada uma no seu lugar do shopping. Sobre a imagem de cada câmera, o calor do vídeo inteiro (azul = pouco, vermelho = muito) e os pontos são as pessoas andando agora."
          className="xl:col-span-3"
        >
          <MapaCameras urlMotor={urlMotor} cameras={cameras} modo="calor" onAbrir={setAberta} />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
            <span>Pouco</span>
            <span className="h-2.5 w-48 rounded-full" style={{ background: 'linear-gradient(90deg, #3b82f6, #10b981, #facc15, #dc2626)' }} />
            <span>Muito movimento</span>
          </div>
        </Secao>
        <Secao titulo="Câmeras, da mais para a menos movimentada" descricao="Pessoas × segundos por minuto de vídeo">
          <Tabela
            cabecalho={['Câmera', 'Movimento']}
            alinharDireita={[1]}
            linhas={ranking.map((r) => [
              <button key="n" onClick={() => setAberta(r.c.caso.camera)} className="text-left text-xs hover:text-primary hover:underline">
                {partesDoNome(r.c.caso.nome).codigo} {partesDoNome(r.c.caso.nome).titulo}
              </button>,
              <span key="v" className="flex items-center justify-end gap-2">
                <span className="hidden h-1.5 w-12 rounded-full bg-surface-container sm:inline-block">
                  <span className="block h-1.5 rounded-full bg-[var(--serie-1)]" style={{ width: `${(100 * r.mov) / maxMov}%` }} />
                </span>
                {Math.round(r.mov)}
              </span>,
            ])}
          />
        </Secao>
      </div>

      <Secao titulo="Calor nas câmeras" descricao="O vídeo real de cada câmera com o calor por cima. Clique numa câmera para ampliar, arrastar no tempo, pôr em tela cheia ou baixar.">
        <MosaicoReal
          urlMotor={urlMotor}
          cameras={cameras}
          desenhar={desenhar}
          aberta={aberta}
          onAberta={setAberta}
          legenda={(c, t) => `${pessoasAgora(c.caso, t)} na imagem agora · ${c.caso.pessoas.length} pessoas no vídeo`}
          controles={
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setModo('acumulando')} className={botao(modo === 'acumulando')} title="O calor começa vazio e vai esquentando conforme o vídeo passa (recomeça quando o vídeo volta ao início)">
                Calor crescendo com o vídeo
              </button>
              <button onClick={() => setModo('inteiro')} className={botao(modo === 'inteiro')} title="Mostra de uma vez o calor do vídeo inteiro">
                Calor do vídeo inteiro
              </button>
              <button onClick={() => setPessoas(!pessoas)} className={botao(pessoas)} title="Liga/desliga as caixas em volta de cada pessoa">
                {pessoas ? 'Caixas das pessoas: ligadas' : 'Caixas das pessoas: desligadas'}
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
    </div>
  );
}
