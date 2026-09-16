import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { registrarEventoUso } from '@/lib/usoDigital';

/**
 * POST /api/uso-digital/eventos — contrato de ingestão pro FUTURO agente
 * de desktop (não construído nesta sessão, ver DECISIONS.md). Autentica
 * por chave de API da empresa (não sessão de navegador — o agente roda
 * em background, sem usuário logado no app).
 *
 * Header: Authorization: Bearer <chave_api da empresa>
 * Body JSON:
 *   {
 *     "codigoAgente": "AGT-1000",       // código estável do colaborador (ver colaboradores.codigo_agente)
 *     "aplicativoOuSite": "AutoCAD",    // nome do app em foco ou domínio do site
 *     "cliques": 12,                     // cliques/interações desde o último envio
 *     "ocorridoEm": "2026-09-16T14:32:00Z" // opcional, default = agora
 *   }
 *
 * Resposta 201: { ok: true }
 * O agente deve enviar em lote/intervalo curto (ex: a cada 1-5 min) — um
 * evento por (app, intervalo), não um POST por clique individual.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const chave = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!chave) {
    return NextResponse.json({ error: 'Authorization: Bearer <chave_api> obrigatório.' }, { status: 401 });
  }

  const empresas = await sql<{ id: number }[]>`SELECT id FROM empresas WHERE chave_api = ${chave} AND ativo = true`;
  const empresa = empresas[0];
  if (!empresa) {
    return NextResponse.json({ error: 'Chave de API inválida.' }, { status: 401 });
  }

  const body = await req.json();
  const codigoAgente = String(body.codigoAgente ?? '');
  const aplicativoOuSite = String(body.aplicativoOuSite ?? '').trim();
  const cliques = Number(body.cliques ?? 0);

  if (!codigoAgente || !aplicativoOuSite || !Number.isFinite(cliques) || cliques <= 0) {
    return NextResponse.json({ error: 'codigoAgente, aplicativoOuSite e cliques (> 0) são obrigatórios.' }, { status: 400 });
  }

  const colaboradores = await sql<{ id: number }[]>`
    SELECT id FROM colaboradores WHERE empresa_id = ${empresa.id} AND codigo_agente = ${codigoAgente}
  `;
  const colaborador = colaboradores[0];
  if (!colaborador) {
    return NextResponse.json({ error: 'codigoAgente não corresponde a nenhum colaborador desta empresa.' }, { status: 404 });
  }

  await registrarEventoUso({
    empresaId: empresa.id,
    colaboradorId: colaborador.id,
    dispositivoId: null,
    aplicativoOuSite,
    cliques,
    ocorridoEm: body.ocorridoEm ? new Date(body.ocorridoEm) : new Date(),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
