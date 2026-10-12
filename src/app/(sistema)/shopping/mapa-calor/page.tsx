import { TituloPagina, Secao, Tabela } from '@/components/shopping/Comum';
import { Planta, LegendaSequencial } from '@/components/shopping/Planta';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Field';
import { calorPorZona, formatarData, DIAS_SEMANA_CURTO, HORAS, HORA_FECHA } from '@/lib/shopping/demo';
import { ANDARES, ZONAS, type Andar } from '@/lib/shopping/planta';
import { periodoDaBusca, um, varios, type Busca } from '@/lib/shopping/filtros';

export default async function MapaCalorPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const sp = await searchParams;
  const andar = (um(sp.andar) as Andar) || 'T';
  const periodo = periodoDaBusca(sp);
  const dias = varios(sp.dias).map(Number);
  const horaIni = Number(um(sp.horaIni)) || HORAS[0];
  const horaFim = Number(um(sp.horaFim)) || HORA_FECHA;

  const calor = calorPorZona(periodo.inicio, periodo.fim, { diasSemana: dias, horaIni, horaFim });
  const zonasAndar = ZONAS.filter((z) => z.andar === andar);
  const ordenadas = [...zonasAndar].sort((a, b) => calor[b.id] - calor[a.id]);
  const valores = zonasAndar.map((z) => calor[z.id]);

  return (
    <div>
      <TituloPagina
        titulo="Mapa de calor"
        descricao="Onde as pessoas circulam, sobre a planta de cada andar. Só áreas de corredor são monitoradas; as lojas aparecem apenas como referência."
      />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <SelectField label="Andar" name="andar" defaultValue={andar} className="w-36">
          {ANDARES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </SelectField>
        <SelectField label="Período" name="periodo" defaultValue={periodo.rotulo === 'personalizado' ? '30' : periodo.rotulo} className="w-40">
          <option value="1">Hoje</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </SelectField>
        <SelectField label="Das" name="horaIni" defaultValue={horaIni} className="w-24">
          {HORAS.map((h) => (
            <option key={h} value={h}>
              {h}h
            </option>
          ))}
        </SelectField>
        <SelectField label="Até" name="horaFim" defaultValue={horaFim} className="w-24">
          {[...HORAS.slice(1), HORA_FECHA].map((h) => (
            <option key={h} value={h}>
              {h}h
            </option>
          ))}
        </SelectField>
        <fieldset>
          <legend className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Dias da semana</legend>
          <div className="flex h-10 items-center gap-1">
            {DIAS_SEMANA_CURTO.map((d, i) => (
              <label key={d} className="flex cursor-pointer items-center gap-1 rounded-sm border border-outline-variant px-2 py-1.5 text-xs text-on-surface has-[:checked]:border-primary has-[:checked]:bg-primary-container">
                <input type="checkbox" name="dias" value={i} defaultChecked={dias.includes(i)} className="sr-only" />
                {d}
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit" variant="outline" size="sm" className="h-10">
          Aplicar
        </Button>
      </form>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao
          titulo={`${ANDARES.find((a) => a.id === andar)?.nome} · ${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}`}
          descricao={`${dias.length ? dias.map((d) => DIAS_SEMANA_CURTO[d]).join(', ') : 'Todos os dias'} · ${horaIni}h às ${horaFim}h · densidade média de passagens por dia`}
          className="xl:col-span-2"
        >
          <Planta andar={andar} valores={calor} mostrarCameras />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <LegendaSequencial titulo="Movimento:" rotuloMin={`${Math.min(...valores).toFixed(0)} (menos)`} rotuloMax={`${Math.max(...valores).toFixed(0)} (mais)`} />
            <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-on-surface" /> câmera de corredor
            </span>
          </div>
        </Secao>

        <div className="flex flex-col gap-6">
          <Secao titulo="Áreas mais movimentadas" descricao="Densidade no filtro escolhido">
            <Tabela
              cabecalho={['Área', 'Índice']}
              alinharDireita={[1]}
              linhas={ordenadas.slice(0, 6).map((z) => [<span key={z.id} className="text-xs">{z.nome}</span>, calor[z.id].toFixed(0)])}
            />
          </Secao>
          <Secao titulo="Áreas menos movimentadas">
            <Tabela
              cabecalho={['Área', 'Índice']}
              alinharDireita={[1]}
              linhas={ordenadas
                .slice(-5)
                .reverse()
                .map((z) => [<span key={z.id} className="text-xs">{z.nome}</span>, calor[z.id].toFixed(0)])}
            />
          </Secao>
          <Secao titulo="Como o mapa é montado">
            <p className="text-xs leading-relaxed text-on-surface-variant">
              Cada câmera é calibrada com 4 pontos no chão da imagem e os 4 pontos correspondentes na planta (homografia). As posições das pessoas são projetadas na planta e somadas por área. Pendente: receber a planta baixa real do shopping e calibrar
              cada câmera.
            </p>
          </Secao>
        </div>
      </div>
    </div>
  );
}
