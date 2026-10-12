'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Field';

// Exibição fluida: o motor manda (1) quadros JPEG originais no ritmo da
// fonte e (2) metadados da análise no ritmo da IA (3-5 fps), os dois
// com o timestamp da captura. Aqui o vídeo é tocado com um pequeno
// atraso fixo (o tempo da análise) e as caixas são interpoladas entre
// duas análises pelo tracker_id — o vídeo nunca espera a IA.

type Ponto = [number, number];
type Track = { id: number; b: [number, number, number, number]; c: number | null };
type Stats = {
  ocupacao_atual: number;
  ocupacao_zonas: { id: string; nome: string; ocupacao: number }[];
  linhas: { id: string; nome: string; entradas: number; saidas: number }[];
  visitantes_unicos_estimado: number;
  ids_criados: number;
  duracao_media_track_s: number | null;
  tracks_curtos_encerrados: number;
};
type Meta = {
  tipo: 'meta';
  ts: number;
  tracks: Track[];
  stats: Stats;
  debug: { fps_analise: number; fps_analise_alvo: number; inferencia_ms: number; latencia_ms: number; dispositivo: string; duracoes: Record<string, number> };
};
type Camera = {
  id: string;
  nome: string;
  online: boolean;
  erro: string | null;
  tipo_fonte: string;
  fps_fonte: number;
  fps_captura: number;
  fps_analise: number;
  sem_quadros_ha_s: number | null;
  resolucao: [number, number];
  linhas: { id: string; nome: string; inicio: Ponto; fim: Ponto }[];
  zonas: { id: string; nome: string; poligono: Ponto[] }[];
};
type QuadroBuf = { ts: number; bitmap: ImageBitmap };

const agoraS = () => (performance.timeOrigin + performance.now()) / 1000;

function corDoId(id: number): string {
  return `hsl(${(id * 137.508) % 360} 85% 55%)`;
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

export function AoVivoClient({ urlMotor }: { urlMotor: string }) {
  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [erroMotor, setErroMotor] = useState(false);
  const [cameraId, setCameraId] = useState<string>('');
  const [debug, setDebug] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [conectado, setConectado] = useState(false);
  const [fpsExibicao, setFpsExibicao] = useState(0);
  const [atrasoMs, setAtrasoMs] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const quadrosRef = useRef<QuadroBuf[]>([]);
  const metasRef = useRef<Meta[]>([]);
  const offsetRef = useRef<number | null>(null); // relógio local - relógio do motor
  const atrasoRef = useRef(0.4);
  const debugRef = useRef(debug);
  const cameraRef = useRef<Camera | undefined>(undefined);
  debugRef.current = debug;
  cameraRef.current = cameras?.find((c) => c.id === cameraId);

  // Lista de câmeras + status (a cada 2 s)
  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const res = await fetch(`${urlMotor}/api/cameras`);
        const lista: Camera[] = await res.json();
        if (!ativo) return;
        setCameras(lista);
        setErroMotor(false);
        setCameraId((atual) => atual || lista[0]?.id || '');
      } catch {
        if (ativo) setErroMotor(true);
      }
    }
    carregar();
    const t = setInterval(carregar, 2000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [urlMotor]);

  // WebSocket da câmera selecionada
  useEffect(() => {
    if (!cameraId) return;
    quadrosRef.current = [];
    metasRef.current = [];
    offsetRef.current = null;
    setMeta(null);

    const ws = new WebSocket(`${urlMotor.replace(/^http/, 'ws')}/ws/cameras/${cameraId}`);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => setConectado(true);
    ws.onclose = () => setConectado(false);
    ws.onmessage = async (ev) => {
      const chegada = agoraS();
      if (typeof ev.data === 'string') {
        const m: Meta = JSON.parse(ev.data);
        if (m.tipo !== 'meta') return;
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
      const W = q.bitmap.width;
      const H = q.bitmap.height;
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      ctx.drawImage(q.bitmap, 0, 0);

      const metas = metasRef.current;
      const fpsAlvo = metas.at(-1)?.debug.fps_analise_alvo || 4;
      const tracks = caixasNoInstante(metas, q.ts, 1 / fpsAlvo);
      const espessura = Math.max(2, W / 400);
      ctx.font = `600 ${Math.max(12, W / 70)}px system-ui, sans-serif`;
      for (const tr of tracks) {
        const [x1, y1, x2, y2] = [tr.b[0] * W, tr.b[1] * H, tr.b[2] * W, tr.b[3] * H];
        const cor = corDoId(tr.id);
        ctx.strokeStyle = cor;
        ctx.lineWidth = espessura;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        const texto = debugRef.current && tr.c !== null ? `#${tr.id} ${tr.c.toFixed(2)}` : `#${tr.id}`;
        const larguraTexto = ctx.measureText(texto).width + 8;
        const alturaTexto = Math.max(16, W / 55);
        ctx.fillStyle = cor;
        ctx.fillRect(x1 - espessura / 2, y1 - alturaTexto, larguraTexto, alturaTexto);
        ctx.fillStyle = '#000';
        ctx.fillText(texto, x1 + 4, y1 - alturaTexto * 0.25);
      }

      const cam = cameraRef.current;
      if (debugRef.current && cam) {
        ctx.lineWidth = espessura;
        for (const z of cam.zonas) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
          ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
          ctx.beginPath();
          z.poligono.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        for (const l of cam.linhas) {
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
          ctx.beginPath();
          ctx.moveTo(l.inicio[0] * W, l.inicio[1] * H);
          ctx.lineTo(l.fim[0] * W, l.fim[1] * H);
          ctx.stroke();
        }
      }
    }
    raf = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(raf);
  }, []);

  const zerar = useCallback(async () => {
    if (cameraId) await fetch(`${urlMotor}/api/cameras/${cameraId}/zerar`, { method: 'POST' });
  }, [cameraId, urlMotor]);

  if (erroMotor && !cameras) {
    return (
      <Card>
        <p className="text-sm text-on-surface">
          Não foi possível falar com o motor de visão em <code>{urlMotor}</code>.
        </p>
        <p className="mt-2 text-sm text-on-surface-variant">
          Rode em <code>visao-ia/</code>: <code>uv run uvicorn argus_visao.api:app --port 8500</code>
        </p>
      </Card>
    );
  }

  const cam = cameraRef.current;
  const s = meta?.stats;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <SelectField label="Câmera" value={cameraId} onChange={(e) => setCameraId(e.target.value)} className="w-80">
          {(cameras ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </SelectField>
        <Button variant="outline" size="sm" onClick={zerar}>
          Zerar contagens
        </Button>
        <label className="flex h-8 items-center gap-2 text-sm text-on-surface">
          <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />
          Modo debug
        </label>
        {cam && (
          <Badge variant={cam.online && conectado ? 'success' : 'error'}>
            {cam.online ? (conectado ? 'Ao vivo' : 'Conectando...') : 'Offline'}
          </Badge>
        )}
      </div>

      <div className="overflow-hidden rounded border border-outline-variant bg-black">
        <div className="relative">
          <canvas ref={canvasRef} className="block h-auto w-full" />
          {!meta && (
            <div className="absolute inset-0 flex min-h-64 items-center justify-center text-sm text-white/70">
              {cam?.erro ?? 'Aguardando vídeo e análise...'}
            </div>
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
              <div>FPS da fonte: {cam?.fps_fonte ?? '-'}</div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Pessoas na imagem agora" value={s?.ocupacao_atual ?? '-'} hint="Ocupação estimada" tone="primary" />
        {s?.linhas.map((l) => (
          <StatCard key={l.id} label={`Entradas · ${l.nome}`} value={l.entradas} hint={`Contagem por linha · ${l.saidas} saída(s)`} />
        ))}
        <StatCard label="Visitantes únicos" value={s?.visitantes_unicos_estimado ?? '-'} hint="Estimativa (sensível a troca de ID)" />
      </div>

      {s && s.ocupacao_zonas.length > 0 && (
        <Card>
          <h2 className="mb-3 text-base font-semibold text-on-surface">Ocupação por zona (estimada)</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {s.ocupacao_zonas.map((z) => (
              <li key={z.id} className="flex justify-between">
                <span>{z.nome}</span>
                <span className="font-semibold tabular-nums">{z.ocupacao}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {debug && meta && (
        <Card>
          <h2 className="mb-3 text-base font-semibold text-on-surface">Debug do rastreamento</h2>
          <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <span>IDs criados: <strong>{s?.ids_criados}</strong></span>
            <span>Duração média: <strong>{s?.duracao_media_track_s ?? '-'} s</strong></span>
            <span>Tracks curtos encerrados: <strong>{s?.tracks_curtos_encerrados}</strong></span>
            <span>Captura: <strong>{cam?.fps_captura} fps</strong></span>
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
