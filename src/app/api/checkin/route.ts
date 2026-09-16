import { NextRequest, NextResponse } from 'next/server';
import { getSessaoAtual } from '@/lib/sessaoServidor';
import { registrarPonto, rotuloMarcacao } from '@/lib/ponto';
import { obterColaborador } from '@/lib/cadastros';

// POST /api/checkin — registra o ponto. SEMPRE grava, mesmo se a IA
// reprovar (requisito explícito) — a resposta pro colaborador nunca
// inclui o resultado da análise, só a confirmação do registro em si.
export async function POST(req: NextRequest) {
  const sessao = await getSessaoAtual();
  if (!sessao) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const body = await req.json();
  // ADMIN pode registrar em nome de qualquer colaborador da empresa
  // (check-in assistido); um usuário comum só registra o próprio.
  const colaboradorId: number | null = sessao.role === 'ADMIN' ? Number(body.colaboradorId) : sessao.colaboradorId;

  if (!colaboradorId) {
    return NextResponse.json({ error: 'Este usuário não está vinculado a um colaborador.' }, { status: 400 });
  }

  const colaborador = await obterColaborador(sessao.empresaId, colaboradorId);
  if (!colaborador) {
    return NextResponse.json({ error: 'Colaborador não encontrado.' }, { status: 404 });
  }

  const registro = await registrarPonto({
    empresaId: sessao.empresaId,
    colaboradorId,
    fotoDataUrl: String(body.fotoDataUrl ?? ''),
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    enderecoAprox: body.enderecoAprox ?? null,
  });

  // Nunca devolve `analise_ia` aqui — só visível pra gestão (ver Cartão
  // Ponto), nunca pro colaborador na hora do registro.
  return NextResponse.json({
    tipo: registro.tipo,
    rotulo: rotuloMarcacao(registro.tipo),
    registradoEm: registro.registrado_em,
  });
}
