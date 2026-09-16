import Link from 'next/link';
import { exigirSessao } from '@/lib/sessaoServidor';
import { listarDispositivos, listarColaboradores } from '@/lib/cadastros';
import { CadastrosTabs } from '@/components/admin/CadastrosTabs';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatarDataHoraBR } from '@/lib/datas';

export default async function DispositivosPage() {
  const sessao = await exigirSessao();
  const [dispositivos, colaboradores] = await Promise.all([listarDispositivos(sessao.empresaId), listarColaboradores(sessao.empresaId)]);
  const nomeColaborador = new Map(colaboradores.map((c) => [c.id, c.nome]));

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-on-surface">Cadastros</h1>
      <p className="mb-4 text-sm text-on-surface-variant">Estrutura da empresa: unidades, departamentos, colaboradores e dispositivos.</p>
      <CadastrosTabs />

      <div className="mb-4 flex justify-end">
        <Link href="/cadastros/dispositivos/novo">
          <Button>+ Novo dispositivo</Button>
        </Link>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-left text-xs uppercase tracking-wide text-on-surface-variant">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Colaborador</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Último ping</th>
              </tr>
            </thead>
            <tbody>
              {dispositivos.map((d) => (
                <tr key={d.id} className="border-b border-outline-variant/50 last:border-0">
                  <td className="px-4 py-3 font-medium text-on-surface">{d.nome}</td>
                  <td className="px-4 py-3 text-on-surface-variant capitalize">{d.tipo}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{d.colaborador_id ? nomeColaborador.get(d.colaborador_id) : '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={d.online ? 'success' : 'neutral'}>{d.online ? 'Online' : 'Offline'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{d.ultimo_ping_em ? formatarDataHoraBR(d.ultimo_ping_em) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
