'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Secao } from '@/components/shopping/Comum';
import { Planta } from '@/components/shopping/Planta';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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

type Busca = { q: Consulta; andar: string; incluirSemEstatura: boolean };

function procurar(casos: Caso[], { q, andar, incluirSemEstatura }: Busca): Candidato[] {
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
  const resultadosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    carregarIndice(urlMotor)
      .then((ind) => Promise.all(ind.map((i) => carregarCaso(urlMotor, i.camera))))
      .then(setCasos)
      .catch((e) => setErro(String(e.message ?? e)));
  }, [urlMotor]);

  const totalPessoas = casos?.reduce((s, c) => s + c.pessoas.length, 0) ?? 0;
  const totalCriancas = casos?.reduce((s, c) => s + c.pessoas.filter((p) => p.altura_cm != null && p.altura_cm <= 135).length, 0) ?? 0;

  // Os resultados só aparecem ao clicar em Buscar.
  const [buscada, setBuscada] = useState<Busca | null>(null);
  const resultados = useMemo(() => (casos && buscada ? procurar(casos, buscada) : []), [casos, buscada]);
  const mudouDesdeBusca = !!buscada && JSON.stringify(buscada) !== JSON.stringify({ q, andar, incluirSemEstatura });

  const chave = (r: Candidato) => `${r.caso.camera}#${r.p.id}`;
  const sel = resultados.find((r) => chave(r) === selId) ?? resultados[0];

  useEffect(() => {
    if (sel) setIrPara({ t: Math.max(0, (sel.p.t_recorte ?? sel.p.entrada) - 1.5), k: Date.now() });
  }, [sel?.caso.camera, sel?.p.id]);

  function registrar(descricao: string) {
    const agora = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    setAuditoria((a) => [{ quando: `${agora.slice(8, 10)}/${agora.slice(5, 7)} ${agora.slice(11, 19)}`, texto: descricao }, ...a]);
  }

  // O texto da família vai marcando os botões enquanto é digitado (sem
  // desmarcar o que ele não cita).
  function digitar(t: string) {
    setTexto(t);
    setQ((atual) => ({ ...atual, ...interpretar(t) }));
  }

  function mudar(parcial: Consulta) {
    setQ((atual) => ({ ...atual, ...parcial }));
  }

  function buscar() {
    setBuscada({ q, andar, incluirSemEstatura });
    setSelId(null);
    registrar(texto.trim() ? `${texto.trim()} (${descrever(q)})` : descrever(q));
    requestAnimationFrame(() => resultadosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
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
        <Secao titulo="Descreva a criança" descricao={casos ? `Procurando em ${casos.length} câmeras · ${totalPessoas} pessoas registradas (${totalCriancas} com altura de criança)` : 'Carregando as câmeras…'} className="xl:col-span-2">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              buscar();
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Seletor
                rotulo="Idade aparente"
                valor={q.faixa ? FAIXAS.find((f) => f.id === q.faixa)!.rotulo : 'Qualquer idade'}
                detalhe={q.faixa ? FAIXAS.find((f) => f.id === q.faixa)!.dica : undefined}
                icone={<IconePessoa escala={q.faixa === 'crianca' ? 0.62 : q.faixa === 'adolescente' ? 0.82 : 1} />}
              >
                {(fechar) => (
                  <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
                    {[...FAIXAS.map((f) => ({ id: f.id as Faixa | undefined, rotulo: f.rotulo, dica: f.dica, escala: f.id === 'crianca' ? 0.62 : f.id === 'adolescente' ? 0.82 : 1 })), { id: undefined, rotulo: 'Qualquer', dica: 'todas as idades', escala: 0 }].map((o) => (
                      <button
                        key={o.rotulo}
                        type="button"
                        onClick={() => {
                          mudar({ faixa: o.id });
                          fechar();
                        }}
                        className={cn('flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-center transition-colors', q.faixa === o.id ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'border-outline-variant hover:bg-surface-container-low')}
                      >
                        <span className="flex h-12 items-end text-on-surface-variant">{o.escala ? <IconePessoa escala={o.escala} grande /> : <span className="text-2xl leading-none">∗</span>}</span>
                        <span className="text-sm font-semibold text-on-surface">{o.rotulo}</span>
                        <span className="text-[11px] text-on-surface-variant">{o.dica}</span>
                      </button>
                    ))}
                  </div>
                )}
              </Seletor>
              <Seletor
                rotulo="Onde procurar"
                valor={andar === 'T' ? 'Térreo' : andar === 'P1' ? 'Piso 1' : 'Shopping todo'}
                detalhe={incluirSemEstatura ? 'inclui câmeras vistas de cima' : undefined}
                icone={<IconeLocal />}
              >
                {(fechar) => (
                  <div className="flex flex-col gap-1 p-2">
                    {([['', 'Shopping todo'], ['T', 'Térreo'], ['P1', 'Piso 1']] as const).map(([v, nome]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setAndar(v);
                          fechar();
                        }}
                        className={cn('flex items-center justify-between rounded-md px-3 py-2 text-left text-sm', andar === v ? 'bg-primary/10 font-semibold text-on-surface' : 'text-on-surface hover:bg-surface-container-low')}
                      >
                        {nome}
                        {andar === v && <span className="text-primary">✓</span>}
                      </button>
                    ))}
                    <label className="mt-1 flex items-start gap-2 border-t border-outline-variant px-3 pt-2 text-xs text-on-surface-variant">
                      <input type="checkbox" className="mt-0.5" checked={incluirSemEstatura} onChange={(e) => setIncluirSemEstatura(e.target.checked)} />
                      Incluir câmeras vistas de cima (lá não dá pra medir a altura, então aparecem adultos também)
                    </label>
                  </div>
                )}
              </Seletor>
              {(['cima', 'baixo'] as const).map((parte) => (
                <Seletor
                  key={parte}
                  rotulo={parte === 'cima' ? 'Roupa de cima' : 'Roupa de baixo'}
                  valor={q[parte] ? q[parte]!.charAt(0).toUpperCase() + q[parte]!.slice(1) : 'Qualquer cor'}
                  detalhe={parte === 'cima' ? 'blusa, camiseta, casaco' : 'calça, short, saia'}
                  icone={<span className="block h-6 w-6 rounded-full border border-black/15" style={q[parte] ? { background: HEX[q[parte]!] } : { background: 'conic-gradient(#c62828, #f9c80e, #2e7d32, #1565c0, #6a1b9a, #c62828)' }} />}
                >
                  {(fechar) => (
                    <div className="p-3">
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {CORES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              mudar({ [parte]: c });
                              fechar();
                            }}
                            className={cn('flex flex-col items-center gap-1 rounded-md p-1.5 text-[11px] capitalize text-on-surface-variant hover:bg-surface-container-low', q[parte] === c && 'bg-primary/10 font-semibold text-on-surface')}
                          >
                            <span className={cn('block h-9 w-9 rounded-full border border-black/15 shadow-sm', q[parte] === c && 'ring-2 ring-primary ring-offset-2 ring-offset-surface')} style={{ background: HEX[c] }} />
                            {c}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          mudar({ [parte]: undefined });
                          fechar();
                        }}
                        className="mt-2 w-full rounded-md border border-outline-variant py-1.5 text-xs text-on-surface hover:bg-surface-container-low"
                      >
                        Qualquer cor / não sabe
                      </button>
                    </div>
                  )}
                </Seletor>
              ))}
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-on-surface-variant">O que a família informou (opcional)</span>
              <input
                value={texto}
                onChange={(e) => digitar(e.target.value)}
                className="h-11 w-full rounded-md border border-outline-variant bg-surface px-3 text-sm text-on-surface outline-none focus:border-primary"
                placeholder="Ex.: menina de blusa rosa e calça preta"
              />
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-on-surface-variant">
                O texto preenche os campos acima. Exemplos:
                {EXEMPLOS.map((ex) => (
                  <button key={ex} type="button" onClick={() => digitar(ex)} className="text-primary hover:underline" disabled={!casos}>
                    “{ex}”
                  </button>
                ))}
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" className="h-12 min-w-56 flex-1 text-base" disabled={!casos}>
                <span className="flex items-center justify-center gap-2">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" strokeLinecap="round" /></svg>
                  Buscar nas câmeras
                </span>
              </Button>
              {(q.cima || q.baixo || q.faixa !== 'crianca' || texto || andar) && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    setTexto('');
                    setQ({ faixa: 'crianca' });
                    setAndar('');
                    setBuscada(null);
                    setSelId(null);
                  }}
                >
                  Limpar
                </button>
              )}
            </div>
          </form>

          {buscada && (
            <div ref={resultadosRef} className="mt-6 scroll-mt-4 border-t border-outline-variant pt-4">
              <p className="mb-1 text-sm font-semibold text-on-surface">{resultados.length} pessoa(s) encontrada(s)</p>
              <p className="mb-3 text-xs text-on-surface-variant">Cada pessoa aparece uma vez · o sistema sugere, um agente da Segurança confirma</p>
              {mudouDesdeBusca && <p className="mb-3 rounded-sm bg-primary/10 px-3 py-2 text-xs text-on-surface">A descrição mudou. Clique em Buscar nas câmeras para atualizar os resultados.</p>}
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

/** Campo da descrição: mostra a escolha atual e abre um painel com as opções. */
function Seletor({ rotulo, valor, detalhe, icone, children }: { rotulo: string; valor: string; detalhe?: string; icone: React.ReactNode; children: (fechar: () => void) => React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);
  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        className={cn('flex w-full items-center gap-3 rounded-md border bg-surface px-3 py-2.5 text-left transition-colors', aberto ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant hover:border-on-surface-variant')}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">{icone}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">{rotulo}</span>
          <span className="block truncate text-sm font-semibold text-on-surface">
            {valor}
            {detalhe && <span className="ml-1.5 text-xs font-normal text-on-surface-variant">{detalhe}</span>}
          </span>
        </span>
        <svg viewBox="0 0 16 16" className={cn('h-4 w-4 shrink-0 text-on-surface-variant transition-transform', aberto && 'rotate-180')} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {aberto && <div className="absolute left-0 right-0 top-full z-30 mt-1.5 min-w-72 rounded-md border border-outline-variant bg-surface shadow-lg sm:right-auto sm:w-[28rem]">{children(() => setAberto(false))}</div>}
    </div>
  );
}

function IconePessoa({ escala, grande }: { escala: number; grande?: boolean }) {
  const h = (grande ? 44 : 22) * escala;
  return (
    <svg viewBox="0 0 24 48" style={{ height: h, width: h / 2 }} fill="currentColor" aria-hidden>
      <circle cx="12" cy="6" r="5" />
      <path d="M5 14a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v12h-3v20h-3.5V30h-1v16H8V26H5z" />
    </svg>
  );
}

function IconeLocal() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M10 18s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" />
      <circle cx="10" cy="8" r="2.2" />
    </svg>
  );
}

function Bolinha({ cor }: { cor?: string }) {
  if (!cor) return null;
  return <span className="inline-block h-2.5 w-2.5 rounded-full border border-black/20" style={{ background: HEX[cor as Cor] ?? '#999' }} title={cor} />;
}
