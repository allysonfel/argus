import { TituloPagina, Secao, Tabela } from '@/components/shopping/Comum';
import { Planta, type Seta } from '@/components/shopping/Planta';
import { GraficoSankey } from '@/components/shopping/Graficos';
import { BotaoCSV } from '@/components/shopping/BotaoCSV';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, SelectField } from '@/components/ui/Field';
import { agoraDemo, entradasDia, formatarData, formatarNumero, hash, matrizOD, qualidadePortais, rotasAPartirDe, somarDias } from '@/lib/shopping/demo';
import { ANDARES, CAMERAS, ENTRADAS, areaPorId, centroArea, type Andar } from '@/lib/shopping/planta';
import { um, type Busca } from '@/lib/shopping/filtros';

const nome = (id: string) => areaPorId(id)?.nome ?? id;

function andarDaArea(id: string, outro?: string): Andar | undefined {
  // Escadas ligam os dois pisos: assumem o andar da outra ponta.
  if (id === 'escadas') return outro ? andarDaArea(outro) : undefined;
  return areaPorId(id)?.andar;
}

export default async function RotasPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const sp = await searchParams;
  const hoje = agoraDemo().data;
  const ontem = somarDias(hoje, -1);
  const dia = um(sp.dia) && um(sp.dia)! <= ontem ? um(sp.dia)! : ontem;
  const andar = (um(sp.andar) as Andar) || 'T';
  const entradaSel = ENTRADAS.find((e) => e.id === um(sp.entrada)) ?? ENTRADAS[0];

  const od = matrizOD(dia);
  const totalEntradas = entradasDia(dia);

  const setas: Seta[] = od
    .filter((f) => andarDaArea(f.de, f.para) === andar && andarDaArea(f.para, f.de) === andar)
    .map((f) => ({ de: centroArea(f.de), para: centroArea(f.para), valor: f.valor, rotulo: `${nome(f.de)} → ${nome(f.para)}` }));

  // Sankey em 3 níveis: entrada → 1ª área → 2ª área (nós distintos por nível, sem ciclos)
  const nos: { name: string }[] = [];
  const idx = new Map<string, number>();
  const no = (nivel: number, area: string) => {
    const k = `${nivel}|${area}`;
    if (!idx.has(k)) {
      idx.set(k, nos.length);
      nos.push({ name: nome(area) });
    }
    return idx.get(k)!;
  };
  const somaLig = new Map<string, number>();
  for (const e of ENTRADAS) {
    for (const r of rotasAPartirDe(e.id, 3, 12)) {
      const qtd = totalEntradas * e.peso * r.p;
      for (let i = 0; i < Math.min(2, r.caminho.length - 1); i++) {
        const k = `${no(i, r.caminho[i])}>${no(i + 1, r.caminho[i + 1])}`;
        somaLig.set(k, (somaLig.get(k) ?? 0) + qtd);
      }
    }
  }
  const ligacoes = [...somaLig].map(([k, v]) => {
    const [source, target] = k.split('>').map(Number);
    return { source, target, value: Math.round(v) };
  });

  const rotas = rotasAPartirDe(entradaSel.id, 4, 8);
  const pessoasEntrada = totalEntradas * entradaSel.peso;
  const qualidade = qualidadePortais(dia);

  // Relógio das câmeras (NTP): diferença em segundos em relação ao servidor
  const relogios = CAMERAS.map((c) => ({ c, dif: hash(c.id + 'ntp') > 0.94 ? Math.round(40 + 200 * hash(c.id)) : Math.round((hash(c.id + 'ms') - 0.5) * 1.6 * 10) / 10 }));
  const foraDeHora = relogios.filter((r) => Math.abs(r.dif) > 2);

  return (
    <div>
      <TituloPagina
        titulo="Rotas e fluxo"
        descricao="Como as pessoas se movem entre as áreas do shopping. Cada câmera registra por qual portal a pessoa entrou e saiu do campo de visão (sem guardar trajetórias individuais); o modelo de transições junta as câmeras vizinhas. Tudo aqui é estimativa estatística."
      />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <Field label="Dia" name="dia" type="date" defaultValue={dia} max={ontem} className="w-44" />
        <SelectField label="Andar" name="andar" defaultValue={andar} className="w-36">
          {ANDARES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </SelectField>
        <SelectField label="Rotas a partir de" name="entrada" defaultValue={entradaSel.id} className="w-56">
          {ENTRADAS.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </SelectField>
        <Button type="submit" variant="outline" size="sm" className="h-10">
          Aplicar
        </Button>
      </form>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao titulo={`Setas de fluxo · ${ANDARES.find((a) => a.id === andar)?.nome}`} descricao={`${formatarData(dia)} · espessura proporcional a pessoas/dia · passe o mouse numa seta`} className="xl:col-span-2">
          <Planta andar={andar} setas={setas} />
        </Secao>
        <Secao titulo={`Rotas a partir da ${entradaSel.nome}`} descricao={`${formatarNumero(pessoasEntrada)} entradas por ela em ${formatarData(dia)} · rotas mais prováveis`}>
          <ol className="flex flex-col gap-3">
            {rotas.map((r, i) => (
              <li key={i} className="text-sm">
                <div className="mb-1 flex justify-between gap-3">
                  <span className="text-on-surface">{r.caminho.slice(1).map(nome).join(' → ')}</span>
                  <span className="shrink-0 tabular-nums text-on-surface-variant">{(r.p * 100).toFixed(1).replace('.', ',')}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-container">
                  <div className="h-1.5 rounded-full bg-[var(--serie-1)]" style={{ width: `${Math.min(100, (r.p / rotas[0].p) * 100)}%` }} />
                </div>
                <p className="mt-0.5 text-xs text-on-surface-variant">≈ {formatarNumero(pessoasEntrada * r.p)} pessoas</p>
              </li>
            ))}
          </ol>
        </Secao>
      </div>

      <Secao titulo="Fluxo entre áreas (diagrama de Sankey)" descricao={`Da entrada até a 2ª área visitada · pessoas em ${formatarData(dia)} · estimativa`} className="mb-6">
        <GraficoSankey nos={nos} ligacoes={ligacoes} altura={460} />
      </Secao>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Secao
          titulo="Matriz origem → destino"
          descricao={`Pessoas/dia entre áreas vizinhas · ${formatarData(dia)}`}
          acao={<BotaoCSV nomeArquivo={`matriz-od-${dia}.csv`} cabecalho={['Origem', 'Destino', 'Pessoas/dia (estimativa)']} linhas={od.map((f) => [nome(f.de), nome(f.para), f.valor])} />}
        >
          <div className="max-h-96 overflow-y-auto">
            <Tabela cabecalho={['Origem', 'Destino', 'Pessoas/dia']} alinharDireita={[2]} linhas={od.slice(0, 30).map((f) => [nome(f.de), nome(f.para), formatarNumero(f.valor)])} />
          </div>
        </Secao>

        <div className="flex flex-col gap-6">
          <Secao titulo="Qualidade dos portais" descricao="Saídas por um portal x chegadas no portal vizinho. Divergência acima de 10% indica portal mal posicionado ou câmera com problema.">
            <Tabela
              cabecalho={['Passagem', 'Saídas', 'Chegadas', 'Divergência']}
              alinharDireita={[1, 2, 3]}
              linhas={qualidade.map((q) => [
                `${nome(q.de)} → ${nome(q.para)}`,
                formatarNumero(q.saidas),
                formatarNumero(q.chegadas),
                q.divergenciaPct > 10 ? <Badge variant="error">{q.divergenciaPct.toFixed(1).replace('.', ',')}%</Badge> : `${q.divergenciaPct.toFixed(1).replace('.', ',')}%`,
              ])}
            />
          </Secao>
          <Secao titulo="Relógio das câmeras (NTP)" descricao="As rotas dependem de horários sincronizados. Diferença tolerada: 2 s.">
            {foraDeHora.length ? (
              <Tabela cabecalho={['Câmera', 'Diferença']} alinharDireita={[1]} linhas={foraDeHora.map((r) => [`${r.c.id} · ${r.c.nome}`, <Badge key={r.c.id} variant="warning">{r.dif > 0 ? '+' : ''}{r.dif} s</Badge>])} />
            ) : (
              <p className="text-sm text-on-surface-variant">Todas as câmeras sincronizadas.</p>
            )}
            <p className="mt-3 text-xs text-on-surface-variant">{relogios.length - foraDeHora.length} de {relogios.length} câmeras dentro da tolerância.</p>
          </Secao>
        </div>
      </div>

      <Secao titulo="Como as rotas são calculadas">
        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-on-surface-variant">
          <li>Nível 1: cada câmera tem portais (linhas nas bordas e passagens) ligados aos portais das câmeras vizinhas. Para cada pessoa, o sistema anota só o portal de entrada e o de saída do campo de visão e soma em uma matriz por câmera.</li>
          <li>Nível 2: as matrizes são combinadas pelo grafo de vizinhança (modelo de transições) para estimar o fluxo entre áreas e as rotas mais prováveis a partir de cada entrada.</li>
          <li>Não há rastreio individual entre câmeras (reidentificação). A arquitetura está preparada para isso numa fase futura.</li>
        </ul>
      </Secao>
    </div>
  );
}
