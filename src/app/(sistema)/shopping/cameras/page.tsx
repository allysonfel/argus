import { exigirAba } from '@/lib/sessaoServidor';
import Link from 'next/link';
import { TituloPagina, Secao, Tabela } from '@/components/shopping/Comum';
import { CadastroCamera } from '@/components/shopping/CadastroCamera';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { ROTULO_ESTADO, saudeCameras, type EstadoCamera } from '@/lib/shopping/seguranca';

const VARIANTE: Record<EstadoCamera, 'success' | 'error' | 'warning'> = { online: 'success', offline: 'error', 'sem-frames': 'error', escura: 'error', desfocada: 'warning', desviada: 'warning' };

function tempo(s: number) {
  if (s < 60) return `há ${s.toFixed(1).replace('.', ',')} s`;
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  return `há ${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
}

export default async function CamerasPage() {
  await exigirAba('cameras');
  const cams = saudeCameras();
  const online = cams.filter((c) => c.estado === 'online');
  const problemas = cams.filter((c) => c.estado !== 'online');
  const fpsMedio = online.reduce((s, c) => s + c.fps, 0) / Math.max(1, online.length);
  // Problemas primeiro
  const ordenadas = [...problemas, ...online];

  return (
    <div>
      <TituloPagina
        titulo="Câmeras e saúde do sistema"
        descricao={`Situação de cada câmera de corredor usada pelo Argus. ${cams.length} câmeras cadastradas; o shopping tem cerca de 250, ligadas aos NVRs Intelbras e acessadas só pela VPN (o RTSP nunca fica exposto na internet).`}
      >
        <Link href="/shopping/ao-vivo" className="inline-flex h-8 items-center rounded-sm border border-outline-variant bg-surface px-3 text-xs font-medium text-on-surface hover:bg-surface-container-low">
          Ver câmeras ao vivo
        </Link>
      </TituloPagina>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Online" value={`${online.length}/${cams.length}`} hint="Recebendo quadros normalmente" tone="primary" />
        <StatCard label="Com problema" value={problemas.length} hint="Offline, sem quadros ou imagem ruim" tone={problemas.length ? 'error' : 'neutral'} />
        <StatCard label="FPS de análise (média)" value={fpsMedio.toFixed(1).replace('.', ',')} hint="Configurado: 4 fps por câmera" />
        <StatCard label="Servidor de visão" value="GPU" hint="1 servidor · carga estimada 31%" />
      </div>

      <Secao titulo="Câmeras" descricao="Atualizado a cada 30 s · problemas aparecem primeiro" className="mb-6">
        <Tabela
          cabecalho={['Câmera', 'Andar', 'Situação', 'FPS efetivo', 'Último quadro', 'Fonte']}
          alinharDireita={[3]}
          linhas={ordenadas.map((c) => [
            <span key={c.id}>
              <span className="font-medium">{c.id}</span>
              <span className="block text-xs text-on-surface-variant">{c.nome}</span>
            </span>,
            c.andar === 'T' ? 'Térreo' : 'Piso 1',
            <Badge key={`b${c.id}`} variant={VARIANTE[c.estado]}>
              {ROTULO_ESTADO[c.estado]}
            </Badge>,
            c.fps ? c.fps.toFixed(1).replace('.', ',') : '—',
            tempo(c.ultimoFrameS),
            <code key={`f${c.id}`} className="text-[11px] text-on-surface-variant">
              {c.fonte}
            </code>,
          ])}
        />
      </Secao>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao titulo="Cadastrar câmera" className="xl:col-span-2">
          <CadastroCamera />
        </Secao>
        <Secao titulo="O que o sistema verifica">
          <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-on-surface-variant">
            <li>Offline: sem conexão com o NVR. Reconexão automática a cada 5 s.</li>
            <li>Sem quadros: conectada, mas sem imagem nova há mais de 2 min.</li>
            <li>Escura ou tapada: brilho muito baixo ou imagem uniforme.</li>
            <li>Desfocada: nitidez abaixo do normal daquela câmera.</li>
            <li>Desviada: a imagem não bate mais com a de referência (a calibração com a planta deixa de valer).</li>
          </ul>
        </Secao>
      </div>
    </div>
  );
}
