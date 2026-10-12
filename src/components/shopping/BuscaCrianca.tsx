'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Planta } from './Planta';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { CORES, HEX_COR, type Cor, type Descritor } from '@/lib/shopping/seguranca';

// Na versão final, o texto livre vai para um modelo de visão-linguagem
// open source rodando LOCALMENTE (OpenCLIP), combinado com estes filtros
// de cor e estatura. Aqui a interpretação do texto é por palavras-chave.

const RAIZES: [string, Cor][] = [
  ['azul', 'azul'],
  ['vermelh', 'vermelho'],
  ['pret', 'preto'],
  ['branc', 'branco'],
  ['verde', 'verde'],
  ['amarel', 'amarelo'],
  ['rosa', 'rosa'],
  ['cinza', 'cinza'],
  ['laranja', 'laranja'],
  ['rox', 'roxo'],
  ['marrom', 'marrom'],
];
const CIMA = ['camisa', 'camiseta', 'blusa', 'casaco', 'moletom', 'jaqueta', 'vestido', 'regata', 'farda'];
const BAIXO = ['bermuda', 'calca', 'short', 'saia', 'shorts', 'legging'];
const CRIANCA = ['menino', 'menina', 'crianca', 'garoto', 'garota', 'filho', 'filha', 'bebe'];

type Consulta = { cima?: Cor; baixo?: Cor; estatura?: 'crianca' | 'adulto' };

function interpretar(texto: string): Consulta {
  const palavras = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/);
  const c: Consulta = {};
  let parte: 'cima' | 'baixo' | undefined;
  for (const p of palavras) {
    if (CRIANCA.includes(p)) c.estatura = 'crianca';
    if (CIMA.includes(p)) parte = 'cima';
    if (BAIXO.includes(p)) parte = 'baixo';
    const cor = RAIZES.find(([r]) => p.startsWith(r))?.[1];
    if (cor) {
      const alvo = parte ?? (c.cima ? 'baixo' : 'cima');
      if (!c[alvo]) c[alvo] = cor;
    }
  }
  return c;
}

function pontuar(d: Descritor, q: Consulta): number {
  if (q.estatura && d.estatura !== q.estatura) return 0;
  return (q.cima && d.cima === q.cima ? 2 : 0) + (q.baixo && d.baixo === q.baixo ? 2 : 0) + (q.estatura ? 1 : 0);
}

function Silhueta({ d }: { d: Descritor }) {
  const escala = d.alturaCm / 185;
  return (
    <svg viewBox="0 0 80 110" className="h-28 w-full rounded-sm bg-[var(--viz-corredor)]">
      <g transform={`translate(40 106) scale(${escala}) translate(-40 -100)`}>
        <circle cx="40" cy="12" r="9" fill="#9b8a7a" />
        <rect x="27" y="23" width="26" height="34" rx="6" fill={HEX_COR[d.cima]} stroke="#0003" />
        <rect x="28" y="56" width="11" height="40" rx="4" fill={HEX_COR[d.baixo]} stroke="#0003" />
        <rect x="41" y="56" width="11" height="40" rx="4" fill={HEX_COR[d.baixo]} stroke="#0003" />
      </g>
    </svg>
  );
}

function horario(min: number) {
  const t = new Date(Date.now() - 3 * 3600 * 1000 - min * 60000).toISOString();
  return t.slice(11, 16);
}

type Auditoria = { quando: string; texto: string };

export function BuscaCrianca({ pessoas, usuario }: { pessoas: Descritor[]; usuario: string }) {
  const [ativa, setAtiva] = useState(true);
  const [texto, setTexto] = useState('menino de camisa azul e bermuda preta');
  const [janela, setJanela] = useState(60);
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [extra, setExtra] = useState<Consulta>({});
  const [selId, setSelId] = useState<string | null>(null);
  const [confirmados, setConfirmados] = useState<string[]>([]);
  const [auditoria, setAuditoria] = useState<Auditoria[]>([]);
  const [alertaAte, setAlertaAte] = useState<number | null>(null);
  const [novos, setNovos] = useState<Descritor[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q: Consulta | null = consulta && { cima: extra.cima ?? consulta.cima, baixo: extra.baixo ?? consulta.baixo, estatura: extra.estatura ?? consulta.estatura };
  const resultados = useMemo(() => {
    if (!q) return [];
    const max = (q.cima ? 2 : 0) + (q.baixo ? 2 : 0) + (q.estatura ? 1 : 0);
    return [...novos, ...pessoas]
      .filter((d) => d.minutosAtras <= janela)
      .map((d) => ({ d, s: pontuar(d, q) }))
      .filter((r) => r.s >= Math.max(1, max - 2))
      .sort((a, b) => b.s - a.s || a.d.minutosAtras - b.d.minutosAtras)
      .slice(0, 12);
  }, [consulta, extra, janela, novos, pessoas]);
  const sel = resultados.find((r) => r.d.id === selId)?.d ?? resultados[0]?.d;

  function buscar() {
    const c = interpretar(texto);
    setConsulta(c);
    setExtra({});
    setSelId(null);
    const agora = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    setAuditoria((a) => [{ quando: `${agora.slice(8, 10)}/${agora.slice(5, 7)} ${agora.slice(11, 19)}`, texto }, ...a]);
  }

  // Modo alerta (demonstração): depois de alguns segundos surge alguém compatível
  useEffect(() => {
    if (!alertaAte || !q) return;
    timer.current = setTimeout(() => {
      const base = pessoas[7];
      const novo: Descritor = { ...base, id: `N${Date.now()}`, cima: q.cima ?? base.cima, baixo: q.baixo ?? base.baixo, estatura: q.estatura ?? base.estatura, alturaCm: q.estatura === 'crianca' ? 112 : base.alturaCm, minutosAtras: 0 };
      setNovos((n) => [novo, ...n]);
      setSelId(novo.id);
      try {
        const ctx = new AudioContext();
        const o = ctx.createOscillator();
        o.frequency.value = 660;
        o.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.3);
      } catch {}
    }, 9000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [alertaAte]);

  if (!ativa) {
    return (
      <div className="rounded-sm border border-outline-variant p-6 text-sm text-on-surface-variant">
        <p className="mb-3">A busca de criança perdida está desligada. Nenhum descritor de pessoa está sendo guardado.</p>
        <Button size="sm" onClick={() => setAtiva(true)}>
          Religar função
        </Button>
      </div>
    );
  }

  return (
    <div>
      <form
        className="mb-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          buscar();
        }}
      >
        <label className="block min-w-64 flex-1">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Descreva a criança</span>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="h-10 w-full rounded-sm border border-outline-variant bg-surface px-3 text-sm text-on-surface outline-none focus:border-primary"
            placeholder="Ex.: menina de vestido rosa"
          />
        </label>
        <SelectField label="Vista nos últimos" value={janela} onChange={(e) => setJanela(Number(e.target.value))} className="w-36">
          {[15, 30, 60, 120].map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </SelectField>
        <Button type="submit" className="h-10">
          Buscar
        </Button>
      </form>

      {q && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-sm border border-outline-variant p-3">
          <p className="w-full text-xs text-on-surface-variant">Entendi assim (ajuste se precisar):</p>
          {(['cima', 'baixo'] as const).map((parte) => (
            <SelectField key={parte} label={parte === 'cima' ? 'Roupa de cima' : 'Roupa de baixo'} value={q[parte] ?? ''} onChange={(e) => setExtra((x) => ({ ...x, [parte]: (e.target.value || undefined) as Cor | undefined }))} className="w-40">
              <option value="">qualquer cor</option>
              {CORES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>
          ))}
          <SelectField label="Estatura" value={q.estatura ?? ''} onChange={(e) => setExtra((x) => ({ ...x, estatura: (e.target.value || undefined) as Consulta['estatura'] }))} className="w-40">
            <option value="">qualquer</option>
            <option value="crianca">criança (até 1,35 m)</option>
            <option value="adulto">adulto</option>
          </SelectField>
          <div className="ml-auto flex items-center gap-2">
            {alertaAte ? (
              <>
                <Badge variant="warning">Monitorando ao vivo por 30 min</Badge>
                <Button variant="ghost" size="sm" onClick={() => setAlertaAte(null)}>
                  Parar
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setAlertaAte(Date.now() + 30 * 60000)}>
                Avisar quando aparecer (30 min)
              </Button>
            )}
          </div>
        </div>
      )}

      {q && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <p className="mb-2 text-sm text-on-surface-variant">
              {resultados.length} candidato(s) · o sistema sugere, um agente da Segurança confirma
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {resultados.map(({ d, s }) => (
                <button
                  key={d.id}
                  onClick={() => setSelId(d.id)}
                  className={cn('rounded-sm border p-2 text-left transition-colors', d.id === sel?.id ? 'border-primary bg-surface-container-low' : 'border-outline-variant hover:bg-surface-container-low')}
                >
                  <Silhueta d={d} />
                  <p className="mt-1.5 truncate text-xs font-semibold text-on-surface">{d.cameraNome}</p>
                  <p className="text-[11px] text-on-surface-variant">
                    {horario(d.minutosAtras)} · {d.estatura === 'crianca' ? `criança (~${(d.alturaCm / 100).toFixed(2).replace('.', ',')} m)` : 'adulto'}
                  </p>
                  <p className="text-[11px] text-on-surface-variant">
                    {d.cima} / {d.baixo} · {s >= 4 ? 'alta' : 'média'} semelhança
                  </p>
                  {d.minutosAtras === 0 && <Badge variant="error" className="mt-1">Agora</Badge>}
                  {confirmados.includes(d.id) && <Badge variant="success" className="mt-1">Confirmado</Badge>}
                </button>
              ))}
            </div>
            {resultados.length === 0 && <p className="text-sm text-on-surface-variant">Ninguém compatível nesse período. Tente ampliar a janela ou remover uma cor.</p>}
          </div>

          {sel && (
            <div className="xl:col-span-2">
              <Planta andar={sel.andar} mostrarCameras marcadores={[{ x: sel.x, y: sel.y, rotulo: `${horario(sel.minutosAtras)} · ${sel.cameraId}`, tom: 'info' }]} />
              <p className="mt-2 text-sm text-on-surface">
                {sel.cameraNome} · visto às {horario(sel.minutosAtras)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/shopping/ao-vivo" className="inline-flex h-8 items-center rounded-sm bg-primary px-3 text-xs font-medium text-on-primary">
                  Ver câmera ao vivo
                </Link>
                <Button variant="outline" size="sm" onClick={() => setConfirmados((c) => [...c, sel.id])} disabled={confirmados.includes(sel.id)}>
                  Confirmar que é a criança
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Registro de auditoria (esta sessão)</p>
          {auditoria.length ? (
            <ul className="flex flex-col gap-1 text-xs text-on-surface-variant">
              {auditoria.map((a, i) => (
                <li key={i}>
                  {a.quando} · {usuario} buscou “{a.texto}”
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-on-surface-variant">Nenhuma busca ainda.</p>
          )}
        </div>
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs leading-relaxed text-on-surface-variant">Desligar a função apaga o buffer de recortes na hora e para de gerar descritores.</p>
          <Button variant="danger" size="sm" className="shrink-0 whitespace-nowrap" onClick={() => setAtiva(false)}>
            Desligar função
          </Button>
        </div>
      </div>
    </div>
  );
}
