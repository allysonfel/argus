import type { AnaliseIA, CriteriosPonto } from './tipos';

/**
 * Análise de IA do check-in — MOCK determinístico (documentado em
 * DECISIONS.md). Não chama nenhuma API de visão computacional de
 * verdade nesta fase; simula um resultado plausível a partir de um
 * hash simples da selfie (base64) + colaboradorId, pra sempre dar o
 * mesmo resultado pro mesmo par foto+pessoa (repetível, útil pra
 * demonstração e teste), variando "aleatoriamente" de pessoa pra
 * pessoa como uma IA de verdade variaria.
 *
 * Contrato de substituição futura: trocar o corpo desta função por uma
 * chamada real (ex: AWS Rekognition pra rosto, um modelo de detecção de
 * objeto/classificação pra uniforme/crachá/calçado) mantendo a mesma
 * assinatura — nenhum outro módulo precisa mudar.
 */
export async function analisarCheckin(params: { fotoDataUrl: string; colaboradorId: number; criterios: CriteriosPonto }): Promise<AnaliseIA> {
  const semente = hashSimples(params.fotoDataUrl.slice(-200) + params.colaboradorId);

  const rosto_ok = !params.criterios.verificar_rosto || semente % 100 < 92;
  const uniforme_ok = !params.criterios.verificar_uniforme || semente % 97 < 85;
  const cracha_ok = !params.criterios.verificar_cracha || semente % 89 < 88;
  const calcado_ok = !params.criterios.verificar_calcado || semente % 83 < 90;

  const aprovado = rosto_ok && uniforme_ok && cracha_ok && calcado_ok;
  const confianca = 0.7 + (semente % 30) / 100;

  const pendencias = [
    !rosto_ok && 'rosto não confere com a referência',
    !uniforme_ok && 'uniforme não identificado',
    !cracha_ok && 'crachá não visível',
    !calcado_ok && 'calçado de segurança não identificado',
  ].filter(Boolean);

  return {
    rosto_ok,
    uniforme_ok,
    cracha_ok,
    calcado_ok,
    aprovado,
    confianca: Math.min(0.99, confianca),
    observacao: pendencias.length ? `Divergência: ${pendencias.join(', ')}.` : 'Todos os critérios conferem.',
  };
}

function hashSimples(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) {
    h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return h;
}
