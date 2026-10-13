// Popula o banco com uma empresa cliente de exemplo (Construtora Nordeste)
// e dados realistas em todos os módulos, pra dar pra navegar o sistema
// inteiro sem precisar cadastrar nada na mão primeiro.
import { sql } from '../src/lib/db';
import { hashSenha } from '../src/lib/auth';

function diasAtras(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function comHorario(data: Date, hora: number, minuto: number): Date {
  const d = new Date(data);
  d.setHours(hora, minuto, 0, 0);
  return d;
}

function aleatorio(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function escolher<T>(lista: T[]): T {
  return lista[aleatorio(0, lista.length - 1)];
}

async function main() {
  console.log('Limpando dados de exemplo anteriores (empresa "Construtora Nordeste")...');
  const existente = await sql<{ id: number }[]>`SELECT id FROM empresas WHERE nome = 'Construtora Nordeste Ltda'`;
  if (existente[0]) {
    await sql`DELETE FROM empresas WHERE id = ${existente[0].id}`; // cascade cuida do resto
  }

  console.log('Criando empresa...');
  const chaveApi = `argus_live_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  const [empresa] = await sql<{ id: number }[]>`
    INSERT INTO empresas (nome, cnpj, chave_api) VALUES ('Construtora Nordeste Ltda', '12.345.678/0001-90', ${chaveApi}) RETURNING id
  `;
  const empresaId = empresa.id;

  await sql`INSERT INTO criterios_ponto (empresa_id) VALUES (${empresaId})`;

  console.log('Criando unidades...');
  const unidadesDados = [
    { nome: 'Sede Caruaru', cidade: 'Caruaru', estado: 'PE', latitude: -8.2837, longitude: -35.9761 },
    { nome: 'Obra Recife Centro', cidade: 'Recife', estado: 'PE', latitude: -8.0631, longitude: -34.8711 },
    { nome: 'Obra Garanhuns', cidade: 'Garanhuns', estado: 'PE', latitude: -8.8837, longitude: -36.4966 },
  ];
  const unidades: { id: number; nome: string; latitude: number; longitude: number }[] = [];
  for (const u of unidadesDados) {
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO unidades (empresa_id, nome, cidade, estado, latitude, longitude)
      VALUES (${empresaId}, ${u.nome}, ${u.cidade}, ${u.estado}, ${u.latitude}, ${u.longitude}) RETURNING id
    `;
    unidades.push({ id: row.id, nome: u.nome, latitude: u.latitude, longitude: u.longitude });
  }

  console.log('Criando departamentos...');
  const nomesDepto = ['Engenharia', 'Administrativo', 'Operacional', 'Comercial'];
  const departamentos: { id: number; nome: string }[] = [];
  for (const nome of nomesDepto) {
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO departamentos (empresa_id, unidade_id, nome) VALUES (${empresaId}, ${escolher(unidades).id}, ${nome}) RETURNING id
    `;
    departamentos.push({ id: row.id, nome });
  }

  console.log('Criando colaboradores...');
  const nomes = [
    'Ana Beatriz Souza', 'Bruno Henrique Lima', 'Carla Fernanda Melo', 'Diego Santos Costa', 'Elaine Cristina Alves',
    'Fábio Ricardo Nunes', 'Gabriela Torres Farias', 'Hugo Vinícius Barbosa', 'Isabela Cavalcanti Rocha', 'João Pedro Andrade',
    'Karina Duarte Pereira', 'Lucas Gabriel Martins', 'Mariana Oliveira Dias', 'Nelson Augusto Ribeiro', 'Olívia Cristina Gomes',
    'Paulo Roberto Xavier', 'Quésia Ferreira Lopes', 'Rafael Tenório Moura', 'Sabrina Kelly Batista', 'Thiago Vasconcelos Silva',
  ];
  const cargos = ['Engenheiro Civil', 'Mestre de Obras', 'Pedreiro', 'Almoxarife', 'Auxiliar Administrativo', 'Técnico de Segurança', 'Encarregado'];
  const colaboradores: { id: number; nome: string; unidadeId: number }[] = [];
  for (let i = 0; i < nomes.length; i++) {
    const unidade = escolher(unidades);
    const status = i === 2 ? 'ferias' : i === 5 ? 'afastado' : 'ativo';
    const admissao = diasAtras(aleatorio(20, 900));
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO colaboradores
        (empresa_id, unidade_id, departamento_id, nome, cargo, cpf, email, telefone, data_admissao, status,
         horario_entrada_padrao, horario_saida_padrao, codigo_agente)
      VALUES
        (${empresaId}, ${unidade.id}, ${escolher(departamentos).id}, ${nomes[i]}, ${escolher(cargos)},
         ${String(10000000000 + i * 137).padStart(11, '0')}, ${`${nomes[i].toLowerCase().split(' ')[0]}@construtoranordeste.com.br`},
         ${`(81) 9${aleatorio(1000, 9999)}-${aleatorio(1000, 9999)}`}, ${admissao.toISOString().slice(0, 10)}, ${status},
         '07:30', '17:00', ${`AGT-${String(1000 + i)}`})
      RETURNING id
    `;
    colaboradores.push({ id: row.id, nome: nomes[i], unidadeId: unidade.id });
  }

  console.log('Criando usuário admin de login...');
  const senhaHash = await hashSenha('argus2026');
  await sql`
    INSERT INTO usuarios (empresa_id, username, senha_hash, nome, role, admin_geral)
    VALUES (${empresaId}, 'admin', ${senhaHash}, 'Administrador Argus', 'ADMIN', true)
  `;

  console.log('Criando dispositivos...');
  const dispositivos: { id: number; colaboradorId: number }[] = [];
  for (const colab of colaboradores.slice(0, 15)) {
    const unidade = unidades.find((u) => u.id === colab.unidadeId)!;
    const online = Math.random() > 0.3;
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO dispositivos (empresa_id, colaborador_id, unidade_id, tipo, nome, identificador, online, ultima_latitude, ultima_longitude, ultima_cidade, ultimo_ping_em)
      VALUES (${empresaId}, ${colab.id}, ${unidade.id}, ${escolher(['notebook', 'celular'])}, ${`Dispositivo de ${colab.nome.split(' ')[0]}`},
              ${`SN-${aleatorio(100000, 999999)}`}, ${online},
              ${unidade.latitude + (Math.random() - 0.5) * 0.05}, ${unidade.longitude + (Math.random() - 0.5) * 0.05},
              ${unidade.nome}, ${online ? new Date() : diasAtras(aleatorio(1, 5))})
      RETURNING id
    `;
    dispositivos.push({ id: row.id, colaboradorId: colab.id });
  }

  console.log('Gerando registros de ponto dos últimos 20 dias úteis...');
  const analiseOk = { rosto_ok: true, uniforme_ok: true, cracha_ok: true, calcado_ok: true, aprovado: true, confianca: 0.94, observacao: 'Todos os critérios conferem.' };
  const analiseDivergente = { rosto_ok: true, uniforme_ok: false, cracha_ok: true, calcado_ok: true, aprovado: false, confianca: 0.81, observacao: 'Divergência: uniforme não identificado.' };

  const statusPorColaborador = new Map<number, string>();
  for (const row of await sql<{ id: number; status: string }[]>`SELECT id, status FROM colaboradores WHERE empresa_id = ${empresaId}`) {
    statusPorColaborador.set(row.id, row.status);
  }

  for (let diaOffset = 0; diaOffset < 28; diaOffset++) {
    const data = diasAtras(diaOffset);
    const diaSemana = data.getDay();
    if (diaSemana === 0 || diaSemana === 6) continue; // pula fim de semana

    for (const colab of colaboradores) {
      if (statusPorColaborador.get(colab.id) !== 'ativo') continue;
      if (Math.random() < 0.04) continue; // falta ocasional

      const atrasado = Math.random() < 0.15;
      const minutosAtraso = atrasado ? aleatorio(11, 40) : aleatorio(-5, 5);
      const entrada1 = comHorario(data, 7, Math.max(0, 30 + minutosAtraso));
      const saida1 = comHorario(data, 12, aleatorio(0, 10));
      const entrada2 = comHorario(data, 13, aleatorio(0, 15));
      const saida2 = comHorario(data, 17, aleatorio(0, 20));

      const divergente = Math.random() < 0.08;
      const analise = divergente ? analiseDivergente : analiseOk;

      for (const [tipo, horario] of [
        ['ENTRADA_1', entrada1],
        ['SAIDA_1', saida1],
        ['ENTRADA_2', entrada2],
        ['SAIDA_2', saida2],
      ] as const) {
        const unidade = unidades.find((u) => u.id === colab.unidadeId)!;
        await sql`
          INSERT INTO registros_ponto (empresa_id, colaborador_id, tipo, registrado_em, latitude, longitude, endereco_aprox, analise_ia)
          VALUES (${empresaId}, ${colab.id}, ${tipo}, ${horario},
                  ${unidade.latitude + (Math.random() - 0.5) * 0.01}, ${unidade.longitude + (Math.random() - 0.5) * 0.01},
                  ${unidade.nome}, ${sql.json(analise)})
        `;
      }
    }
  }

  console.log('Criando ajustes de ponto pendentes e histórico...');
  for (let i = 0; i < 6; i++) {
    const colab = escolher(colaboradores.slice(0, 15));
    const dataAjuste = diasAtras(aleatorio(1, 10));
    await sql`
      INSERT INTO ajustes_ponto (empresa_id, colaborador_id, tipo_ajuste, tipo_marcacao, horario_ajustado, justificativa, status, criado_em)
      VALUES (${empresaId}, ${colab.id}, 'inclusao', 'ENTRADA_1', ${comHorario(dataAjuste, 7, 32)},
              'Esqueceu de bater o ponto na chegada — confirmado com o encarregado da obra.', 'pendente', ${dataAjuste})
    `;
  }
  for (let i = 0; i < 4; i++) {
    const colab = escolher(colaboradores.slice(0, 15));
    await sql`
      INSERT INTO ajustes_ponto (empresa_id, colaborador_id, tipo_ajuste, tipo_marcacao, horario_ajustado, justificativa, status, analisado_em, criado_em)
      VALUES (${empresaId}, ${colab.id}, 'correcao', 'SAIDA_2', ${comHorario(diasAtras(15), 17, 5)},
              'Celular sem sinal no momento da saída, horário confirmado pelo mestre de obras.', 'aprovado', now(), ${diasAtras(15)})
    `;
  }

  console.log('Criando pendências e histórico de assinatura de ponto...');
  const periodoAnteriorInicio = diasAtras(58).toISOString().slice(0, 10);
  const periodoAnteriorFim = diasAtras(29).toISOString().slice(0, 10);
  const periodoAtualInicio = diasAtras(28).toISOString().slice(0, 10);
  const periodoAtualFim = diasAtras(0).toISOString().slice(0, 10);
  for (const colab of colaboradores.slice(0, 15)) {
    await sql`
      INSERT INTO assinaturas_ponto (empresa_id, colaborador_id, periodo_inicio, periodo_fim, assinado_em)
      VALUES (${empresaId}, ${colab.id}, ${periodoAnteriorInicio}, ${periodoAnteriorFim}, ${diasAtras(27)})
    `;
    await sql`
      INSERT INTO assinaturas_ponto (empresa_id, colaborador_id, periodo_inicio, periodo_fim, assinado_em)
      VALUES (${empresaId}, ${colab.id}, ${periodoAtualInicio}, ${periodoAtualFim}, ${Math.random() > 0.4 ? null : diasAtras(1)})
    `;
  }

  console.log('Criando eventos de pessoas (férias/afastamento/home office)...');
  await sql`
    INSERT INTO eventos_pessoas (empresa_id, colaborador_id, tipo, data_inicio, data_fim, status, observacao)
    VALUES (${empresaId}, ${colaboradores[2].id}, 'ferias', ${diasAtras(5).toISOString().slice(0, 10)}, ${diasAtras(-25).toISOString().slice(0, 10)}, 'em_andamento', '30 dias de férias regulamentares.')
  `;
  await sql`
    INSERT INTO eventos_pessoas (empresa_id, colaborador_id, tipo, data_inicio, data_fim, status, observacao)
    VALUES (${empresaId}, ${colaboradores[5].id}, 'afastamento', ${diasAtras(10).toISOString().slice(0, 10)}, ${diasAtras(-5).toISOString().slice(0, 10)}, 'em_andamento', 'Afastamento médico (atestado).')
  `;
  await sql`
    INSERT INTO eventos_pessoas (empresa_id, colaborador_id, tipo, data_inicio, data_fim, status)
    VALUES (${empresaId}, ${colaboradores[8].id}, 'ferias', ${diasAtras(-3).toISOString().slice(0, 10)}, ${diasAtras(-33).toISOString().slice(0, 10)}, 'aprovado')
  `;
  await sql`
    INSERT INTO eventos_pessoas (empresa_id, colaborador_id, tipo, data_inicio, data_fim, status)
    VALUES (${empresaId}, ${colaboradores[11].id}, 'ferias', ${diasAtras(-8).toISOString().slice(0, 10)}, ${diasAtras(-38).toISOString().slice(0, 10)}, 'solicitado')
  `;
  await sql`
    INSERT INTO eventos_pessoas (empresa_id, colaborador_id, tipo, data_inicio, data_fim, status)
    VALUES (${empresaId}, ${colaboradores[14].id}, 'home_office', ${diasAtras(0).toISOString().slice(0, 10)}, ${diasAtras(-2).toISOString().slice(0, 10)}, 'solicitado')
  `;

  console.log('Gerando eventos de uso digital das últimas 6 semanas...');
  const sitesEApps = ['Excel', 'AutoCAD', 'E-mail corporativo', 'WhatsApp Web', 'Sistema ERP', 'Google Chrome', 'SAP', 'YouTube', 'Instagram'];
  for (const colab of colaboradores.slice(0, 15)) {
    const perfilAtivo = Math.random() > 0.2; // alguns colaboradores com atividade bem mais baixa (possíveis "ofensores")
    for (let diaOffset = 0; diaOffset < 42; diaOffset++) {
      const data = diasAtras(diaOffset);
      if (data.getDay() === 0 || data.getDay() === 6) continue;
      const eventosNoDia = perfilAtivo ? aleatorio(3, 8) : aleatorio(0, 2);
      for (let j = 0; j < eventosNoDia; j++) {
        await sql`
          INSERT INTO uso_digital_eventos (empresa_id, colaborador_id, aplicativo_ou_site, cliques, ocorrido_em)
          VALUES (${empresaId}, ${colab.id}, ${escolher(sitesEApps)}, ${aleatorio(15, 220)}, ${comHorario(data, aleatorio(7, 17), aleatorio(0, 59))})
        `;
      }
    }
  }

  console.log('\nSeed concluído com sucesso.');
  console.log('Login de exemplo -> usuário: admin | senha: argus2026');
  await sql.end();
}

main().catch((e) => {
  console.error('Falha no seed:', e);
  process.exit(1);
});
