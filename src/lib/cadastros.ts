import { sql } from './db';
import type { Unidade, Departamento, Colaborador, Dispositivo, StatusColaborador } from './tipos';

// Todo SELECT/INSERT aqui é escopado por empresaId — isolamento
// multi-tenant garantido na camada de aplicação (ver db/schema.sql).

export async function listarUnidades(empresaId: number): Promise<Unidade[]> {
  return sql<Unidade[]>`SELECT * FROM unidades WHERE empresa_id = ${empresaId} ORDER BY nome`;
}

export async function criarUnidade(empresaId: number, dados: { nome: string; cidade: string; estado: string; latitude?: number; longitude?: number }) {
  await sql`
    INSERT INTO unidades (empresa_id, nome, cidade, estado, latitude, longitude)
    VALUES (${empresaId}, ${dados.nome}, ${dados.cidade}, ${dados.estado}, ${dados.latitude ?? null}, ${dados.longitude ?? null})
  `;
}

export async function listarDepartamentos(empresaId: number): Promise<Departamento[]> {
  return sql<Departamento[]>`SELECT * FROM departamentos WHERE empresa_id = ${empresaId} ORDER BY nome`;
}

export async function criarDepartamento(empresaId: number, dados: { nome: string; unidadeId: number | null }) {
  await sql`INSERT INTO departamentos (empresa_id, unidade_id, nome) VALUES (${empresaId}, ${dados.unidadeId}, ${dados.nome})`;
}

export async function listarColaboradores(empresaId: number, filtros?: { status?: StatusColaborador; busca?: string }): Promise<Colaborador[]> {
  const status = filtros?.status;
  const busca = filtros?.busca?.trim();
  return sql<Colaborador[]>`
    SELECT * FROM colaboradores
    WHERE empresa_id = ${empresaId}
    ${status ? sql`AND status = ${status}` : sql``}
    ${busca ? sql`AND nome ILIKE ${'%' + busca + '%'}` : sql``}
    ORDER BY nome
  `;
}

export async function contarColaboradoresAtivos(empresaId: number): Promise<number> {
  const rows = await sql<{ count: string }[]>`SELECT count(*) FROM colaboradores WHERE empresa_id = ${empresaId} AND status = 'ativo'`;
  return Number(rows[0].count);
}

export async function obterColaborador(empresaId: number, id: number): Promise<Colaborador | null> {
  const rows = await sql<Colaborador[]>`SELECT * FROM colaboradores WHERE empresa_id = ${empresaId} AND id = ${id}`;
  return rows[0] ?? null;
}

export async function criarColaborador(
  empresaId: number,
  dados: {
    nome: string;
    cargo: string;
    cpf: string;
    email: string;
    telefone: string;
    unidadeId: number | null;
    departamentoId: number | null;
    dataAdmissao: string;
    jornadaSemanalHoras: number;
    horarioEntradaPadrao: string;
    horarioSaidaPadrao: string;
  }
): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO colaboradores
      (empresa_id, unidade_id, departamento_id, nome, cargo, cpf, email, telefone, data_admissao,
       jornada_semanal_horas, horario_entrada_padrao, horario_saida_padrao)
    VALUES
      (${empresaId}, ${dados.unidadeId}, ${dados.departamentoId}, ${dados.nome}, ${dados.cargo}, ${dados.cpf},
       ${dados.email}, ${dados.telefone}, ${dados.dataAdmissao || null},
       ${dados.jornadaSemanalHoras}, ${dados.horarioEntradaPadrao}, ${dados.horarioSaidaPadrao})
    RETURNING id
  `;
  return rows[0].id;
}

export async function atualizarStatusColaborador(empresaId: number, id: number, status: StatusColaborador) {
  await sql`UPDATE colaboradores SET status = ${status} WHERE empresa_id = ${empresaId} AND id = ${id}`;
}

export async function listarDispositivos(empresaId: number): Promise<Dispositivo[]> {
  return sql<Dispositivo[]>`SELECT * FROM dispositivos WHERE empresa_id = ${empresaId} ORDER BY nome`;
}

export async function criarDispositivo(
  empresaId: number,
  dados: { nome: string; tipo: 'notebook' | 'celular'; identificador: string; colaboradorId: number | null; unidadeId: number | null }
) {
  await sql`
    INSERT INTO dispositivos (empresa_id, colaborador_id, unidade_id, tipo, nome, identificador)
    VALUES (${empresaId}, ${dados.colaboradorId}, ${dados.unidadeId}, ${dados.tipo}, ${dados.nome}, ${dados.identificador})
  `;
}

export async function contarDispositivos(empresaId: number): Promise<{ total: number; online: number }> {
  const rows = await sql<{ total: string; online: string }[]>`
    SELECT count(*) AS total, count(*) FILTER (WHERE online) AS online
    FROM dispositivos WHERE empresa_id = ${empresaId}
  `;
  return { total: Number(rows[0].total), online: Number(rows[0].online) };
}
