import { exigirSessao } from '@/lib/sessaoServidor';
import { listarRegistrosIntervalo, contarRegistrosIntervalo, rotuloMarcacao } from '@/lib/ponto';
import { diasAtrasISO, hojeISO } from '@/lib/datas';
import { StatCard } from '@/components/ui/StatCard';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { PontoMapaClient } from './PontoMapaClient';
import type { PontoMarcacao } from '@/components/mapas/MapaPonto';

export default async function MapaPontoPage({ searchParams }: { searchParams: Promise<{ inicio?: string; fim?: string; busca?: string }> }) {
  const sessao = await exigirSessao();
  const sp = await searchParams;
  const inicio = sp.inicio || diasAtrasISO(7);
  const fim = sp.fim || hojeISO();
  const busca = sp.busca || '';

  const [registros, total] = await Promise.all([
    listarRegistrosIntervalo(sessao.empresaId, inicio, fim, busca),
    contarRegistrosIntervalo(sessao.empresaId, inicio, fim),
  ]);

  const pontos: PontoMarcacao[] = registros.map((r) => ({
    id: r.id,
    colaboradorNome: r.colaborador_nome,
    tipo: rotuloMarcacao(r.tipo),
    registradoEm: r.registrado_em,
    latitude: r.latitude!,
    longitude: r.longitude!,
  }));

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-on-surface">Mapa do Ponto</h1>
      <p className="mb-4 text-sm text-on-surface-variant">Onde cada check-in aconteceu, geograficamente.</p>

      <div className="mb-4">
        <StatCard label="Marcações no período" value={total} className="max-w-xs" />
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="De" type="date" name="inicio" defaultValue={inicio} className="w-40" />
        <Field label="Até" type="date" name="fim" defaultValue={fim} className="w-40" />
        <Field label="Buscar colaborador" name="busca" defaultValue={busca} className="w-56" />
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
      </form>

      <PontoMapaClient pontos={pontos} />
    </div>
  );
}
