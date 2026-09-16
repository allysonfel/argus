import { exigirSessao } from '@/lib/sessaoServidor';
import { listarDispositivos, contarDispositivos } from '@/lib/cadastros';
import { sql } from '@/lib/db';
import { StatCard } from '@/components/ui/StatCard';
import { DispositivosMapaClient } from './DispositivosMapaClient';
import type { PontoDispositivo } from '@/components/mapas/MapaDispositivos';

export default async function MapaDispositivosPage() {
  const sessao = await exigirSessao();
  const [dispositivos, contagem] = await Promise.all([listarDispositivos(sessao.empresaId), contarDispositivos(sessao.empresaId)]);

  const colaboradorIds = dispositivos.map((d) => d.colaborador_id).filter((id): id is number => id !== null);
  const nomes =
    colaboradorIds.length > 0
      ? await sql<{ id: number; nome: string }[]>`SELECT id, nome FROM colaboradores WHERE id = ANY(${colaboradorIds})`
      : [];
  const nomePorId = new Map(nomes.map((n) => [n.id, n.nome]));

  const pontos: PontoDispositivo[] = dispositivos
    .filter((d) => d.ultima_latitude !== null && d.ultima_longitude !== null)
    .map((d) => ({
      id: d.id,
      nome: d.nome,
      colaboradorNome: d.colaborador_id ? nomePorId.get(d.colaborador_id) ?? null : null,
      cidade: d.ultima_cidade,
      online: d.online,
      latitude: d.ultima_latitude!,
      longitude: d.ultima_longitude!,
      ultimoPing: d.ultimo_ping_em,
    }));

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-on-surface">Mapa de Dispositivos</h1>
      <p className="mb-4 text-sm text-on-surface-variant">Notebooks e celulares da empresa, em tempo real.</p>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="Total" value={contagem.total} />
        <StatCard label="Online" value={contagem.online} tone="primary" />
        <StatCard label="Offline" value={contagem.total - contagem.online} />
      </div>

      <DispositivosMapaClient pontos={pontos} />
    </div>
  );
}
