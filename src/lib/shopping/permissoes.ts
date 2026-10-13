// Abas do painel do shopping e permissões por usuário. Usado no servidor
// (bloqueio das páginas e ações) e na tela (sidebar, cadastro de usuários).

export type AbaId = 'visao-geral' | 'cameras' | 'mapa-calor' | 'zonas-mortas' | 'comparativo' | 'rotas' | 'crianca-perdida' | 'pergunte' | 'usuarios' | 'configuracoes';

export type Aba = { id: AbaId; nome: string; rotas: string[]; descricao: string; soAdminGeral?: boolean; seguranca?: boolean };

export const ABAS: Aba[] = [
  { id: 'visao-geral', nome: 'Visão geral', rotas: ['/shopping'], descricao: 'Números do dia, entradas e corredores mais movimentados' },
  { id: 'mapa-calor', nome: 'Mapa de calor', rotas: ['/shopping/mapa-calor'], descricao: 'Onde as pessoas circulam e ficam' },
  { id: 'zonas-mortas', nome: 'Zonas mortas', rotas: ['/shopping/zonas-mortas'], descricao: 'Áreas abaixo da média e teste de ações' },
  { id: 'comparativo', nome: 'Comparativos', rotas: ['/shopping/comparativo'], descricao: 'Comparar períodos' },
  { id: 'rotas', nome: 'Rotas e fluxo', rotas: ['/shopping/rotas'], descricao: 'Caminhos e fluxos entre áreas' },
  { id: 'crianca-perdida', nome: 'Busca de criança perdida', rotas: ['/shopping/crianca-perdida'], descricao: 'Procurar criança pela descrição da família', seguranca: true },
  { id: 'pergunte', nome: 'Pergunte ao Argus', rotas: [], descricao: 'Chat com perguntas sobre os dados das abas que o usuário vê' },
  { id: 'cameras', nome: 'Câmeras', rotas: ['/shopping/ao-vivo', '/shopping/cameras'], descricao: 'Câmeras ao vivo e saúde do sistema', seguranca: true },
  { id: 'usuarios', nome: 'Usuários', rotas: ['/shopping/usuarios'], descricao: 'Cadastro de usuários e permissões', soAdminGeral: true },
  { id: 'configuracoes', nome: 'Configurações', rotas: ['/shopping/configuracoes'], descricao: 'Dados do shopping, horários, retenção e limites', soAdminGeral: true },
];

export const ABAS_IDS = ABAS.map((a) => a.id);

/** Perfis prontos: preenchem as abas; o administrador ajusta depois. */
export const PERFIS_MODELO: { id: string; nome: string; abas: AbaId[] }[] = [
  { id: 'seguranca', nome: 'Segurança', abas: ['visao-geral', 'cameras', 'crianca-perdida'] },
  { id: 'administracao', nome: 'Administração do Shopping', abas: ['visao-geral', 'mapa-calor', 'zonas-mortas', 'comparativo', 'rotas', 'pergunte', 'cameras'] },
];

export type Permissoes = { adminGeral: boolean; abas: string[] };

export function podeVer(p: Permissoes, aba: AbaId): boolean {
  const a = ABAS.find((x) => x.id === aba);
  if (!a) return false;
  if (a.soAdminGeral) return p.adminGeral;
  return p.adminGeral || p.abas.includes(aba);
}

/** Aba de uma rota do painel (o prefixo mais longo que bate). */
export function abaDaRota(pathname: string): AbaId | undefined {
  let melhor: { id: AbaId; tam: number } | undefined;
  for (const a of ABAS)
    for (const r of a.rotas) {
      const bate = r === '/shopping' ? pathname === '/shopping' : pathname === r || pathname.startsWith(`${r}/`);
      if (bate && (!melhor || r.length > melhor.tam)) melhor = { id: a.id, tam: r.length };
    }
  return melhor?.id;
}

/** Primeira página que o usuário pode abrir (null = nenhuma aba do shopping). */
export function primeiraRota(p: Permissoes): string | null {
  for (const a of ABAS) if (a.rotas.length && podeVer(p, a.id)) return a.rotas[0];
  return null;
}

/** Limpa uma lista vinda de formulário: só abas conhecidas e que não sejam exclusivas do administrador geral. */
export function abasValidas(lista: string[]): AbaId[] {
  return ABAS.filter((a) => !a.soAdminGeral && lista.includes(a.id)).map((a) => a.id);
}
