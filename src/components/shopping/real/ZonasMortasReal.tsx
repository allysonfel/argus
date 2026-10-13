'use client';

import { useMemo, useRef, useState } from 'react';
import { Numero, Secao, Tabela } from '@/components/shopping/Comum';
import { LegendaDivergente } from '@/components/shopping/Planta';
import { ErroCaso } from '@/components/shopping/casos/useCaso';
import { partesDoNome } from '@/components/shopping/cameras/tipos';
import { Badge } from '@/components/ui/Badge';
import { SelectField } from '@/components/ui/Field';
import { Calor, amostras, carregarCamerasReais, desenharCalor, indiceZonasReais, type CameraReal } from '@/lib/shopping/real';
import { MapaCameras } from './MapaCameras';
import { MosaicoReal, useCamerasReais } from './MosaicoReal';

const pct = (v: number) => `${Math.round(v * 100)}%`;

// Mesmas faixas da legenda divergente (o canvas não lê variáveis CSS).
function corZona(indice: number): string {
  if (indice < 0.4) return 'rgba(220, 38, 38, 0.38)';
  if (indice < 0.7) return 'rgba(248, 113, 113, 0.32)';
  if (indice < 0.9) return 'rgba(254, 202, 202, 0.3)';
  if (indice <= 1.1) return 'rgba(226, 232, 240, 0.22)';
  if (indice <= 1.4) return 'rgba(147, 197, 253, 0.3)';
  if (indice <= 1.8) return 'rgba(59, 130, 246, 0.32)';
  return 'rgba(29, 78, 216, 0.38)';
}

export function ZonasMortasReal({ urlMotor }: { urlMotor: string }) {
  const { cameras, erro } = useCamerasReais(urlMotor, carregarCamerasReais);
  const [limite, setLimite] = useState(40);
  const [aberta, setAberta] = useState<string | null>(null);
  const inteiros = useRef(new Map<string, Float32Array>());
  const offscreen = useRef<HTMLCanvasElement | null>(null);
  const indices = useMemo(() => (cameras ? indiceZonasReais(cameras) : []), [cameras]);

  if (erro) return <ErroCaso erro={erro} urlMotor={urlMotor} />;
  if (!cameras) return <p className="text-sm text-on-surface-variant">Carregando as câmeras…</p>;

  const mortas = indices.filter((z) => z.indice < limite / 100);
  const ordenadas = [...indices].sort((a, b) => a.indice - b.indice);

  function desenhar(cam: CameraReal, ctx: CanvasRenderingContext2D, _t: number, w: number, h: number) {
    if (!offscreen.current) offscreen.current = document.createElement('canvas');
    const id = cam.caso.camera;
    if (!inteiros.current.has(id)) inteiros.current.set(id, new Calor(amostras(cam.caso)).somarAte(Infinity).slice());
    ctx.globalAlpha = 0.55;
    desenharCalor(ctx, inteiros.current.get(id)!, w, h, offscreen.current);
    ctx.globalAlpha = 1;
    for (const z of indices.filter((x) => x.cam === cam)) {
      const morta = z.indice < limite / 100;
      ctx.beginPath();
      z.zona.poligono.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
      ctx.closePath();
      ctx.fillStyle = corZona(z.indice);
      ctx.fill();
      ctx.lineWidth = morta ? 3 : 1.5;
      ctx.setLineDash(morta ? [] : [6, 4]);
      ctx.strokeStyle = morta ? '#dc2626' : 'rgba(255,255,255,0.8)';
      ctx.stroke();
      ctx.setLineDash([]);
      const [x0, y0] = z.zona.poligono.reduce((m, p) => (p[1] < m[1] ? p : m));
      const texto = `${z.zona.nome} · ${pct(z.indice)}${morta ? ' · zona morta' : ''}`;
      ctx.font = '600 12px system-ui, sans-serif';
      const lw = ctx.measureText(texto).width + 8;
      const lx = Math.min(Math.max(0, x0 * w), w - lw);
      const ly = Math.max(16, y0 * h + 16);
      ctx.fillStyle = morta ? 'rgba(127, 29, 29, 0.9)' : 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(lx, ly - 13, lw, 17);
      ctx.fillStyle = '#fff';
      ctx.fillText(texto, lx + 4, ly);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Secao titulo="Mapa das câmeras" descricao="Planta montada só com as 15 câmeras de demonstração, com as zonas de cada uma coloridas pelo movimento real (vermelho = abaixo da média, azul = acima; contorno vermelho = zona morta).">
        <MapaCameras urlMotor={urlMotor} cameras={cameras} modo="zonas" onAbrir={setAberta} limiteZona={limite / 100} />
      </Secao>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <Secao
          titulo="Zonas de cada câmera"
          descricao="As áreas desenhadas em cada câmera, coloridas pelo movimento real no vídeo (vermelho = abaixo da média, azul = acima). Contorno vermelho = zona morta. O calor por baixo mostra por onde as pessoas passam."
          className="xl:col-span-3"
        >
          <MosaicoReal
            urlMotor={urlMotor}
            cameras={cameras.filter((c) => c.zonas.length)}
            desenhar={desenhar}
            aberta={aberta}
            onAberta={setAberta}
            legenda={(c) => {
              const zs = indices.filter((z) => z.cam === c);
              const m = zs.filter((z) => z.indice < limite / 100).length;
              return m ? <span className="font-semibold text-error">{m} zona(s) morta(s) de {zs.length}</span> : `${zs.length} zona(s), nenhuma morta`;
            }}
            detalhe={(c) => (
              <ul className="flex flex-col gap-1.5 text-xs">
                {indices
                  .filter((z) => z.cam === c)
                  .sort((a, b) => a.indice - b.indice)
                  .map((z) => (
                    <li key={z.zona.id} className="flex items-center justify-between gap-2">
                      <span className="text-on-surface">{z.zona.nome}</span>
                      <span className="tabular-nums text-on-surface-variant">
                        {pct(z.indice)} · {z.pessoas} pessoas
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          />
          <div className="mt-3">
            <LegendaDivergente />
          </div>
        </Secao>
        <Secao titulo="Resumo">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-1">
            <Numero rotulo="Zonas mortas" valor={mortas.length} detalhe={`de ${indices.length} zonas nas câmeras`} />
            <Numero rotulo="Mais vazia" valor={<span className="text-base">{ordenadas[0]?.zona.nome ?? '–'}</span>} detalhe={ordenadas[0] ? `${partesDoNome(ordenadas[0].cam.caso.nome).codigo} · ${pct(ordenadas[0].indice)} da média` : undefined} />
          </div>
          <SelectField label="Zona morta = abaixo de" value={limite} onChange={(e) => setLimite(Number(e.target.value))} className="mt-4">
            {[30, 40, 50, 60].map((v) => (
              <option key={v} value={v}>
                {v}% da média
              </option>
            ))}
          </SelectField>
          <p className="mt-4 text-xs leading-relaxed text-on-surface-variant">Para testar uma ação (quiosque, evento, sinalização) numa área, ligue a Simulação do shopping no topo da página.</p>
        </Secao>
      </div>

      <Secao titulo="Zonas, da mais vazia para a mais movimentada" descricao="Índice = tempo das pessoas na zona, por área da zona e por minuto de vídeo, ÷ média de todas as zonas (100% = na média)">
        <Tabela
          cabecalho={['Zona', 'Câmera', 'Pessoas que passaram', 'Índice', 'Situação']}
          alinharDireita={[2, 3]}
          linhas={ordenadas.map((z) => [
            z.zona.nome,
            <span key="c" className="text-xs">
              {partesDoNome(z.cam.caso.nome).codigo} {partesDoNome(z.cam.caso.nome).titulo}
            </span>,
            z.pessoas,
            pct(z.indice),
            z.indice < limite / 100 ? <Badge variant="error">Zona morta</Badge> : z.indice < 0.7 ? <Badge variant="warning">Pouco movimento</Badge> : <Badge>Normal</Badge>,
          ])}
        />
      </Secao>
    </div>
  );
}
