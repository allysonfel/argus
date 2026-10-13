import { sql } from './db';

// Log de auditoria: quem fez o quê e quando (login, cadastros, permissões,
// senhas, configurações). Nunca apagado pela tela.

export type AcaoAuditoria =
  | 'login'
  | 'login_falhou'
  | 'login_bloqueado'
  | 'logout'
  | 'senha_trocada'
  | 'senha_redefinida'
  | 'usuario_criado'
  | 'usuario_editado'
  | 'permissoes_alteradas'
  | 'usuario_desativado'
  | 'usuario_reativado'
  | 'usuario_desbloqueado'
  | 'configuracoes_alteradas'
  | 'pergunte';

export async function registrarAuditoria(a: { empresaId: number | null; usuarioId: number | null; acao: AcaoAuditoria; alvoUsuarioId?: number | null; detalhes?: Record<string, unknown> }) {
  await sql`
    INSERT INTO auditoria (empresa_id, usuario_id, alvo_usuario_id, acao, detalhes)
    VALUES (${a.empresaId}, ${a.usuarioId}, ${a.alvoUsuarioId ?? null}, ${a.acao}, ${a.detalhes ? sql.json(a.detalhes as never) : null})
  `;
}

export type LinhaAuditoria = { id: number; criado_em: Date; acao: AcaoAuditoria; quem: string | null; alvo: string | null; detalhes: Record<string, unknown> | null };

export async function listarAuditoria(empresaId: number, limite = 150): Promise<LinhaAuditoria[]> {
  return sql<LinhaAuditoria[]>`
    SELECT a.id, a.criado_em, a.acao, q.nome AS quem, al.nome AS alvo, a.detalhes
    FROM auditoria a
    LEFT JOIN usuarios q ON q.id = a.usuario_id
    LEFT JOIN usuarios al ON al.id = a.alvo_usuario_id
    WHERE a.empresa_id = ${empresaId} AND a.acao <> 'pergunte'
    ORDER BY a.criado_em DESC
    LIMIT ${limite}
  `;
}

/** Perguntas feitas hoje ao Pergunte ao Argus (limite diário por usuário). */
export async function perguntasHoje(usuarioId: number, fuso: string): Promise<number> {
  const [r] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM auditoria
    WHERE usuario_id = ${usuarioId} AND acao = 'pergunte'
      AND (criado_em AT TIME ZONE ${fuso})::date = (now() AT TIME ZONE ${fuso})::date
  `;
  return r.n;
}
