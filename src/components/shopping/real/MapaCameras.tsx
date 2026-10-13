'use client';

import { useEffect, useRef, useState } from 'react';
import { partesDoNome } from '@/components/shopping/cameras/tipos';
import { corDoId } from '@/components/shopping/cameras/CameraFoco';
import { caixaEm, pe, type Caso } from '@/lib/shopping/casos';
import { Calor, GH, GW, PONTO_LADO, amostras, corCalor, fluxos, indiceZonasReais, type CameraReal } from '@/lib/shopping/real';
import { VELOCIDADES_REAIS } from './MosaicoReal';

// MAPA DAS CÂMERAS: uma planta montada do zero só com as 15 câmeras de
// demonstração. Cada câmera vira um "pedaço" da planta no lugar onde fica
// no shopping, com a imagem dela de fundo e, por cima, o que o motor viu
// (calor, caminhos ou zonas) e as pessoas andando no tempo do vídeo.
// Não é uma projeção calibrada no piso: é a imagem da câmera encaixada no
// mapa, pra ver o shopping inteiro de uma vez.

type Andar = 'T' | 'P1';
type Lugar = { andar: Andar; x: number; y: number };

// Posição de cada câmera (canto superior esquerdo) na planta 1000 x 560.
const LUGARES: Record<string, Lugar> = {
  'demo-caviar-corredor': { andar: 'T', x: 300, y: 30 },
  'demo-caviar-fachada': { andar: 'T', x: 470, y: 30 },
  'demo-atrio-decorado': { andar: 'T', x: 60, y: 196 },
  'demo-praca-central': { andar: 'T', x: 290, y: 196 },
  'demo-escadas-rolantes': { andar: 'T', x: 520, y: 196 },
  'demo-corredor-lojas': { andar: 'T', x: 750, y: 196 },
  'demo-hiper-caixas': { andar: 'T', x: 300, y: 392 },
  'demo-hiper-autoatendimento': { andar: 'T', x: 510, y: 392 },
  'demo-praca-alimentacao': { andar: 'P1', x: 170, y: 30 },
  'demo-quiosques': { andar: 'P1', x: 400, y: 30 },
  'demo-fast-food': { andar: 'P1', x: 630, y: 30 },
  'demo-atrio-aereo': { andar: 'P1', x: 170, y: 206 },
  'demo-mezanino': { andar: 'P1', x: 400, y: 206 },
  'demo-corredor-gastronomico': { andar: 'P1', x: 690, y: 206 },
  'demo-area-eventos': { andar: 'P1', x: 400, y: 392 },
};

// Piso: áreas de circulação desenhadas por baixo das câmeras.
const PISO: Record<Andar, { x: number; y: number; w: number; h: number; nome: string; nx: number; ny: number }[]> = {
  T: [
    { x: 280, y: 14, w: 360, h: 175, nome: 'Ala Norte', nx: 290, ny: 160 },
    { x: 36, y: 182, w: 928, h: 140, nome: 'Corredor principal · Praça Central', nx: 46, ny: 316 },
    { x: 280, y: 322, w: 440, h: 190, nome: 'Ala Sul · Hipermercado', nx: 290, ny: 506 },
  ],
  P1: [
    { x: 150, y: 14, w: 700, h: 150, nome: 'Praça de Alimentação', nx: 160, ny: 158 },
    { x: 36, y: 192, w: 928, h: 135, nome: 'Mezanino · corredores do Piso 1', nx: 46, ny: 322 },
    { x: 380, y: 327, w: 240, h: 190, nome: 'Ala Cinema', nx: 390, ny: 512 },
  ],
};

const ANDAR_NOME: Record<Andar, string> = { T: 'Térreo', P1: 'Piso 1' };

function tamanho(caso: Caso): { w: number; h: number } {
  return caso.largura / caso.altura < 1.5 ? { w: 150, h: 112 } : { w: 190, h: 107 };
}

export type ModoMapa = 'calor' | 'rotas' | 'zonas';

export function MapaCameras({ urlMotor, cameras, modo, onAbrir, limiteZona = 0.4 }: { urlMotor: string; cameras: CameraReal[]; modo: ModoMapa; onAbrir?: (camera: string) => void; limiteZona?: number }) {
  const [andar, setAndar] = useState<Andar>('T');
  const [tocando, setTocando] = useState(true);
  const [vel, setVel] = useState(1);
  const canvas = useRef<HTMLCanvasElement>(null);
  const relogio = useRef(0);
  const imagens = useRef(new Map<string, HTMLImageElement>());
  const calores = useRef(new Map<string, Float32Array>());
  const offscreen = useRef<HTMLCanvasElement | null>(null);
  const props = useRef({ andar, tocando, vel, cameras, modo, limiteZona });
  props.current = { andar, tocando, vel, cameras, modo, limiteZona };
  const [hover, setHover] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  hoverRef.current = hover;

  useEffect(() => {
    for (const c of cameras) {
      if (imagens.current.has(c.caso.camera)) continue;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = `${urlMotor}/casos/miniaturas/${c.caso.camera}.jpg`;
      imagens.current.set(c.caso.camera, img);
    }
  }, [cameras, urlMotor]);

  useEffect(() => {
    let raf = 0;
    let ultimo = performance.now();
    const indices = new Map<string, ReturnType<typeof indiceZonasReais>>();
    const desenhar = (agora: number) => {
      const { andar, tocando, vel, cameras, modo, limiteZona } = props.current;
      if (tocando) relogio.current += ((agora - ultimo) / 1000) * vel;
      ultimo = agora;
      const c = canvas.current;
      if (c) {
        const w = c.clientWidth;
        const dpr = window.devicePixelRatio || 1;
        if (c.width !== Math.round(w * dpr)) {
          c.width = Math.round(w * dpr);
          c.height = Math.round(w * 0.56 * dpr);
        }
        const ctx = c.getContext('2d')!;
        ctx.setTransform((dpr * w) / 1000, 0, 0, (dpr * w) / 1000, 0, 0);
        ctx.clearRect(0, 0, 1000, 560);

        // Piso
        for (const a of PISO[andar]) {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(a.x, a.y, a.w, a.h, 10);
          ctx.fill();
          ctx.stroke();
          ctx.font = '600 11px system-ui, sans-serif';
          ctx.fillStyle = 'rgba(100, 116, 139, 0.95)';
          ctx.fillText(a.nome.toUpperCase(), a.nx, a.ny);
        }

        if (modo === 'zonas' && !indices.size) for (const z of indiceZonasReais(cameras)) indices.set(z.cam.caso.camera, [...(indices.get(z.cam.caso.camera) ?? []), z]);

        for (const cam of cameras) {
          const lugar = LUGARES[cam.caso.camera];
          if (!lugar || lugar.andar !== andar) continue;
          const { w: rw, h: rh } = tamanho(cam.caso);
          const { x, y } = lugar;
          const t = relogio.current % Math.max(1, cam.caso.duracao_s);
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(x, y, rw, rh, 6);
          ctx.clip();
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(x, y, rw, rh);
          const img = imagens.current.get(cam.caso.camera);
          if (img?.complete && img.naturalWidth) {
            ctx.globalAlpha = 0.6;
            ctx.drawImage(img, x, y, rw, rh);
            ctx.globalAlpha = 1;
          }

          if (modo === 'calor') {
            if (!calores.current.has(cam.caso.camera)) calores.current.set(cam.caso.camera, new Calor(amostras(cam.caso)).somarAte(Infinity).slice());
            const grade = calores.current.get(cam.caso.camera)!;
            if (!offscreen.current) offscreen.current = document.createElement('canvas');
            const o = offscreen.current;
            o.width = GW;
            o.height = GH;
            const octx = o.getContext('2d')!;
            const imgData = octx.createImageData(GW, GH);
            let max = 0;
            for (let i = 0; i < grade.length; i++) max = Math.max(max, grade[i]);
            for (let i = 0; i < grade.length && max; i++) {
              const v = grade[i] / max;
              if (v >= 0.04) imgData.data.set(corCalor(Math.sqrt(v)), i * 4);
            }
            octx.putImageData(imgData, 0, 0);
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(o, x, y, rw, rh);
          }

          if (modo === 'zonas') {
            for (const z of indices.get(cam.caso.camera) ?? []) {
              const morta = z.indice < limiteZona;
              ctx.beginPath();
              z.zona.poligono.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * rw, y + py * rh) : ctx.moveTo(x + px * rw, y + py * rh)));
              ctx.closePath();
              ctx.fillStyle = z.indice < 0.4 ? 'rgba(220,38,38,0.45)' : z.indice < 0.9 ? 'rgba(248,113,113,0.32)' : z.indice <= 1.1 ? 'rgba(226,232,240,0.25)' : 'rgba(59,130,246,0.38)';
              ctx.fill();
              ctx.lineWidth = morta ? 2.5 : 1;
              ctx.strokeStyle = morta ? '#dc2626' : 'rgba(255,255,255,0.7)';
              ctx.stroke();
            }
          }

          if (modo === 'rotas') {
            // Caminho de todo mundo que já passou nesta volta do vídeo (fino) ...
            for (const p of cam.caso.pessoas) {
              if (p.entrada > t) continue;
              ctx.beginPath();
              let primeiro = true;
              for (const pt of p.pontos) {
                if (pt[0] > t) break;
                const [fx, fy] = pe(pt);
                if (primeiro) ctx.moveTo(x + fx * rw, y + fy * rh);
                else ctx.lineTo(x + fx * rw, y + fy * rh);
                primeiro = false;
              }
              const naImagem = t <= p.saida + 0.5;
              ctx.strokeStyle = corDoId(p.id, naImagem ? 0.95 : 0.3);
              ctx.lineWidth = naImagem ? 1.8 : 1;
              ctx.stroke();
            }
            // ... e as setas dos fluxos principais.
            const fs = fluxos(cam.caso).filter((f) => f.de !== f.para && f.de !== 'meio' && f.para !== 'meio').slice(0, 2);
            const maxF = fs[0]?.pessoas.length || 1;
            for (const f of fs) {
              const [ax, ay] = PONTO_LADO[f.de];
              const [bx, by] = PONTO_LADO[f.para];
              const larg = 2 + (4 * f.pessoas.length) / maxF;
              const ang = Math.atan2((by - ay) * rh, (bx - ax) * rw);
              ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
              ctx.fillStyle = 'rgba(250, 204, 21, 0.9)';
              ctx.lineWidth = larg;
              ctx.beginPath();
              ctx.moveTo(x + ax * rw, y + ay * rh);
              ctx.lineTo(x + bx * rw - Math.cos(ang) * larg * 2, y + by * rh - Math.sin(ang) * larg * 2);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(x + bx * rw, y + by * rh);
              ctx.lineTo(x + bx * rw - Math.cos(ang - 0.5) * larg * 3, y + by * rh - Math.sin(ang - 0.5) * larg * 3);
              ctx.lineTo(x + bx * rw - Math.cos(ang + 0.5) * larg * 3, y + by * rh - Math.sin(ang + 0.5) * larg * 3);
              ctx.fill();
            }
          }

          // Pessoas agora (pontos nos pés)
          let agoraN = 0;
          for (const p of cam.caso.pessoas) {
            const cx = caixaEm(p, t);
            if (!cx) continue;
            agoraN++;
            ctx.beginPath();
            ctx.arc(x + ((cx[0] + cx[2]) / 2) * rw, y + cx[3] * rh, 3, 0, Math.PI * 2);
            ctx.fillStyle = corDoId(p.id);
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
          }
          ctx.restore();

          // Moldura + rótulo
          ctx.lineWidth = hoverRef.current === cam.caso.camera ? 3 : 1.5;
          ctx.strokeStyle = hoverRef.current === cam.caso.camera ? '#2563eb' : 'rgba(15, 23, 42, 0.55)';
          ctx.beginPath();
          ctx.roundRect(x, y, rw, rh, 6);
          ctx.stroke();
          const { codigo, titulo } = partesDoNome(cam.caso.nome);
          const texto = `${codigo ?? ''} ${titulo}`.trim();
          ctx.font = '600 10px system-ui, sans-serif';
          const lw = Math.min(rw - 4, ctx.measureText(texto).width + 8);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
          ctx.fillRect(x + 2, y + 2, lw, 15);
          ctx.fillStyle = '#fff';
          ctx.fillText(texto, x + 6, y + 13, lw - 8);
          const badge = `${agoraN} agora`;
          const bw = ctx.measureText(badge).width + 8;
          ctx.fillStyle = 'rgba(37, 99, 235, 0.9)';
          ctx.fillRect(x + rw - bw - 2, y + rh - 17, bw, 15);
          ctx.fillStyle = '#fff';
          ctx.fillText(badge, x + rw - bw + 2, y + rh - 6);
        }
      }
      raf = requestAnimationFrame(desenhar);
    };
    raf = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(raf);
  }, []);

  function cameraEm(e: React.MouseEvent<HTMLCanvasElement>): string | null {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 1000;
    const py = ((e.clientY - r.top) / r.height) * 560;
    for (const cam of cameras) {
      const l = LUGARES[cam.caso.camera];
      if (!l || l.andar !== andar) continue;
      const { w, h } = tamanho(cam.caso);
      if (px >= l.x && px <= l.x + w && py >= l.y && py <= l.y + h) return cam.caso.camera;
    }
    return null;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button onClick={() => setTocando(!tocando)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary" aria-label={tocando ? 'Pausar' : 'Tocar'}>
          {tocando ? (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M4 2.5v11l9-5.5z" /></svg>
          )}
        </button>
        <select value={vel} onChange={(e) => setVel(Number(e.target.value))} className="h-9 rounded-sm border border-outline-variant bg-surface px-2 text-xs text-on-surface" aria-label="Velocidade">
          {VELOCIDADES_REAIS.map((v) => (
            <option key={v.v} value={v.v}>
              {v.rotulo}
            </option>
          ))}
        </select>
        <div className="flex rounded-sm bg-surface-container p-1">
          {(['T', 'P1'] as Andar[]).map((a) => (
            <button key={a} onClick={() => setAndar(a)} className={`h-8 rounded-sm px-3 text-sm font-medium ${andar === a ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
              {ANDAR_NOME[a]}
            </button>
          ))}
        </div>
        <span className="text-xs text-on-surface-variant">Clique numa câmera para ver o vídeo dela.</span>
      </div>
      <div className="overflow-hidden rounded-md border border-outline-variant bg-surface-container-low">
        <canvas
          ref={canvas}
          className="block aspect-[1000/560] w-full cursor-pointer"
          onMouseMove={(e) => setHover(cameraEm(e))}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            const id = cameraEm(e);
            if (id) onAbrir?.(id);
          }}
        />
      </div>
    </div>
  );
}
