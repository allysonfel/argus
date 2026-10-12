'use client';

import { useEffect, useMemo, useState } from 'react';
import { Secao } from '@/components/shopping/Comum';
import { Planta } from '@/components/shopping/Planta';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { POSICAO_NA_PLANTA, carregarCaso, carregarIndice, fmtTempo, type Caso, type PessoaCaso } from '@/lib/shopping/casos';
import { PlayerCaso, desenharPessoas } from './PlayerCaso';
import { ErroCaso } from './useCaso';

// Interpretação do texto por palavras-chave (cor + peça + "menino/menina").
// Na versão final o texto livre vai para um modelo de visão-linguagem
// rodando localmente, combinado com estes mesmos filtros.
const CORES = ['preto', 'branco', 'cinza', 'vermelho', 'laranja', 'amarelo', 'verde', 'azul', 'roxo', 'rosa', 'marrom'] as const;
type Cor = (typeof CORES)[number];
const HEX: Record<Cor, string> = {
  preto: '#1f1f1f', branco: '#f2f2f2', cinza: '#8a8a8a', vermelho: '#c62828', laranja: '#ef6c00', amarelo: '#f9c80e',
  verde: '#2e7d32', azul: '#1565c0', roxo: '#6a1b9a', rosa: '#e85d9a', marrom: '#6d4c41',
};
const RAIZES: [string, Cor][] = [
  ['azul', 'azul'], ['vermelh', 'vermelho'], ['pret', 'preto'], ['escur', 'preto'], ['branc', 'branco'], ['verde', 'verde'],
  ['amarel', 'amarelo'], ['rosa', 'rosa'], ['cinza', 'cinza'], ['laranja', 'laranja'], ['rox', 'roxo'], ['marrom', 'marrom'], ['bege', 'marrom'],
];
const CIMA = ['camisa', 'camiseta', 'blusa', 'casaco', 'moletom', 'jaqueta', 'vestido', 'regata', 'farda', 'top'];
const BAIXO = ['bermuda', 'calca', 'short', 'saia', 'shorts', 'legging', 'jeans'];
const CRIANCA = ['menino', 'menina', 'crianca', 'garoto', 'garota', 'filho', 'filha', 'bebe', 'pequeno', 'pequena'];

type Consulta = { cima?: Cor; baixo?: Cor; estatura?: 'crianca' | 'adulto' };
type Candidato = { caso: Caso; p: PessoaCaso; nota: number; max: number };

function interpretar(texto: string): Consulta {
  const palavras = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/);
  const c: Consulta = {};
  let parte: 'cima' | 'baixo' | undefined;
  for (const p of palavras) {
    if (CRIANCA.includes(p)) c.estatura = 'crianca';
    if (CIMA.includes(p)) parte = 'cima';
    if (BAIXO.includes(p)) parte = 'baixo';
    if (p === 'jeans' && !c.baixo) c.baixo = 'azul';
    const cor = RAIZES.find(([r]) => p.startsWith(r))?.[1];
    if (cor) {
      const alvo = parte ?? (c.cima ? 'baixo' : 'cima');
      if (!c[alvo]) c[alvo] = cor;
    }
  }
  return c;
}

function pontuar(p: PessoaCaso, q: Consulta): number {
  let n = 0;
  if (q.cima) n += p.cima?.cor === q.cima ? 2 : p.cima?.segunda === q.cima ? 1 : 0;
  if (q.baixo) n += p.baixo?.cor === q.baixo ? 2 : p.baixo?.segunda === q.baixo ? 1 : 0;
  if (q.estatura) {
    if (p.estatura === q.estatura) n += 2;
    else if (p.estatura) return -1; // estatura medida e diferente: descarta
  }
  return n;
}

type Auditoria = { quando: string; texto: string };

export function CasoCrianca({ urlMotor, usuario }: { urlMotor: string; usuario: string }) {
  const [casos, setCasos] = useState<Caso[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ativa, setAtiva] = useState(true);
  const [texto, setTexto] = useState('');
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [extra, setExtra] = useState<Consulta>({});
  const [andar, setAndar] = useState('');
  const [selId, setSelId] = useState<string | null>(null);
  const [confirmados, setConfirmados] = useState<string[]>([]);
  const [auditoria, setAuditoria] = useState<Auditoria[]>([]);
  const [irPara, setIrPara] = useState<{ t: number; k: number } | null>(null);

  useEffect(() => {
    carregarIndice(urlMotor)
      .then((ind) => Promise.all(ind.map((i) => carregarCaso(urlMotor, i.camera))))
      .then(setCasos)
      .catch((e) => setErro(String(e.message ?? e)));
  }, [urlMotor]);

  const q: Consulta | null = consulta && { cima: extra.cima ?? consulta.cima, baixo: extra.baixo ?? consulta.baixo, estatura: extra.estatura ?? consulta.estatura };
  const totalPessoas = casos?.reduce((s, c) => s + c.pessoas.length, 0) ?? 0;
  const totalCriancas = casos?.reduce((s, c) => s + c.pessoas.filter((p) => p.estatura === 'crianca').length, 0) ?? 0;

  const resultados: Candidato[] = useMemo(() => {
    if (!q || !casos) return [];
    const max = (q.cima ? 2 : 0) + (q.baixo ? 2 : 0) + (q.estatura ? 2 : 0);
    return casos
      .filter((c) => !andar || c.andar === andar)
      .flatMap((c) => c.pessoas.filter((p) => p.recorte).map((p) => ({ caso: c, p, nota: pontuar(p, q), max })))
      .filter((r) => r.nota >= Math.max(1, r.max - 2))
      .sort((a, b) => b.nota - a.nota || a.caso.camera.localeCompare(b.caso.camera))
      .slice(0, 16);
  }, [consulta, extra, casos, andar]);

  const chave = (r: Candidato) => `${r.caso.camera}#${r.p.id}`;
  const sel = resultados.find((r) => chave(r) === selId) ?? resultados[0];

  useEffect(() => {
    if (sel) setIrPara({ t: Math.max(0, (sel.p.t_recorte ?? sel.p.entrada) - 1.5), k: Date.now() });
  }, [sel?.caso.camera, sel?.p.id]);

  function buscar(t = texto) {
    if (!t.trim()) return;
    setTexto(t);
    setConsulta(interpretar(t));
    setExtra({});
    setSelId(null);
    const agora = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    setAuditoria((a) => [{ quando: `${agora.slice(8, 10)}/${agora.slice(5, 7)} ${agora.slice(11, 19)}`, texto: t }, ...a]);
  }

  if (erro) return <ErroCaso erro={erro} urlMotor={urlMotor} />;

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
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao titulo="Descreva a criança" descricao={casos ? `Procurando em ${casos.length} câmeras · ${totalPessoas} pessoas registradas (${totalCriancas} com estatura de criança)` : 'Carregando as câmeras…'} className="xl:col-span-2">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              buscar();
            }}
          >
            <label className="block min-w-64 flex-1">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">O que a família informou</span>
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                className="h-10 w-full rounded-sm border border-outline-variant bg-surface px-3 text-sm text-on-surface outline-none focus:border-primary"
                placeholder="Ex.: menina de blusa rosa e calça preta"
              />
            </label>
            <SelectField label="Onde" value={andar} onChange={(e) => setAndar(e.target.value)} className="w-36">
              <option value="">Shopping todo</option>
              <option value="T">Térreo</option>
              <option value="P1">Piso 1</option>
            </SelectField>
            <Button type="submit" className="h-10" disabled={!casos}>
              Buscar
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
            Exemplos:
            {EXEMPLOS.map((ex) => (
              <button key={ex} onClick={() => buscar(ex)} className="rounded-full border border-outline-variant px-2.5 py-1 text-on-surface hover:bg-surface-container-low" disabled={!casos}>
                {ex}
              </button>
            ))}
          </div>

          {q && (
            <div className="mt-4 flex flex-wrap items-end gap-3 rounded-sm border border-outline-variant p-3">
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
              <SelectField label="Estatura" value={q.estatura ?? ''} onChange={(e) => setExtra((x) => ({ ...x, estatura: (e.target.value || undefined) as Consulta['estatura'] }))} className="w-44">
                <option value="">qualquer</option>
                <option value="crianca">criança (até ~1,30 m)</option>
                <option value="adulto">adulto</option>
              </SelectField>
            </div>
          )}

          {q && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-on-surface-variant">{resultados.length} candidato(s) · o sistema sugere, um agente da Segurança confirma</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                {resultados.map((r) => (
                  <button
                    key={chave(r)}
                    onClick={() => setSelId(chave(r))}
                    className={cn('rounded-sm border p-1.5 text-left transition-colors', sel && chave(r) === chave(sel) ? 'border-primary bg-surface-container-low ring-2 ring-primary/30' : 'border-outline-variant hover:bg-surface-container-low')}
                  >
                    <img src={`${urlMotor}/casos/${r.p.recorte}`} alt={`Pessoa ${r.p.id} da ${r.caso.nome}`} className="h-36 w-full rounded-sm bg-black object-contain" />
                    <p className="mt-1.5 truncate text-xs font-semibold text-on-surface">{POSICAO_NA_PLANTA[r.caso.camera]?.rotulo ?? r.caso.camera} · {fmtTempo(r.p.t_recorte ?? r.p.entrada)}</p>
                    <p className="flex items-center gap-1 text-[11px] text-on-surface-variant">
                      <Bolinha cor={r.p.cima?.cor} /> <Bolinha cor={r.p.baixo?.cor} />
                      {r.p.estatura === 'crianca' ? `criança ~${((r.p.altura_cm ?? 120) / 100).toFixed(2).replace('.', ',')} m` : r.p.estatura === 'adulto' ? 'adulto' : 'estatura ?'}
                    </p>
                    <p className="text-[11px] text-on-surface-variant">{r.nota >= r.max ? 'alta' : 'média'} semelhança</p>
                    {confirmados.includes(chave(r)) && <Badge variant="success" className="mt-1">Confirmado</Badge>}
                  </button>
                ))}
              </div>
              {resultados.length === 0 && <p className="text-sm text-on-surface-variant">Ninguém compatível. Tente remover uma cor ou trocar a estatura para &quot;qualquer&quot;.</p>}
            </div>
          )}
        </Secao>

        <div className="flex flex-col gap-6">
          {sel ? (
            <Secao titulo="Candidato escolhido" descricao={`${sel.caso.nome} · aparece aos ${fmtTempo(sel.p.entrada)} do vídeo`}>
              <PlayerCaso
                key={sel.caso.camera}
                urlMotor={urlMotor}
                caso={sel.caso}
                irPara={irPara}
                desenhar={(ctx, t, w, h) => desenharPessoas(ctx, sel.caso.pessoas, t, w, h, { destaque: new Set([sel.p.id]), esmaecer: true, rastroS: 6, rotular: (p) => (p.id === sel.p.id ? 'candidato' : null) })}
              />
              <ul className="mt-3 flex flex-col gap-1 text-xs text-on-surface-variant">
                <li>Roupa de cima: <b className="text-on-surface">{sel.p.cima?.cor ?? '?'}</b>{sel.p.cima?.segunda ? ` (e ${sel.p.cima.segunda})` : ''} · de baixo: <b className="text-on-surface">{sel.p.baixo?.cor ?? '?'}</b>{sel.p.baixo?.segunda ? ` (e ${sel.p.baixo.segunda})` : ''}</li>
                <li>Estatura: <b className="text-on-surface">{sel.p.estatura ? `${sel.p.estatura === 'crianca' ? 'criança' : 'adulto'}, ~${((sel.p.altura_cm ?? 0) / 100).toFixed(2).replace('.', ',')} m` : 'não estimável (câmera vista de cima)'}</b></li>
                <li>Na imagem de {fmtTempo(sel.p.entrada)} a {fmtTempo(sel.p.saida)}</li>
              </ul>
              {POSICAO_NA_PLANTA[sel.caso.camera] && (
                <div className="mt-3">
                  <Planta andar={POSICAO_NA_PLANTA[sel.caso.camera].andar} marcadores={[{ ...POSICAO_NA_PLANTA[sel.caso.camera], rotulo: `${POSICAO_NA_PLANTA[sel.caso.camera].rotulo} · ${fmtTempo(sel.p.entrada)}`, tom: 'alerta' }]} />
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setConfirmados((c) => [...c, chave(sel)])} disabled={confirmados.includes(chave(sel))}>
                  Confirmar que é a criança
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIrPara({ t: Math.max(0, sel.p.entrada - 1), k: Date.now() })}>
                  Ver desde que apareceu
                </Button>
              </div>
            </Secao>
          ) : (
            <Secao titulo="Candidato escolhido">
              <p className="text-sm text-on-surface-variant">Faça uma busca e clique num candidato para ver o momento no vídeo e onde fica a câmera.</p>
            </Secao>
          )}
          <Secao titulo="Como a busca funciona">
            <ul className="flex list-disc flex-col gap-1.5 pl-4 text-xs leading-relaxed text-on-surface-variant">
              <li>Para cada pessoa rastreada, o motor guarda só a cor dominante do tronco e das pernas, a estatura estimada e um recorte. Sem rosto, sem identificação.</li>
              <li>Estatura: a altura da pessoa na imagem comparada com a de um adulto no mesmo ponto do piso (a perspectiva muda o tamanho). Em câmera vista de cima não dá pra medir.</li>
              <li>Desligar a função apaga os recortes e para de gerar descritores.</li>
            </ul>
          </Secao>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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

// Descrições reais de pessoas que aparecem nos vídeos de demonstração.
// (menino de vermelho na praça de alimentação, criança de azul nos quiosques,
// criança de preto no mezanino)
const EXEMPLOS = ['menino de camiseta vermelha e calça preta', 'criança de blusa azul', 'criança de camiseta preta e calça cinza'];

function Bolinha({ cor }: { cor?: string }) {
  if (!cor) return null;
  return <span className="inline-block h-2.5 w-2.5 rounded-full border border-black/20" style={{ background: HEX[cor as Cor] ?? '#999' }} title={cor} />;
}
