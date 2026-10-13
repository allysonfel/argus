'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconePessoas, IconeSeta } from '@/components/ui/icones';
import { cn } from '@/lib/cn';
import { useMosaicoAoVivo } from './useMosaicoAoVivo';
import { localDaCamera, partesDoNome, pessoasNaImagem, type CameraMotor, type Ponto, type StatsCamera } from './tipos';

// Exibição fluida: o motor manda (1) quadros JPEG originais no ritmo da
// fonte e (2) metadados da análise no ritmo da IA (3-5 fps), os dois
// com o timestamp da captura. Aqui o vídeo é tocado com um pequeno
// atraso fixo (o tempo da análise) e as caixas são interpoladas entre
// duas análises pelo tracker_id — o vídeo nunca espera a IA.

// p = caminho da pessoa (pés, 0-1) desde que entrou na imagem.
// s = sumida: o detector perdeu a pessoa há um instante e a caixa é a
// posição prevista pelo motor (desenhada tracejada, pra não piscar).
type Track = { id: number; b: [number, number, number, number]; c: number | null; p?: Ponto[]; s?: 1 };
type Meta = {
  tipo: 'meta';
  ts: number;
  tracks: Track[];
  stats: StatsCamera;
  debug: { fps_analise: number; fps_analise_alvo: number; inferencia_ms: number; latencia_ms: number; dispositivo: string; duracoes: Record<string, number> };
};
type QuadroBuf = { ts: number; bitmap: ImageBitmap };

const agoraS = () => (performance.timeOrigin + performance.now()) / 1000;
// Caminhos de quem já saiu da imagem ficam desenhados por este tempo.
const CAMINHOS_RECENTES_S = 120;

type ModoCaminhos = 'desligado' | 'atuais' | 'recentes';
type CaminhoEncerrado = { id: number; pontos: Ponto[]; fim: number };

export function corDoId(id: number, alfa = 1): string {
  return `hsl(${(id * 137.508) % 360} 85% 55% / ${alfa})`;
}

function caixasNoInstante(metas: Meta[], t: number, intervaloAnalise: number): Track[] {
  let i = metas.length - 1;
  while (i >= 0 && metas[i].ts > t) i--;
  const m0 = metas[i];
  const m1 = metas[i + 1];
  if (!m0) return [];
  if (!m1) return t - m0.ts < intervaloAnalise * 1.5 ? m0.tracks : [];

  const a = Math.min(1, Math.max(0, (t - m0.ts) / (m1.ts - m0.ts)));
  const depois = new Map(m1.tracks.map((tr) => [tr.id, tr]));
  const resultado: Track[] = [];
  for (const tr of m0.tracks) {
    const prox = depois.get(tr.id);
    if (prox) {
      resultado.push({ ...prox, b: tr.b.map((v, k) => v + (prox.b[k] - v) * a) as Track['b'] });
      depois.delete(tr.id);
    } else if (a < 0.5) {
      resultado.push(tr);
    }
  }
  if (a >= 0.5) resultado.push(...depois.values());
  return resultado;
}

/** Caminho de cada pessoa na última análise até o instante t. */
function caminhosAte(metas: Meta[], t: number): Map<number, Ponto[]> {
  let i = metas.length - 1;
  while (i >= 0 && metas[i].ts > t) i--;
  return new Map((metas[i]?.tracks ?? []).map((tr) => [tr.id, tr.p ?? []]));
}

/** Linha suavizada (curvas pelos pontos médios), mais transparente no começo do caminho. */
function desenharCaminho(ctx: CanvasRenderingContext2D, pontos: Ponto[], W: number, H: number, id: number, largura: number, alfaMax: number) {
  if (pontos.length < 2) return;
  // Média móvel de 3 pontos: tira o tremido da base da caixa sem atrasar o fim da linha.
  const suave = pontos.map((p, i) => {
    if (i === 0 || i === pontos.length - 1) return p;
    return [(pontos[i - 1][0] + p[0] + pontos[i + 1][0]) / 3, (pontos[i - 1][1] + p[1] + pontos[i + 1][1]) / 3] as Ponto;
  });
  const px = suave.map(([x, y]) => [x * W, y * H] as const);
  ctx.lineWidth = largura;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  let [ax, ay] = px[0];
  for (let i = 1; i < px.length; i++) {
    const [x, y] = px[i];
    const [mx, my] = i < px.length - 1 ? [(x + px[i + 1][0]) / 2, (y + px[i + 1][1]) / 2] : [x, y];
    ctx.strokeStyle = corDoId(id, alfaMax * (0.15 + 0.85 * (i / (px.length - 1))));
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(x, y, mx, my);
    ctx.stroke();
    [ax, ay] = [mx, my];
  }
}

function rotulo(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, fundo: string, cor: string, tamanho: number) {
  ctx.font = `600 ${tamanho}px system-ui, sans-serif`;
  const largura = ctx.measureText(texto).width + tamanho * 0.8;
  const altura = tamanho * 1.5;
  ctx.fillStyle = fundo;
  ctx.beginPath();
  ctx.roundRect(x, y - altura, largura, altura, altura / 3);
  ctx.fill();
  ctx.fillStyle = cor;
  ctx.fillText(texto, x + tamanho * 0.4, y - altura * 0.3);
}

function Numero({ rotulo, valor, dica, destaque }: { rotulo: string; valor: string | number; dica?: string; destaque?: boolean }) {
  return (
    <div className="rounded border border-outline-variant bg-surface px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">{rotulo}</p>
      <p className={cn('mt-0.5 text-2xl font-semibold tabular-nums', destaque ? 'text-primary' : 'text-on-surface')}>{valor}</p>
      {dica && <p className="text-[11px] text-on-surface-variant">{dica}</p>}
    </div>
  );
}

export function CameraFoco({
  camera,
  cameras,
  urlMotor,
  onVoltar,
  onTrocar,
}: {
  camera: CameraMotor;
  /** Lista na ordem do mosaico (mesmos filtros): define anterior/próxima e a faixa de câmeras. */
  cameras: CameraMotor[];
  urlMotor: string;
  onVoltar: () => void;
  onTrocar: (id: string) => void;
}) {
  const cameraId = camera.id;
  const [debug, setDebug] = useState(false);
  const [geometria, setGeometria] = useState(true);
  const [modoCaminhos, setModoCaminhos] = useState<ModoCaminhos>('recentes');
  const [meta, setMeta] = useState<Meta | null>(null);
  const [conectado, setConectado] = useState(false);
  const [fpsExibicao, setFpsExibicao] = useState(0);
  const [atrasoMs, setAtrasoMs] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faixaAtivaRef = useRef<HTMLButtonElement>(null);
  const quadrosRef = useRef<QuadroBuf[]>([]);
  const metasRef = useRef<Meta[]>([]);
  const offsetRef = useRef<number | null>(null); // relógio local - relógio do motor
  const atrasoRef = useRef(0.4);
  const debugRef = useRef(debug);
  const geometriaRef = useRef(geometria);
  const modoCaminhosRef = useRef(modoCaminhos);
  const encerradosRef = useRef<CaminhoEncerrado[]>([]);
  const cameraRef = useRef(camera);
  debugRef.current = debug;
  geometriaRef.current = geometria;
  modoCaminhosRef.current = modoCaminhos;
  cameraRef.current = camera;

  const indice = cameras.findIndex((c) => c.id === cameraId);
  const anterior = indice > 0 ? cameras[indice - 1] : null;
  const proxima = indice >= 0 && indice < cameras.length - 1 ? cameras[indice + 1] : null;

  // Faixa com as outras câmeras: miniaturas leves, só pra trocar rápido.
  const registrar = useMosaicoAoVivo(
    urlMotor,
    cameras.filter((c) => c.online && c.id !== cameraId).map((c) => c.id),
    240,
    2
  );

  useEffect(() => {
    faixaAtivaRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [cameraId]);

  // Atalhos: Esc volta ao mosaico, ← → câmera anterior/próxima.
  const atalhos = useRef({ onVoltar, onTrocar, anterior, proxima });
  atalhos.current = { onVoltar, onTrocar, anterior, proxima };
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest('input, textarea, select')) return;
      const a = atalhos.current;
      if (e.key === 'Escape') a.onVoltar();
      else if (e.key === 'ArrowLeft' && a.anterior) a.onTrocar(a.anterior.id);
      else if (e.key === 'ArrowRight' && a.proxima) a.onTrocar(a.proxima.id);
      else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  // WebSocket da câmera em foco
  useEffect(() => {
    quadrosRef.current = [];
    metasRef.current = [];
    encerradosRef.current = [];
    offsetRef.current = null;
    setMeta(null);
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);

    const ws = new WebSocket(`${urlMotor.replace(/^http/, 'ws')}/ws/cameras/${cameraId}`);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => setConectado(true);
    ws.onclose = () => setConectado(false);
    ws.onmessage = async (ev) => {
      const chegada = agoraS();
      if (typeof ev.data === 'string') {
        const m: Meta = JSON.parse(ev.data);
        if (m.tipo !== 'meta') return;
        // Quem sumiu da imagem vira "caminho recente"; se o ID volta
        // (pessoa reencontrada), o caminho volta a ser o atual.
        const anterior = metasRef.current.at(-1);
        const presentes = new Set(m.tracks.map((tr) => tr.id));
        let encerrados = encerradosRef.current.filter((c) => !presentes.has(c.id) && m.ts - c.fim <= CAMINHOS_RECENTES_S);
        for (const tr of anterior?.tracks ?? []) {
          if (!presentes.has(tr.id) && (tr.p?.length ?? 0) >= 3) encerrados = [...encerrados.filter((c) => c.id !== tr.id), { id: tr.id, pontos: tr.p!, fim: anterior!.ts }];
        }
        encerradosRef.current = encerrados;
        metasRef.current.push(m);
        if (metasRef.current.length > 60) metasRef.current.shift();
        setMeta(m);
        // Atraso de exibição = quanto a análise demora pra chegar + folga.
        if (offsetRef.current !== null) {
          const atrasoMeta = chegada - offsetRef.current - m.ts;
          const alvo = Math.min(2.5, Math.max(0.25, atrasoMeta + 1 / Math.max(1, m.debug.fps_analise_alvo) + 0.1));
          atrasoRef.current = atrasoRef.current * 0.9 + alvo * 0.1;
        }
        return;
      }
      const ts = new DataView(ev.data, 0, 8).getFloat64(0, true);
      const bitmap = await createImageBitmap(new Blob([ev.data.slice(8)], { type: 'image/jpeg' }));
      // Offset = menor diferença observada (quadro que chegou mais rápido).
      const dif = chegada - ts;
      offsetRef.current = offsetRef.current === null ? dif : Math.min(offsetRef.current + 0.001, dif);
      quadrosRef.current.push({ ts, bitmap });
      if (quadrosRef.current.length > 150) quadrosRef.current.shift()?.bitmap.close();
    };
    return () => ws.close();
  }, [cameraId, urlMotor]);

  // Loop de desenho
  useEffect(() => {
    let raf = 0;
    let ultimoQuadroTs = 0;
    let contadorQuadros = 0;
    let janela = performance.now();

    function desenhar() {
      raf = requestAnimationFrame(desenhar);
      const canvas = canvasRef.current;
      const offset = offsetRef.current;
      if (!canvas || offset === null) return;
      const t = agoraS() - offset - atrasoRef.current;

      const quadros = quadrosRef.current;
      let idx = -1;
      for (let i = quadros.length - 1; i >= 0; i--) {
        if (quadros[i].ts <= t) {
          idx = i;
          break;
        }
      }
      if (idx < 0) return;
      const q = quadros[idx];
      for (const velho of quadros.splice(0, idx)) velho.bitmap.close();

      if (q.ts !== ultimoQuadroTs) {
        ultimoQuadroTs = q.ts;
        contadorQuadros++;
      }
      const agoraMs = performance.now();
      if (agoraMs - janela >= 1000) {
        setFpsExibicao(Math.round((contadorQuadros * 1000) / (agoraMs - janela)));
        setAtrasoMs(Math.round(atrasoRef.current * 1000));
        contadorQuadros = 0;
        janela = agoraMs;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // Vídeos pequenos (CCTV 384x288) são desenhados ampliados, pra
      // caixas e textos ficarem nítidos.
      const escala = q.bitmap.width < 800 ? 2 : 1;
      const W = q.bitmap.width * escala;
      const H = q.bitmap.height * escala;
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(q.bitmap, 0, 0, W, H);

      const metas = metasRef.current;
      const ultimaMeta = metas.at(-1);
      const fpsAlvo = ultimaMeta?.debug.fps_analise_alvo || 4;
      const tracks = caixasNoInstante(metas, q.ts, 1 / fpsAlvo);
      const espessura = Math.max(2, W / 400);
      const fonte = Math.max(12, W / 70);
      const cam = cameraRef.current;

      // Zonas e linhas de contagem (por baixo das pessoas)
      if (geometriaRef.current) {
        const stats = ultimaMeta?.stats;
        for (const z of cam.zonas) {
          const ocupacao = stats?.ocupacao_zonas.find((o) => o.id === z.id)?.ocupacao ?? 0;
          const alfa = Math.min(0.2, 0.06 + ocupacao * 0.025);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
          ctx.fillStyle = `rgba(56, 189, 248, ${alfa})`;
          ctx.lineWidth = espessura * 0.75;
          ctx.setLineDash([espessura * 3, espessura * 2]);
          ctx.beginPath();
          z.poligono.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);
          const [x0, y0] = z.poligono.reduce((m, p) => (p[1] < m[1] || (p[1] === m[1] && p[0] < m[0]) ? p : m));
          rotulo(ctx, `${z.nome} · ${ocupacao}`, x0 * W + espessura, Math.max(fonte * 1.6, y0 * H + fonte * 1.8), 'rgba(8, 47, 73, 0.85)', '#e0f2fe', fonte * 0.85);
        }
        for (const l of cam.linhas) {
          const cont = stats?.linhas.find((s) => s.id === l.id);
          const [x1, y1, x2, y2] = [l.inicio[0] * W, l.inicio[1] * H, l.fim[0] * W, l.fim[1] * H];
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
          ctx.lineWidth = espessura * 1.5;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          for (const [x, y] of [
            [x1, y1],
            [x2, y2],
          ]) {
            ctx.fillStyle = 'rgba(250, 204, 21, 1)';
            ctx.beginPath();
            ctx.arc(x, y, espessura * 2, 0, Math.PI * 2);
            ctx.fill();
          }
          const texto = cont ? `${l.nome}  ▲ ${cont.entradas}  ▼ ${cont.saidas}` : l.nome;
          rotulo(ctx, texto, (x1 + x2) / 2 - fonte * 3, (y1 + y2) / 2 - espessura * 3, 'rgba(66, 32, 6, 0.88)', '#fef08a', fonte * 0.85);
        }
      }

      // Caminhos: de quem já passou (finos, somem em 2 min) e de quem está na imagem
      const modo = modoCaminhosRef.current;
      if (modo === 'recentes') {
        for (const c of encerradosRef.current) {
          if (c.fim > q.ts) continue;
          const idade = Math.min(1, (q.ts - c.fim) / CAMINHOS_RECENTES_S);
          desenharCaminho(ctx, c.pontos, W, H, c.id, Math.max(1, espessura * 0.6), 0.55 * (1 - idade) + 0.1);
        }
      }
      if (modo !== 'desligado') {
        const caminhos = caminhosAte(metas, q.ts);
        for (const tr of tracks) {
          const pontos = caminhos.get(tr.id) ?? [];
          // termina no pé da caixa interpolada, pra linha acompanhar a pessoa
          desenharCaminho(ctx, [...pontos, [(tr.b[0] + tr.b[2]) / 2, tr.b[3]]], W, H, tr.id, espessura, 0.9);
        }
      }

      // Pessoas
      ctx.font = `600 ${fonte}px system-ui, sans-serif`;
      for (const tr of tracks) {
        const [x1, y1, x2, y2] = [tr.b[0] * W, tr.b[1] * H, tr.b[2] * W, tr.b[3] * H];
        const cor = corDoId(tr.id, tr.s ? 0.6 : 1);
        ctx.strokeStyle = cor;
        ctx.lineWidth = espessura;
        if (tr.s) ctx.setLineDash([espessura * 3, espessura * 2]);
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        ctx.setLineDash([]);
        ctx.fillStyle = cor;
        ctx.beginPath();
        ctx.ellipse((x1 + x2) / 2, y2, Math.max(espessura * 2, (x2 - x1) * 0.25), espessura * 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        const texto = debugRef.current && tr.c !== null ? `#${tr.id} ${tr.c.toFixed(2)}` : `#${tr.id}`;
        const larguraTexto = ctx.measureText(texto).width + 8;
        const alturaTexto = Math.max(16, W / 55);
        ctx.fillRect(x1 - espessura / 2, y1 - alturaTexto, larguraTexto, alturaTexto);
        ctx.fillStyle = '#000';
        ctx.fillText(texto, x1 + 4, y1 - alturaTexto * 0.25);
      }
    }
    raf = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(raf);
  }, []);

  const zerar = useCallback(async () => {
    encerradosRef.current = [];
    await fetch(`${urlMotor}/api/cameras/${cameraId}/zerar`, { method: 'POST' });
  }, [cameraId, urlMotor]);

  const s = meta?.stats;
  const { codigo, titulo } = partesDoNome(camera.nome);

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho do foco */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="sm" onClick={onVoltar} title="Voltar ao mosaico (Esc)">
            <span className="flex items-center gap-1">
              <IconeSeta className="rotate-180" width={14} height={14} />
              Todas as câmeras
            </span>
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold text-on-surface">
                {codigo && <span className="mr-1.5 font-mono text-sm text-on-surface-variant">{codigo}</span>}
                {titulo}
              </h2>
              <Badge variant={camera.online && conectado ? 'success' : 'error'}>{camera.online ? (conectado ? 'Ao vivo' : 'Conectando...') : 'Offline'}</Badge>
            </div>
            <p className="truncate text-xs text-on-surface-variant">{localDaCamera(camera)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!anterior}
            onClick={() => anterior && onTrocar(anterior.id)}
            title={anterior ? `Anterior: ${anterior.nome} (←)` : undefined}
            className="flex h-8 items-center gap-1 rounded-sm border border-outline-variant bg-surface px-2 text-xs text-on-surface hover:bg-surface-container-low disabled:opacity-40"
          >
            <IconeSeta className="rotate-180" width={14} height={14} />
            Anterior
          </button>
          <span className="px-2 text-xs tabular-nums text-on-surface-variant">
            {indice + 1} de {cameras.length}
          </span>
          <button
            type="button"
            disabled={!proxima}
            onClick={() => proxima && onTrocar(proxima.id)}
            title={proxima ? `Próxima: ${proxima.nome} (→)` : undefined}
            className="flex h-8 items-center gap-1 rounded-sm border border-outline-variant bg-surface px-2 text-xs text-on-surface hover:bg-surface-container-low disabled:opacity-40"
          >
            Próxima
            <IconeSeta width={14} height={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Vídeo */}
        <div className="min-w-0">
          <div className="overflow-hidden rounded border border-outline-variant bg-black">
            <div className="relative">
              <canvas ref={canvasRef} className="mx-auto block aspect-video h-auto w-full object-contain" />
              {!meta && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">{camera.erro ?? 'Aguardando vídeo e análise...'}</div>
              )}
              {debug && (
                <div className="absolute left-2 top-2 rounded-sm bg-black/70 px-3 py-2 font-mono text-xs leading-5 text-white">
                  <div>FPS exibição: {fpsExibicao}</div>
                  <div>
                    FPS análise: {meta?.debug.fps_analise ?? '-'} (alvo {meta?.debug.fps_analise_alvo ?? '-'})
                  </div>
                  <div>Inferência: {meta?.debug.inferencia_ms ?? '-'} ms · {meta?.debug.dispositivo}</div>
                  <div>Latência análise: {meta?.debug.latencia_ms ?? '-'} ms</div>
                  <div>Atraso de exibição: {atrasoMs} ms</div>
                  <div>FPS da fonte: {camera.fps_fonte}</div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-on-surface-variant">{camera.credito ? `Fonte da imagem: ${camera.credito}` : ' '}</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-on-surface" role="group" aria-label="Caminhos das pessoas">
                <span>Caminhos</span>
                <div className="flex overflow-hidden rounded-sm border border-outline-variant">
                  {(
                    [
                      ['desligado', 'Desligado', 'Sem caminhos'],
                      ['atuais', 'Na imagem', 'Caminho de quem está na imagem agora'],
                      ['recentes', 'Últimos 2 min', 'Também o caminho de quem passou nos últimos 2 minutos'],
                    ] as const
                  ).map(([valor, rotuloBotao, dica]) => (
                    <button
                      key={valor}
                      type="button"
                      title={dica}
                      aria-pressed={modoCaminhos === valor}
                      onClick={() => setModoCaminhos(valor)}
                      className={cn(
                        'h-7 px-2 text-xs transition-colors',
                        modoCaminhos === valor ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface-variant hover:bg-surface-container-low'
                      )}
                    >
                      {rotuloBotao}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-on-surface">
                <input type="checkbox" checked={geometria} onChange={(e) => setGeometria(e.target.checked)} />
                Linhas e zonas
              </label>
              <label className="flex items-center gap-1.5 text-xs text-on-surface">
                <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />
                Modo debug
              </label>
              <Button variant="outline" size="sm" onClick={zerar}>
                Zerar contagens
              </Button>
            </div>
          </div>
        </div>

        {/* Números da câmera */}
        <div className="flex flex-col gap-3">
          <Numero rotulo="Pessoas na imagem agora" valor={s?.ocupacao_atual ?? '-'} dica="Ocupação estimada" destaque />
          {s?.linhas.map((l) => (
            <Numero key={l.id} rotulo={l.nome} valor={l.entradas + l.saidas} dica={`${l.entradas} num sentido (▲) · ${l.saidas} no outro (▼)`} />
          ))}
          <Numero rotulo="Visitantes únicos" valor={s?.visitantes_unicos_estimado ?? '-'} dica="Estimativa (sensível a troca de ID)" />
          {s && s.ocupacao_zonas.length > 0 && (
            <div className="rounded border border-outline-variant bg-surface px-4 py-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">Ocupação por zona</p>
              <ul className="flex flex-col gap-2.5 text-sm">
                {s.ocupacao_zonas.map((z) => {
                  const maximo = Math.max(1, ...s.ocupacao_zonas.map((o) => o.ocupacao));
                  return (
                    <li key={z.id}>
                      <div className="mb-1 flex justify-between gap-2">
                        <span className="truncate text-on-surface">{z.nome}</span>
                        <span className="font-semibold tabular-nums text-on-surface">{z.ocupacao}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-container">
                        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(z.ocupacao / maximo) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Faixa de câmeras para trocar rápido */}
      <div>
        <p className="mb-2 text-xs font-medium text-on-surface-variant">Outras câmeras · clique para trocar (ou use ← →)</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 pt-1">
          {cameras.map((c) => {
            const ativa = c.id === cameraId;
            const { codigo: cod, titulo: tit } = partesDoNome(c.nome);
            return (
              <button
                key={c.id}
                ref={ativa ? faixaAtivaRef : undefined}
                type="button"
                onClick={() => onTrocar(c.id)}
                aria-current={ativa}
                className={cn(
                  'cartao-clicavel relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-neutral-900 text-left',
                  ativa ? 'ring-2 ring-primary' : 'opacity-80 hover:opacity-100'
                )}
              >
                {c.online && !ativa && <img ref={registrar(c.id)} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                {ativa && <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white/80">Assistindo</span>}
                {!c.online && <span className="absolute inset-0 flex items-center justify-center text-[11px] text-white/60">Sem sinal</span>}
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-3 text-[10px] text-white">
                  <span className="truncate">
                    {cod && <span className="font-mono">{cod} </span>}
                    {tit}
                  </span>
                  {c.online && (
                    <span className="flex shrink-0 items-center gap-0.5 tabular-nums">
                      <IconePessoas width={11} height={11} />
                      {pessoasNaImagem(c)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {debug && meta && (
        <Card>
          <h2 className="mb-3 text-base font-semibold text-on-surface">Debug do rastreamento</h2>
          <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <span>IDs criados: <strong>{s?.ids_criados}</strong></span>
            <span>Duração média: <strong>{s?.duracao_media_track_s ?? '-'} s</strong></span>
            <span>Tracks curtos encerrados: <strong>{s?.tracks_curtos_encerrados}</strong></span>
            <span>IDs reencontrados: <strong>{s?.ids_costurados ?? 0}</strong></span>
            <span>Trocas desfeitas (Re-ID): <strong>{s?.trocas_desfeitas ?? 0}</strong></span>
          </div>
          <p className="mb-2 text-xs text-on-surface-variant">Duração de cada track ativo (s):</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(meta.debug.duracoes).map(([id, d]) => (
              <span key={id} className="rounded-sm px-2 py-0.5 font-mono text-xs text-black" style={{ background: corDoId(Number(id)) }}>
                #{id} {d}s
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
