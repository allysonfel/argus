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
const ADOLESCENTE = ['adolescente', 'jovem', 'rapaz', 'moca', 'mocinha', 'mocinho', 'adolecente'];

// Faixas pela altura estimada. As faixas se sobrepõem de propósito: a
// estimativa erra uns 10-15 cm, então quem fica na divisa aparece nas duas.
type Faixa = 'crianca' | 'adolescente' | 'adulto';
const FAIXAS: { id: Faixa; rotulo: string; dica: string; min: number; max: number }[] = [
  { id: 'crianca', rotulo: 'Criança', dica: 'até ~1,30 m', min: 0, max: 135 },
  { id: 'adolescente', rotulo: 'Adolescente', dica: '~1,30 a 1,60 m', min: 125, max: 160 },
  { id: 'adulto', rotulo: 'Adulto', dica: 'acima de ~1,50 m', min: 150, max: Infinity },
];

type Consulta = { cima?: Cor; baixo?: Cor; faixa?: Faixa };
// Uma pessoa (ou várias aparições da mesma pessoa na mesma câmera, agrupadas).
type Candidato = { caso: Caso; p: PessoaCaso; nota: number; max: number; aparicoes: number };

function interpretar(texto: string): Consulta {
  const palavras = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/);
  const c: Consulta = {};
  let parte: 'cima' | 'baixo' | undefined;
  for (const p of palavras) {
    if (CRIANCA.includes(p)) c.faixa = 'crianca';
    if (ADOLESCENTE.includes(p)) c.faixa = 'adolescente';
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

function pontuar(p: PessoaCaso, q: Consulta, incluirSemEstatura: boolean): number {
  let n = 0;
  if (q.cima) n += p.cima?.cor === q.cima ? 2 : p.cima?.segunda === q.cima ? 1 : 0;
  if (q.baixo) n += p.baixo?.cor === q.baixo ? 2 : p.baixo?.segunda === q.baixo ? 1 : 0;
  if (q.faixa) {
    const f = FAIXAS.find((x) => x.id === q.faixa)!;
    if (p.altura_cm == null) {
      // Câmera vista de cima: não dá pra saber a altura. Fora, a não ser que peçam.
      if (!incluirSemEstatura) return -1;
    } else if (p.altura_cm < f.min || p.altura_cm > f.max) return -1;
    else n += 2;
  }
  return n;
}

/** Junta aparições da mesma pessoa na mesma câmera (o rastreio perdeu e
 * deu outro ID): mesmas cores, altura parecida e nunca na imagem ao mesmo
 * tempo. Fica a aparição com o maior recorte; as outras viram contagem. */
function agrupar(lista: Omit<Candidato, 'aparicoes'>[]): Candidato[] {
  const grupos: { base: Omit<Candidato, 'aparicoes'>; membros: PessoaCaso[] }[] = [];
  for (const r of lista) {
    const g = grupos.find(
      ({ base, membros }) =>
        base.caso.camera === r.caso.camera &&
        base.p.cima?.cor === r.p.cima?.cor &&
        base.p.baixo?.cor === r.p.baixo?.cor &&
        Math.abs((base.p.altura_cm ?? 0) - (r.p.altura_cm ?? 0)) <= 15 &&
        membros.every((m) => r.p.saida < m.entrada || r.p.entrada > m.saida)
    );
    if (g) g.membros.push(r.p);
    else grupos.push({ base: r, membros: [r.p] });
  }
  return grupos.map(({ base, membros }) => ({ ...base, aparicoes: membros.length }));
}

type Auditoria = { quando: string; texto: string };

export function CasoCrianca({ urlMotor, usuario }: { urlMotor: string; usuario: string }) {
  const [casos, setCasos] = useState<Caso[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ativa, setAtiva] = useState(true);
  const [texto, setTexto] = useState('');
  // Começa procurando só crianças: com o shopping cheio, é o filtro que mais corta.
  const [q, setQ] = useState<Consulta>({ faixa: 'crianca' });
  const [incluirSemEstatura, setIncluirSemEstatura] = useState(false);
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

  const totalPessoas = casos?.reduce((s, c) => s + c.pessoas.length, 0) ?? 0;
  const totalCriancas = casos?.reduce((s, c) => s + c.pessoas.filter((p) => p.altura_cm != null && p.altura_cm <= 135).length, 0) ?? 0;

  const resultados: Candidato[] = useMemo(() => {
    if (!casos) return [];
    const max = (q.cima ? 2 : 0) + (q.baixo ? 2 : 0) + (q.faixa ? 2 : 0);
    const lista = casos
      .filter((c) => !andar || c.andar === andar)
      .flatMap((c) => c.pessoas.filter((p) => p.recorte).map((p) => ({ caso: c, p, nota: pontuar(p, q, incluirSemEstatura), max })))
      .filter((r) => r.nota >= 0 && r.nota >= r.max - 2)
      // Maior recorte primeiro: é ele que representa o grupo.
      .sort((a, b) => b.nota - a.nota || area(b.p) - area(a.p));
    return agrupar(lista)
      .sort((a, b) => b.nota - a.nota || (a.p.altura_cm ?? 999) - (b.p.altura_cm ?? 999))
      .slice(0, 24);
  }, [q, incluirSemEstatura, casos, andar]);

  const chave = (r: Candidato) => `${r.caso.camera}#${r.p.id}`;
  const sel = resultados.find((r) => chave(r) === selId) ?? resultados[0];

  useEffect(() => {
    if (sel) setIrPara({ t: Math.max(0, (sel.p.t_recorte ?? sel.p.entrada) - 1.5), k: Date.now() });
  }, [sel?.caso.camera, sel?.p.id]);

  function registrar(descricao: string) {
    const agora = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    setAuditoria((a) => [{ quando: `${agora.slice(8, 10)}/${agora.slice(5, 7)} ${agora.slice(11, 19)}`, texto: descricao }, ...a]);
  }

  // O texto da família preenche os botões (sem apagar o que ele não citou).
  function buscar(t = texto) {
    if (!t.trim()) return;
    setTexto(t);
    setQ((atual) => ({ ...atual, ...interpretar(t) }));
    setSelId(null);
    registrar(t);
  }

  function mudar(parcial: Consulta) {
    const nova = { ...q, ...parcial };
    setQ(nova);
    setSelId(null);
    registrar(descrever(nova));
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

          <div className="mt-4 flex flex-col gap-3 rounded-sm border border-outline-variant p-3">
            <Grupo titulo="Idade aparente">
              {FAIXAS.map((f) => (
                <Chip key={f.id} ativo={q.faixa === f.id} onClick={() => mudar({ faixa: q.faixa === f.id ? undefined : f.id })} titulo={f.dica}>
                  {f.rotulo} <span className="opacity-70">{f.dica}</span>
                </Chip>
              ))}
              <Chip ativo={!q.faixa} onClick={() => mudar({ faixa: undefined })}>
                Qualquer idade
              </Chip>
            </Grupo>
            {(['cima', 'baixo'] as const).map((parte) => (
              <Grupo key={parte} titulo={parte === 'cima' ? 'Roupa de cima (blusa, camiseta, casaco)' : 'Roupa de baixo (calça, short, saia)'}>
                {CORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => mudar({ [parte]: q[parte] === c ? undefined : c })}
                    className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs capitalize', q[parte] === c ? 'border-primary bg-primary/10 font-semibold text-on-surface ring-2 ring-primary/30' : 'border-outline-variant text-on-surface hover:bg-surface-container-low')}
                  >
                    <span className="inline-block h-3 w-3 rounded-full border border-black/20" style={{ background: HEX[c] }} />
                    {c}
                  </button>
                ))}
              </Grupo>
            ))}
            {q.faixa && (
              <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                <input type="checkbox" checked={incluirSemEstatura} onChange={(e) => setIncluirSemEstatura(e.target.checked)} />
                Incluir câmeras vistas de cima (lá não dá pra medir a altura, então aparecem adultos também)
              </label>
            )}
            {(q.cima || q.baixo || q.faixa !== 'crianca' || texto) && (
              <button
                type="button"
                className="self-start text-xs text-primary hover:underline"
                onClick={() => {
                  setTexto('');
                  setQ({ faixa: 'crianca' });
                  setSelId(null);
                }}
              >
                Limpar e começar de novo
              </button>
            )}
          </div>

          {casos && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-on-surface-variant">{resultados.length} pessoa(s) compatível(is) · cada pessoa aparece uma vez · o sistema sugere, um agente da Segurança confirma</p>
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
                      {r.p.altura_cm != null ? `~${(r.p.altura_cm / 100).toFixed(2).replace('.', ',')} m` : 'altura ?'}
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      {r.nota >= r.max ? 'alta' : 'média'} semelhança{r.aparicoes > 1 ? ` · vista ${r.aparicoes}x nesta câmera` : ''}
                    </p>
                    {confirmados.includes(chave(r)) && <Badge variant="success" className="mt-1">Confirmado</Badge>}
                  </button>
                ))}
              </div>
              {resultados.length === 0 && <p className="text-sm text-on-surface-variant">Ninguém compatível. Tente tirar uma cor, marcar a faixa vizinha (ex.: Adolescente) ou incluir as câmeras vistas de cima.</p>}
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
                <li>Altura estimada: <b className="text-on-surface">{sel.p.altura_cm != null ? `~${(sel.p.altura_cm / 100).toFixed(2).replace('.', ',')} m (${FAIXAS.filter((f) => sel.p.altura_cm! >= f.min && sel.p.altura_cm! <= f.max).map((f) => f.rotulo.toLowerCase()).join(' ou ')})` : 'não estimável (câmera vista de cima)'}</b></li>
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
              <li>Idade aparente: vem da altura da pessoa na imagem comparada com a de um adulto no mesmo ponto do piso (a perspectiva muda o tamanho). A estimativa erra uns 10-15 cm, por isso as faixas se sobrepõem e um adolescente baixo pode aparecer como criança. Em câmera vista de cima não dá pra medir.</li>
              <li>A mesma pessoa vista várias vezes na mesma câmera (o rastreio perdeu e reencontrou) aparece uma vez só, com o melhor recorte.</li>
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

function area(p: PessoaCaso): number {
  return Math.max(0, ...p.pontos.map(([, x1, y1, x2, y2]) => (x2 - x1) * (y2 - y1)));
}

function descrever(q: Consulta): string {
  const partes = [q.faixa ? FAIXAS.find((f) => f.id === q.faixa)!.rotulo.toLowerCase() : 'qualquer idade'];
  if (q.cima) partes.push(`roupa de cima ${q.cima}`);
  if (q.baixo) partes.push(`roupa de baixo ${q.baixo}`);
  return `filtros: ${partes.join(', ')}`;
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{titulo}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ ativo, onClick, titulo, children }: { ativo: boolean; onClick: () => void; titulo?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={titulo}
      onClick={onClick}
      className={cn('rounded-full border px-3 py-1 text-xs', ativo ? 'border-primary bg-primary/10 font-semibold text-on-surface ring-2 ring-primary/30' : 'border-outline-variant text-on-surface hover:bg-surface-container-low')}
    >
      {children}
    </button>
  );
}

function Bolinha({ cor }: { cor?: string }) {
  if (!cor) return null;
  return <span className="inline-block h-2.5 w-2.5 rounded-full border border-black/20" style={{ background: HEX[cor as Cor] ?? '#999' }} title={cor} />;
}
