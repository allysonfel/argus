'use server';

import { revalidatePath } from 'next/cache';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirAbaAcao } from '@/lib/sessaoServidor';
import { obterConfiguracoes, salvarConfiguracoes, type CamposConfiguracoes } from '@/lib/shopping/configuracoes';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const FUSOS = ['America/Recife', 'America/Fortaleza', 'America/Bahia', 'America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'America/Cuiaba', 'America/Rio_Branco', 'America/Noronha'];
const LOGO_MAX = 400_000; // ~300 KB de imagem em data URL

export async function salvar(c: CamposConfiguracoes): Promise<{ ok: true } | { ok: false; erro: string }> {
  const eu = await exigirAbaAcao('configuracoes');
  const entre = (v: number, min: number, max: number) => Number.isFinite(v) && v >= min && v <= max;
  if (!c.nome.trim()) return { ok: false, erro: 'Informe o nome do shopping.' };
  if (!FUSOS.includes(c.fuso)) return { ok: false, erro: 'Fuso horário inválido.' };
  for (const h of [c.abre, c.fecha, c.domingo_abre, c.domingo_fecha]) if (!HORA.test(h)) return { ok: false, erro: 'Horário no formato HH:MM.' };
  if (c.abre >= c.fecha || c.domingo_abre >= c.domingo_fecha) return { ok: false, erro: 'O horário de abrir precisa ser antes do de fechar.' };
  if (c.logo && (c.logo.length > LOGO_MAX || !/^data:image\/(png|jpeg|svg\+xml|webp);base64,/.test(c.logo))) return { ok: false, erro: 'Logo: use PNG, JPG, SVG ou WebP de até 300 KB.' };
  if (!entre(c.retencao_evidencias_dias, 1, 365)) return { ok: false, erro: 'Retenção de evidências: de 1 a 365 dias.' };
  if (!entre(c.retencao_busca_crianca_horas, 1, 168)) return { ok: false, erro: 'Buffer da busca de criança: de 1 a 168 horas.' };
  if (!entre(c.pergunte_limite_dia, 0, 500)) return { ok: false, erro: 'Limite do Pergunte ao Argus: de 0 a 500 por dia.' };
  if (!entre(c.deteccao_confianca, 0.1, 0.9)) return { ok: false, erro: 'Confiança mínima da detecção: de 0,10 a 0,90.' };
  if (!entre(c.deteccao_fps, 0.5, 15)) return { ok: false, erro: 'Análises por segundo: de 0,5 a 15.' };
  if (!entre(c.sessao_horas, 1, 720)) return { ok: false, erro: 'Duração da sessão: de 1 a 720 horas.' };
  if (!entre(c.max_tentativas, 3, 20)) return { ok: false, erro: 'Tentativas antes do bloqueio: de 3 a 20.' };
  if (!entre(c.bloqueio_minutos, 1, 1440)) return { ok: false, erro: 'Tempo de bloqueio: de 1 a 1440 minutos.' };

  const antes = await obterConfiguracoes(eu.empresaId);
  await salvarConfiguracoes(eu.empresaId, { ...c, nome: c.nome.trim(), cidade: c.cidade.trim() });
  const mudou = (Object.keys(c) as (keyof CamposConfiguracoes)[]).filter((k) => k !== 'logo' && String(antes[k]) !== String(c[k]));
  if (antes.logo !== c.logo) mudou.push('logo');
  await registrarAuditoria({ empresaId: eu.empresaId, usuarioId: eu.id, acao: 'configuracoes_alteradas', detalhes: { campos: mudou } });
  revalidatePath('/shopping', 'layout');
  return { ok: true };
}
