'use client';

import { useMemo, useState } from 'react';
import { Secao, Tabela } from '@/components/shopping/Comum';
import { GraficoSankey } from '@/components/shopping/Graficos';
import { ErroCaso } from '@/components/shopping/casos/useCaso';
import { corDoId } from '@/components/shopping/cameras/CameraFoco';
import { partesDoNome } from '@/components/shopping/cameras/tipos';
import { SelectField } from '@/components/ui/Field';
import { caixaEm, pe } from '@/lib/shopping/casos';
import { NOME_LADO, POR_LADO, PONTO_LADO, carregarCamerasReais, fluxos, passagensLinha, type CameraReal, type Fluxo } from '@/lib/shopping/real';
import { MapaCameras } from './MapaCameras';
import { MosaicoReal, useCamerasReais } from './MosaicoReal';

const botao = (ativo: boolean) =>
  `h-8 rounded-sm border px-3 text-xs font-medium transition-colors ${ativo ? 'border-primary bg-primary-container text-on-primary-container' : 'border-outline-variant text-on-surface hover:bg-surface-container-low'}`;

// Entrar e sair pelo mesmo lado = deu meia-volta (ou parou e voltou).
const rotuloFluxo = (f: Fluxo) => (f.de === f.para ? `meia-volta ${POR_LADO[f.de]}` : `${NOME_LADO[f.de]} → ${NOME_LADO[f.para]}`);
/** Fluxo principal: quem atravessa a imagem; meia-volta só se não houver. */
const principal = (fs: Fluxo[] | undefined) => fs?.find((f) => f.de !== f.para) ?? fs?.[0];

/** Seta grossa de um lado ao outro da imagem (mais gente = mais grossa). */
function seta(ctx: CanvasRenderingContext2D, f: Fluxo, max: number, w: number, h: number) {
  const [x0, y0] = PONTO_LADO[f.de];
  const [x1, y1] = PONTO_LADO[f.para];
  const ax = x0 * w;
  const ay = y0 * h;
  const bx = x1 * w;
  const by = y1 * h;
  const larg = 3 + (12 * f.pessoas.length) / max;
  const ang = Math.atan2(by - ay, bx - ax);
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
  ctx.fillStyle = 'rgba(250, 204, 21, 0.9)';
  ctx.lineWidth = larg;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx - Math.cos(ang) * larg * 2, by - Math.sin(ang) * larg * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx - Math.cos(ang - 0.5) * larg * 3, by - Math.sin(ang - 0.5) * larg * 3);
  ctx.lineTo(bx - Math.cos(ang + 0.5) * larg * 3, by - Math.sin(ang + 0.5) * larg * 3);
  ctx.closePath();
  ctx.fill();
  const texto = String(f.pessoas.length);
  ctx.font = '700 13px system-ui, sans-serif';
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const lw = ctx.measureText(texto).width + 10;
  ctx.fillStyle = 'rgba(66, 32, 6, 0.9)';
  ctx.fillRect(mx - lw / 2, my - 10, lw, 20);
  ctx.fillStyle = '#fef08a';
  ctx.fillText(texto, mx - lw / 2 + 5, my + 5);
}

export function RotasReal({ urlMotor }: { urlMotor: string }) {
  const { cameras, erro } = useCamerasReais(urlMotor, carregarCamerasReais);
  const [ver, setVer] = useState<'agora' | 'todos'>('agora');
  const [setas, setSetas] = useState(true);
  const [camSankey, setCamSankey] = useState('');
  const [aberta, setAberta] = useState<string | null>(null);

  const porCamera = useMemo(() => new Map((cameras ?? []).map((c) => [c.caso.camera, fluxos(c.caso).filter((f) => f.de !== 'meio' && f.para !== 'meio')])), [cameras]);

  const sankey = useMemo(() => {
    const nos: { name: string }[] = [];
    const idx = new Map<string, number>();
    const no = (k: string, nome: string) => {
      if (!idx.has(k)) {
        idx.set(k, nos.length);
        nos.push({ name: nome });
      }
      return idx.get(k)!;
    };
    const lig = new Map<string, number>();
    for (const c of cameras ?? []) {
      if (camSankey && c.caso.camera !== camSankey) continue;
      for (const f of porCamera.get(c.caso.camera) ?? []) {
        const k = `${no(`de|${f.de}`, `Entrou ${POR_LADO[f.de]}`)}>${no(`para|${f.para}`, `Saiu ${POR_LADO[f.para]}`)}`;
        lig.set(k, (lig.get(k) ?? 0) + f.pessoas.length);
      }
    }
    return { nos, ligacoes: [...lig].map(([k, v]) => ({ source: Number(k.split('>')[0]), target: Number(k.split('>')[1]), value: v })) };
  }, [cameras, porCamera, camSankey]);

  if (erro) return <ErroCaso erro={erro} urlMotor={urlMotor} />;
  if (!cameras) return <p className="text-sm text-on-surface-variant">Carregando as câmeras…</p>;

  function desenhar(cam: CameraReal, ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
    if (ver === 'todos') {
      // Caminho de todo mundo que passou no vídeo até agora
      for (const p of cam.caso.pessoas) {
        if (p.entrada > t) continue;
        ctx.beginPath();
        let primeiro = true;
        for (const pt of p.pontos) {
          if (pt[0] > t) break;
          const [x, y] = pe(pt);
          if (primeiro) ctx.moveTo(x * w, y * h);
          else ctx.lineTo(x * w, y * h);
          primeiro = false;
        }
        ctx.strokeStyle = corDoId(p.id, 0.55);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else {
      // Todo mundo que está na imagem agora, com o caminho inteiro desde que
      // entrou (mesmo quem o detector perdeu por um instante).
      for (const p of cam.caso.pessoas) {
        if (t < p.entrada || t > p.saida + 0.5) continue;
        ctx.beginPath();
        let ultimo: [number, number] | null = null;
        for (const pt of p.pontos) {
          if (pt[0] > t) break;
          const [x, y] = pe(pt);
          if (!ultimo) ctx.moveTo(x * w, y * h);
          else ctx.lineTo(x * w, y * h);
          ultimo = [x, y];
        }
        const cx = caixaEm(p, t);
        if (cx) ctx.lineTo(((cx[0] + cx[2]) / 2) * w, cx[3] * h);
        ctx.strokeStyle = corDoId(p.id, 0.9);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        const ponta = cx ? [(cx[0] + cx[2]) / 2, cx[3]] : ultimo;
        if (cx) {
          ctx.strokeStyle = corDoId(p.id);
          ctx.lineWidth = 2;
          ctx.strokeRect(cx[0] * w, cx[1] * h, (cx[2] - cx[0]) * w, (cx[3] - cx[1]) * h);
        }
        if (ponta) {
          ctx.beginPath();
          ctx.arc(ponta[0] * w, ponta[1] * h, 4, 0, Math.PI * 2);
          ctx.fillStyle = corDoId(p.id);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }
    if (setas) {
      const fs = (porCamera.get(cam.caso.camera) ?? []).filter((f) => f.de !== f.para).slice(0, 3);
      const max = fs[0]?.pessoas.length || 1;
      for (const f of fs) seta(ctx, f, max, w, h);
    }
  }

  const tabela = cameras.map((c) => {
    const fs = porCamera.get(c.caso.camera) ?? [];
    const linhas = c.linhas.map((l) => ({ l, ...passagensLinha(c.caso, l) }));
    return { c, principal: principal(fs), total: fs.reduce((s, f) => s + f.pessoas.length, 0), linhas };
  });

  return (
    <div className="flex flex-col gap-6">
      <Secao
        titulo="Mapa das câmeras"
        descricao="Planta montada só com as 15 câmeras de demonstração. Em cada uma, o caminho de quem passou (forte = está na imagem agora) e as setas dos fluxos principais."
      >
        <MapaCameras urlMotor={urlMotor} cameras={cameras} modo="rotas" onAbrir={setAberta} />
      </Secao>
      <Secao titulo="Caminhos nas câmeras" descricao="O vídeo real de cada câmera com o caminho das pessoas. As setas amarelas são os fluxos mais comuns: por qual lado da imagem as pessoas entram e por qual saem (o número é quantas pessoas).">
        <MosaicoReal
          urlMotor={urlMotor}
          cameras={cameras}
          desenhar={desenhar}
          aberta={aberta}
          onAberta={setAberta}
          legenda={(c) => {
            const f = principal(porCamera.get(c.caso.camera));
            return f ? `Principal: ${rotuloFluxo(f)} (${f.pessoas.length})` : 'Sem fluxo claro';
          }}
          controles={
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setVer('agora')} className={botao(ver === 'agora')}>
                Quem está passando
              </button>
              <button onClick={() => setVer('todos')} className={botao(ver === 'todos')}>
                Todos os caminhos
              </button>
              <button onClick={() => setSetas(!setas)} className={botao(setas)}>
                Setas de fluxo
              </button>
            </div>
          }
          detalhe={(c) => (
            <ul className="flex flex-col gap-1.5 text-xs">
              {(porCamera.get(c.caso.camera) ?? []).slice(0, 6).map((f) => (
                <li key={`${f.de}>${f.para}`} className="flex justify-between gap-2">
                  <span className="text-on-surface">{rotuloFluxo(f)}</span>
                  <span className="tabular-nums text-on-surface-variant">{f.pessoas.length}</span>
                </li>
              ))}
              {c.linhas.map((l) => {
                const p = passagensLinha(c.caso, l);
                return (
                  <li key={l.id} className="mt-1 flex justify-between gap-2 border-t border-outline-variant pt-1.5">
                    <span className="text-on-surface">Linha “{l.nome}”</span>
                    <span className="tabular-nums text-on-surface-variant">
                      ▲ {p.entradas} ▼ {p.saidas}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        />
      </Secao>

      <Secao
        titulo="De onde vêm e para onde vão (diagrama de Sankey)"
        descricao="Lado da imagem por onde as pessoas entraram → por onde saíram, somando as câmeras"
        acao={
          <SelectField label="Câmera" value={camSankey} onChange={(e) => setCamSankey(e.target.value)} className="w-64">
            <option value="">Todas as câmeras</option>
            {cameras.map((c) => (
              <option key={c.caso.camera} value={c.caso.camera}>
                {c.caso.nome}
              </option>
            ))}
          </SelectField>
        }
      >
        {sankey.ligacoes.length ? <GraficoSankey nos={sankey.nos} ligacoes={sankey.ligacoes} altura={380} /> : <p className="text-sm text-on-surface-variant">Sem fluxos nesta câmera.</p>}
      </Secao>

      <Secao titulo="Fluxo por câmera" descricao="Fluxo principal e passagens nas linhas de contagem de cada câmera, medidos nos vídeos">
        <Tabela
          cabecalho={['Câmera', 'Fluxo principal', 'Pessoas com caminho', 'Linhas de contagem']}
          alinharDireita={[2]}
          linhas={tabela.map((r) => [
            <span key="c" className="text-xs">
              {partesDoNome(r.c.caso.nome).codigo} {partesDoNome(r.c.caso.nome).titulo}
            </span>,
            r.principal ? `${rotuloFluxo(r.principal)} (${r.principal.pessoas.length})` : '–',
            r.total,
            r.linhas.length ? r.linhas.map((l) => `${l.l.nome}: ▲ ${l.entradas} ▼ ${l.saidas}`).join(' · ') : '–',
          ])}
        />
      </Secao>
    </div>
  );
}
