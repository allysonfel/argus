import Link from 'next/link';
import { TituloPagina, Secao, Tabela } from '@/components/shopping/Comum';
import { Planta, LegendaDivergente } from '@/components/shopping/Planta';
import { RegistrarAcao } from '@/components/shopping/RegistrarAcao';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Field';
import { ACOES_DEMO, agoraDemo, antesDepois, formatarData, formatarNumero, zonasMortas } from '@/lib/shopping/demo';
import { ANDARES, zonaPorId, type Andar } from '@/lib/shopping/planta';
import { um, type Busca } from '@/lib/shopping/filtros';

const pct = (v: number) => `${Math.round(v * 100)}%`;

export default async function ZonasMortasPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const sp = await searchParams;
  const andar = (um(sp.andar) as Andar) || 'P1';
  const limite = Number(um(sp.limite)) || 40;
  const semanas = Number(um(sp.semanas)) || 2;
  const hoje = agoraDemo().data;

  const todas = zonasMortas(hoje, semanas, limite / 100);
  const doAndar = todas.filter((z) => z.zona.andar === andar);
  const mortas = todas.filter((z) => z.morta);
  // Praça de alimentação fica fora do índice (perfil de uso diferente): aparece neutra.
  const valores: Record<string, number> = { 'P1-ALIM': 1, 'P1-N0': 1 };
  for (const z of doAndar) valores[z.zona.id] = z.indice;

  return (
    <div>
      <TituloPagina
        titulo="Zonas mortas"
        descricao={`Áreas de corredor com movimento abaixo de ${limite}% da média do andar por ${semanas} semana(s) seguidas ou mais. O índice compara densidade de passagens (pessoas por área), no mesmo período e horário.`}
      />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <SelectField label="Andar" name="andar" defaultValue={andar} className="w-36">
          {ANDARES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </SelectField>
        <SelectField label="Limite" name="limite" defaultValue={limite} className="w-44">
          {[30, 40, 50, 60].map((v) => (
            <option key={v} value={v}>
              Abaixo de {v}% da média
            </option>
          ))}
        </SelectField>
        <SelectField label="Período mínimo" name="semanas" defaultValue={semanas} className="w-40">
          {[1, 2, 3, 4].map((v) => (
            <option key={v} value={v}>
              {v} semana{v > 1 ? 's' : ''}
            </option>
          ))}
        </SelectField>
        <Button type="submit" variant="outline" size="sm" className="h-10">
          Aplicar
        </Button>
      </form>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao
          titulo={`${ANDARES.find((a) => a.id === andar)?.nome} · índice da última semana`}
          descricao="Vermelho = abaixo da média do andar · contorno vermelho = zona morta"
          className="xl:col-span-2"
        >
          <Planta andar={andar} valores={valores} modo="divergente" formatarValor="indice" destaque={mortas.map((m) => m.zona.id)} linkZona="/shopping/corredores?zona=" />
          <div className="mt-4">
            <LegendaDivergente />
          </div>
        </Secao>

        <Secao titulo="Resumo" descricao={`Até ${formatarData(hoje)}`}>
          <p className="text-4xl font-semibold tabular-nums text-on-surface">{mortas.length}</p>
          <p className="mb-4 text-sm text-on-surface-variant">zona(s) morta(s) no shopping com esse critério</p>
          <ul className="flex flex-col gap-2 text-sm">
            {mortas.slice(0, 6).map((m) => (
              <li key={m.zona.id} className="flex items-start justify-between gap-3">
                <Link href={`/shopping/zonas-mortas?andar=${m.zona.andar}&limite=${limite}&semanas=${semanas}`} className="text-on-surface hover:underline">
                  {m.zona.nome}
                </Link>
                <span className="shrink-0 tabular-nums text-error">{pct(m.indice)}</span>
              </li>
            ))}
            {mortas.length === 0 && <li className="text-on-surface-variant">Nenhuma área atende ao critério.</li>}
          </ul>
        </Secao>
      </div>

      <Secao titulo="Áreas do andar, da mais vazia para a mais movimentada" descricao="Índice = densidade da área / média do andar (100% = na média)" className="mb-6">
        <Tabela
          cabecalho={['Área', 'Índice (última semana)', 'Semanas abaixo do limite', 'Passagens/dia', 'Média do andar', 'Horários mais vazios', 'Situação']}
          alinharDireita={[1, 2, 3, 4]}
          linhas={doAndar.map((z) => [
            <Link key={z.zona.id} href={`/shopping/corredores?zona=${z.zona.id}`} className="text-primary hover:underline">
              {z.zona.nome}
            </Link>,
            pct(z.indice),
            z.semanasAbaixo,
            formatarNumero(z.media),
            formatarNumero(z.mediaAndar),
            z.horasMaisVazias.map((h) => `${h}h`).join(', '),
            z.morta ? <Badge variant="error">Zona morta</Badge> : z.indice < limite / 100 ? <Badge variant="warning">Em observação</Badge> : <Badge>Normal</Badge>,
          ])}
        />
      </Secao>

      <Secao titulo="Ações registradas e efeito antes/depois" descricao="Compara as mesmas semanas antes e depois da ação, alinhadas por dia da semana. O índice desconta a variação do andar inteiro (sazonalidade, datas comerciais).">
        <Tabela
          cabecalho={['Data', 'Área', 'Ação', 'Registrado por', 'Antes (pass./dia)', 'Depois (pass./dia)', 'Índice antes → depois']}
          alinharDireita={[4, 5]}
          linhas={ACOES_DEMO.map((a) => {
            const r = antesDepois(a);
            return [
              formatarData(a.data),
              zonaPorId(a.zonaId)?.nome ?? a.zonaId,
              a.descricao,
              a.autor,
              formatarNumero(r.antes),
              formatarNumero(r.depois),
              <span key={a.id} className={r.indiceDepois >= r.indiceAntes ? 'text-[var(--color-success)]' : 'text-error'}>
                {pct(r.indiceAntes)} → {pct(r.indiceDepois)} ({r.diasDepois} dias depois)
              </span>,
            ];
          })}
        />
        <RegistrarAcao zonas={doAndar.map((z) => ({ id: z.zona.id, nome: z.zona.nome }))} />
      </Secao>
    </div>
  );
}
