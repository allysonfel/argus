'use server';

import { perguntasHoje, registrarAuditoria } from '@/lib/auditoria';
import { obterConfiguracoes } from '@/lib/shopping/configuracoes';
import { ABAS, podeVer, type AbaId } from '@/lib/shopping/permissoes';
import { exigirAbaAcao } from '@/lib/sessaoServidor';
import {
  agoraDemo,
  corredores,
  entradasDia,
  entradasPorHora,
  formatarData,
  formatarNumero,
  ocupacaoAgora,
  rankingZonas,
  serieDiaria,
  somarDias,
  zonasMortas,
} from '@/lib/shopping/demo';

// "Pergunte ao Argus" — MODO DEMONSTRAÇÃO. Na versão final, a pergunta
// vai para um LLM (provedor configurável, padrão Claude Haiku) com tool
// calling restrito às mesmas funções de consulta usadas aqui
// (fluxo_por_periodo, ranking_zonas, horario_de_pico, zonas_mortas...),
// recebendo SÓ dados agregados — nunca imagem, vídeo ou dado de
// segurança. Aqui o roteamento é por palavras-chave, sem IA.

export type RespostaArgus = {
  texto: string;
  /** Perguntas que o usuário já fez hoje (limite contado no servidor). */
  usadasHoje?: number;
  periodo?: string;
  grafico?: { tipo: 'barras' | 'linhas'; x: string; formatoX?: 'hora' | 'data'; dados: Record<string, string | number | null>[]; serie: string };
};

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function normalizar(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function totaisCorredor(inicio: string, fim: string): Record<string, number> {
  const r = rankingZonas(inicio, fim);
  return r.reduce<Record<string, number>>((acc, l) => {
    acc[l.zona.corredor] = (acc[l.zona.corredor] ?? 0) + l.total;
    return acc;
  }, {});
}

// Cada tema de resposta pertence a uma aba: o chat só responde o que o
// usuário poderia ver na tela.
function temaDa(p: string): AbaId | null {
  if (/zona.* mort|vazi|pouco movimento|parad/.test(p)) return 'zonas-mortas';
  if (/cresc|aument|caiu|queda|diminu/.test(p) || MESES.some((m) => p.includes(normalizar(m)))) return 'comparativo';
  if (/pico|horario|hora .*mais|mais cheio|lotad|agora|neste momento|quantas pessoas|ocupac|entrad|entrou|entraram|visitante|movimento|fluxo|corredor|mais movimentad|ranking|melhor|pior/.test(p)) return 'visao-geral';
  return null;
}

export async function perguntarArgus(pergunta: string): Promise<RespostaArgus> {
  let sessao;
  try {
    sessao = await exigirAbaAcao('pergunte');
  } catch (e) {
    return { texto: e instanceof Error ? e.message : 'Sem permissão.' };
  }
  const cfg = await obterConfiguracoes(sessao.empresaId);
  if (!cfg.pergunte_ativo) return { texto: 'O Pergunte ao Argus está desligado nas configurações.' };
  const usadas = await perguntasHoje(sessao.id, cfg.fuso);
  if (usadas >= cfg.pergunte_limite_dia) return { texto: `Você já fez ${cfg.pergunte_limite_dia} perguntas hoje, o limite diário. Amanhã libera de novo.`, usadasHoje: usadas };
  await registrarAuditoria({ empresaId: sessao.empresaId, usuarioId: sessao.id, acao: 'pergunte', detalhes: { pergunta: pergunta.slice(0, 300) } });
  const resposta = await responder(pergunta, sessao);
  return { ...resposta, usadasHoje: usadas + 1 };
}

async function responder(pergunta: string, sessao: { adminGeral: boolean; abas: string[] }): Promise<RespostaArgus> {
  const p = normalizar(pergunta);
  const { data: hoje } = agoraDemo();

  if (/crianca|seguranca|alarme|intrus|restrit|camera.*grav|rosto/.test(p)) {
    return { texto: 'Não consigo responder sobre segurança, buscas ou imagens pelo chat. Esses dados ficam restritos ao perfil Segurança, nas telas próprias.' };
  }

  const tema = temaDa(p);
  if (tema && !podeVer(sessao, tema)) {
    return { texto: `Essa pergunta usa dados da aba "${ABAS.find((a) => a.id === tema)!.nome}", que não está liberada para o seu usuário.` };
  }

  if (/zona.* mort|vazi|pouco movimento|parad/.test(p)) {
    const zm = zonasMortas(hoje).filter((z) => z.morta);
    const top = zonasMortas(hoje).slice(0, 6);
    return {
      texto: zm.length
        ? `${zm.length} área(s) de corredor estão abaixo de 40% da média do andar há pelo menos 2 semanas. A mais vazia é "${zm[0].zona.nome}", com ${Math.round(zm[0].indice * 100)}% da média.`
        : 'Nenhuma área está abaixo de 40% da média do andar por 2 semanas seguidas.',
      periodo: `Últimas 6 semanas até ${formatarData(hoje)}`,
      grafico: { tipo: 'barras', x: 'zona', serie: '% da média do andar', dados: top.map((z) => ({ zona: z.zona.nome.replace(/ \(lado .*\)/, '').replace('Corredor Principal', 'C. Princ.'), valor: Math.round(z.indice * 100) })) },
    };
  }

  const mesIdx = MESES.findIndex((m) => p.includes(normalizar(m)));
  if (/cresc|aument|caiu|queda|diminu/.test(p) || mesIdx >= 0) {
    const ano = Number(hoje.slice(0, 4));
    const mes = mesIdx >= 0 ? mesIdx : Number(hoje.slice(5, 7)) - 1;
    const anoRef = mes + 1 > Number(hoje.slice(5, 7)) ? ano - 1 : ano;
    const ini = `${anoRef}-${String(mes + 1).padStart(2, '0')}-01`;
    const fimMes = somarDias(mes === 11 ? `${anoRef + 1}-01-01` : `${anoRef}-${String(mes + 2).padStart(2, '0')}-01`, -1);
    const fim = fimMes > hoje ? hoje : fimMes;
    const dias = Math.round((new Date(fim).getTime() - new Date(ini).getTime()) / 86400000);
    const iniAnt = somarDias(ini, -dias - 1);
    const fimAnt = somarDias(ini, -1);
    const atual = totaisCorredor(ini, fim);
    const anterior = totaisCorredor(iniAnt, fimAnt);
    const variacoes = corredores()
      .map((c) => ({ c, pct: anterior[c] ? ((atual[c] - anterior[c]) / anterior[c]) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct);
    const maior = variacoes[0];
    return {
      texto: `O corredor que mais cresceu foi "${maior.c}": ${maior.pct >= 0 ? '+' : ''}${maior.pct.toFixed(1).replace('.', ',')}% de passagens em relação ao período anterior de mesmo tamanho. O que mais caiu foi "${variacoes.at(-1)!.c}" (${variacoes.at(-1)!.pct.toFixed(1).replace('.', ',')}%).`,
      periodo: `${formatarData(ini)} a ${formatarData(fim)} vs. ${formatarData(iniAnt)} a ${formatarData(fimAnt)}`,
      grafico: { tipo: 'barras', x: 'corredor', serie: 'Variação (%)', dados: variacoes.map((v) => ({ corredor: v.c.replace('Corredor Principal', 'C. Princ.').replace('Piso 1 · ', 'P1 '), valor: Math.round(v.pct * 10) / 10 })) },
    };
  }

  if (/pico|horario|hora .*mais|mais cheio|lotad/.test(p)) {
    const serie = entradasPorHora(hoje).filter((h) => h.valor !== null);
    const pico = serie.reduce((a, b) => ((b.valor ?? 0) > (a.valor ?? 0) ? b : a), serie[0]);
    return {
      texto: `Hoje o horário de pico até agora foi ${pico.hora}h–${pico.hora + 1}h, com ${formatarNumero(pico.valor ?? 0)} entradas estimadas.`,
      periodo: `Hoje, ${formatarData(hoje)}`,
      grafico: { tipo: 'linhas', x: 'hora', formatoX: 'hora', serie: 'Entradas', dados: serie.map((h) => ({ hora: h.hora, valor: h.valor })) },
    };
  }

  if (/agora|neste momento|quantas pessoas|ocupac/.test(p)) {
    return { texto: `Estimamos ${formatarNumero(ocupacaoAgora())} pessoas no shopping agora.`, periodo: 'Agora' };
  }

  if (/entrad|entrou|entraram|visitante|movimento|fluxo/.test(p)) {
    const ini = somarDias(hoje, -13);
    const serie = serieDiaria({ tipo: 'shopping' }, ini, hoje);
    return {
      texto: `Hoje entraram ${formatarNumero(entradasDia(hoje))} pessoas até agora (estimativa). Ontem foram ${formatarNumero(entradasDia(somarDias(hoje, -1)))}.`,
      periodo: `${formatarData(ini)} a ${formatarData(hoje)}`,
      grafico: { tipo: 'linhas', x: 'data', formatoX: 'data', serie: 'Entradas/dia', dados: serie.map((s) => ({ data: s.data, valor: s.valor })) },
    };
  }

  if (/corredor|mais movimentad|ranking|melhor|pior/.test(p)) {
    const ini = somarDias(hoje, -6);
    const totais = Object.entries(totaisCorredor(ini, hoje)).sort((a, b) => b[1] - a[1]);
    return {
      texto: `Nos últimos 7 dias, o corredor mais movimentado foi "${totais[0][0]}" e o menos movimentado foi "${totais.at(-1)![0]}".`,
      periodo: `${formatarData(ini)} a ${formatarData(hoje)}`,
      grafico: { tipo: 'barras', x: 'corredor', serie: 'Passagens', dados: totais.map(([c, v]) => ({ corredor: c.replace('Corredor Principal', 'C. Princ.').replace('Piso 1 · ', 'P1 '), valor: Math.round(v) })) },
    };
  }

  return {
    texto: 'Ainda não sei responder essa. Nesta demonstração eu respondo sobre: movimento de hoje, horário de pico, pessoas agora, corredores mais movimentados, crescimento por mês e zonas mortas.',
  };
}
