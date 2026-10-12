'use client';

import { useMemo, useRef, useState } from 'react';
import { Numero, Secao, Tabela } from '@/components/shopping/Comum';
import { Planta } from '@/components/shopping/Planta';
import { Badge } from '@/components/ui/Badge';
import { LOJA, POSICAO_NA_PLANTA, dentro, fmtSeg, fmtTempo, pe, tempoDentro, type Caso, type PessoaCaso } from '@/lib/shopping/casos';
import { PlayerCaso, desenharArea, desenharPessoas } from './PlayerCaso';
import { ErroCaso, useCaso } from './useCaso';

type Evento = { t: number; pessoa: number; tipo: 'entrou' | 'saiu' | 'vitrine'; texto: string };

function analisar(caso: Caso) {
  const fim = caso.duracao_s;
  const porPessoa = caso.pessoas.map((p) => {
    const primeiro = pe(p.pontos[0]);
    const ultimo = pe(p.pontos[p.pontos.length - 1]);
    const naFrente = p.pontos.some((pt) => dentro(pe(pt), LOJA.vitrine.poligono) || dentro(pe(pt), LOJA.porta.poligono));
    const vitrineS = tempoDentro(p, LOJA.vitrine.poligono);
    // Entrou: sumiu da imagem encostado na fachada (não no fim do vídeo).
    const entrou = dentro(ultimo, LOJA.porta.poligono) && (p.saida < fim - 1 || ultimo[0] < 0.22);
    // Saiu da loja: apareceu na imagem já encostado na fachada.
    const saiu = dentro(primeiro, LOJA.porta.poligono) && p.entrada > 1;
    return { p, naFrente, vitrineS, parou: vitrineS >= LOJA.permanenciaMinS, entrou, saiu };
  });
  const eventos: Evento[] = [];
  for (const r of porPessoa) {
    if (r.entrou) eventos.push({ t: r.p.saida, pessoa: r.p.id, tipo: 'entrou', texto: `#${r.p.id} entrou na loja` });
    if (r.saiu) eventos.push({ t: r.p.entrada, pessoa: r.p.id, tipo: 'saiu', texto: `#${r.p.id} saiu da loja` });
    if (r.parou) {
      const ini = r.p.pontos.find((pt) => dentro(pe(pt), LOJA.vitrine.poligono))?.[0] ?? r.p.entrada;
      eventos.push({ t: ini, pessoa: r.p.id, tipo: 'vitrine', texto: `#${r.p.id} ficou ${fmtSeg(r.vitrineS)} na vitrine` });
    }
  }
  eventos.sort((a, b) => a.t - b.t);
  return { porPessoa, eventos };
}

const COR_EVENTO = { entrou: '#f59e0b', saiu: '#8b5cf6', vitrine: '#10b981' };

export function CasoLoja({ urlMotor }: { urlMotor: string }) {
  const { caso, erro } = useCaso(urlMotor, LOJA.camera);
  const { caso: fachada } = useCaso(urlMotor, LOJA.cameraFachada);
  const [t, setT] = useState(0);
  const [irPara, setIrPara] = useState<{ t: number; k: number } | null>(null);
  const [foco, setFoco] = useState<number | null>(null);
  const videoFachada = useRef<HTMLVideoElement>(null);
  const sincronizar = useMemo(() => [videoFachada], []);
  const analise = useMemo(() => (caso ? analisar(caso) : null), [caso]);

  if (erro) return <ErroCaso erro={erro} urlMotor={urlMotor} />;
  if (!caso || !analise) return <div className="flex aspect-video items-center justify-center rounded-sm bg-surface-container text-sm text-on-surface-variant">Carregando o caso…</div>;

  const ate = analise.porPessoa.filter((r) => r.p.entrada <= t);
  const funil = [
    { rotulo: 'Passaram pelo corredor', valor: ate.length, gabarito: LOJA.gabarito.pessoas },
    { rotulo: 'Passaram em frente à loja', valor: ate.filter((r) => r.naFrente).length, gabarito: null },
    { rotulo: `Ficaram ${LOJA.permanenciaMinS} s ou mais na vitrine`, valor: analise.eventos.filter((e) => e.tipo === 'vitrine' && e.t <= t).length, gabarito: LOJA.gabarito.pararamVitrine },
    { rotulo: 'Entraram na loja', valor: analise.eventos.filter((e) => e.tipo === 'entrou' && e.t <= t).length, gabarito: LOJA.gabarito.entradas },
    { rotulo: 'Saíram da loja', valor: analise.eventos.filter((e) => e.tipo === 'saiu' && e.t <= t).length, gabarito: LOJA.gabarito.saidas },
  ];
  const fimDoVideo = t >= caso.duracao_s - 1;
  const pos = POSICAO_NA_PLANTA[caso.camera];

  function ir(e: Evento) {
    setFoco(e.pessoa);
    setIrPara({ t: Math.max(0, e.t - 2), k: Date.now() });
  }

  const rotular = (p: PessoaCaso) => {
    const r = analise.porPessoa.find((x) => x.p.id === p.id)!;
    const naVitrine = tempoDentro(p, LOJA.vitrine.poligono, t);
    if (naVitrine >= 3 && dentro(pe(p.pontos.find((pt) => pt[0] >= t) ?? p.pontos[p.pontos.length - 1]), LOJA.vitrine.poligono)) return `#${p.id} · vitrine ${Math.round(naVitrine)} s`;
    if (r.entrou && p.saida - t < 3) return `#${p.id} · entrando`;
    if (r.saiu && t - p.entrada < 3) return `#${p.id} · saindo`;
    return `#${p.id}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao
          titulo={`${LOJA.nomeLoja} · quem passa, quem olha e quem entra`}
          descricao="Câmera de segurança real (corredor). A faixa laranja é a fachada com as portas; a verde, a frente da vitrine."
          className="xl:col-span-2"
        >
          <PlayerCaso
            urlMotor={urlMotor}
            caso={caso}
            irPara={irPara}
            onTempo={setT}
            sincronizar={sincronizar}
            marcas={analise.eventos.map((e) => ({ t: e.t, rotulo: e.texto, tom: COR_EVENTO[e.tipo] }))}
            desenhar={(ctx, tt, w, h) => {
              desenharArea(ctx, LOJA.porta, w, h);
              desenharArea(ctx, LOJA.vitrine, w, h);
              desenharPessoas(ctx, caso.pessoas, tt, w, h, { rastroS: 4, rotular, destaque: foco ? new Set([foco]) : null });
            }}
            rodape={<span>Bolinhas na barra = eventos (clique para ver)</span>}
          />
          {fachada && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,240px)_1fr]">
              <div className="relative overflow-hidden rounded-sm bg-black" style={{ aspectRatio: `${fachada.largura} / ${fachada.altura}` }}>
                <video ref={videoFachada} src={`${urlMotor}/casos/${fachada.video}`} muted playsInline loop crossOrigin="anonymous" className="absolute inset-0 h-full w-full" />
              </div>
              <p className="text-xs leading-relaxed text-on-surface-variant">
                <b className="text-on-surface">Mesmo momento, pela câmera da fachada (CAM 04).</b> As duas câmeras são sincronizadas: dá pra conferir por outro ângulo quem entrou na loja. Na operação real, a câmera da fachada confirma a entrada e o corredor mede a vitrine.
              </p>
            </div>
          )}
        </Secao>

        <div className="flex flex-col gap-6">
          <Secao titulo="Funil da loja" descricao={fimDoVideo ? 'Vídeo inteiro (94 s)' : `Até ${fmtTempo(t)} do vídeo · deixe tocar até o fim`}>
            <div className="flex flex-col gap-3">
              {funil.map((f, i) => (
                <div key={f.rotulo}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-on-surface">{f.rotulo}</span>
                    <span className="text-lg font-semibold tabular-nums text-on-surface">{f.valor}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-container">
                    <div className="h-2 rounded-full bg-[var(--serie-1)] transition-all" style={{ width: `${funil[0].valor ? (100 * f.valor) / Math.max(funil[0].valor, 1) : 0}%`, opacity: 1 - i * 0.12 }} />
                  </div>
                  {fimDoVideo && f.gabarito !== null && (
                    <p className="mt-0.5 text-[11px] text-on-surface-variant">
                      Contagem manual (gabarito CAVIAR): <b className="text-on-surface">{f.gabarito}</b>
                    </p>
                  )}
                </div>
              ))}
            </div>
            {ate.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-outline-variant pt-4">
                <Numero rotulo="Taxa de atração" valor={`${Math.round((100 * funil[2].valor) / Math.max(1, funil[1].valor))}%`} detalhe="ficaram na vitrine / passaram em frente" />
                <Numero rotulo="Taxa de entrada" valor={`${Math.round((100 * funil[3].valor) / Math.max(1, funil[0].valor))}%`} detalhe="entraram / passaram pelo corredor" />
              </div>
            )}
          </Secao>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao titulo="Eventos" descricao="Clique para ver no vídeo" className="xl:col-span-2">
          <Tabela
            cabecalho={['Momento', 'O que aconteceu', '']}
            linhas={analise.eventos.map((e) => [
              <span key="t" className="tabular-nums">{fmtTempo(e.t)}</span>,
              <span key="x" className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_EVENTO[e.tipo] }} />
                {e.texto}
              </span>,
              <button key="b" onClick={() => ir(e)} className="text-xs font-medium text-primary hover:underline">
                Ver no vídeo
              </button>,
            ])}
          />
        </Secao>
        <Secao titulo="Como cada número é medido">
          <ul className="flex list-disc flex-col gap-2 pl-4 text-xs leading-relaxed text-on-surface-variant">
            <li><b className="text-on-surface">Entrou</b>: a pessoa some da imagem encostada na fachada da loja.</li>
            <li><b className="text-on-surface">Saiu</b>: a pessoa aparece na imagem já encostada na fachada.</li>
            <li><b className="text-on-surface">Vitrine</b>: tempo somado na faixa verde. No fundo do corredor quem caminha em direção à câmera parece parado, então só a parte mais próxima conta.</li>
            <li>
              Diferenças para o gabarito vêm de pessoas encobertas por outras (o rastreio às vezes as conta duas vezes) e da resolução baixa da câmera (384×288). <Badge>CCTV real de 2004</Badge>
            </li>
          </ul>
          {pos && (
            <div className="mt-4">
              <p className="mb-1 text-xs text-on-surface-variant">Onde fica a câmera</p>
              <Planta andar={pos.andar} marcadores={[{ x: pos.x, y: pos.y, rotulo: pos.rotulo, tom: 'info' }]} />
            </div>
          )}
        </Secao>
      </div>
    </div>
  );
}
