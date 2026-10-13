'use client';

import { useEffect, useState } from 'react';
import { Secao, Tabela } from '@/components/shopping/Comum';
import { partesDoNome } from '@/components/shopping/cameras/tipos';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';

type Cam = { id: string; nome: string; online: boolean; erro: string | null; fps_fonte: number; fps_analise: number; fps_analise_alvo: number; inferencia_ms: number; sem_quadros_ha_s: number | null; resolucao: [number, number]; stats: { pessoas_detectadas?: number; ocupacao_atual: number } };

// Câmeras e saúde REAL: o estado de cada câmera direto do motor de visão.
export function SaudeCamerasReal({ urlMotor }: { urlMotor: string }) {
  const [cams, setCams] = useState<Cam[] | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let ativo = true;
    const ler = () =>
      fetch(`${urlMotor}/api/cameras`)
        .then((r) => r.json())
        .then((c: Cam[]) => {
          if (!ativo) return;
          setCams(c);
          setErro(false);
        })
        .catch(() => ativo && setErro(true));
    ler();
    const t = setInterval(ler, 3000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [urlMotor]);

  if (!cams) return <p className="text-sm text-on-surface-variant">{erro ? `Não foi possível falar com o motor de visão (${urlMotor}).` : 'Lendo o motor de visão…'}</p>;
  const online = cams.filter((c) => c.online);
  const abertas = cams.filter((c) => c.fps_analise_alvo >= 1);
  const inferencia = online.reduce((s, c) => s + c.inferencia_ms, 0) / Math.max(1, online.length);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Online" value={`${online.length}/${cams.length}`} hint="Câmeras recebendo imagem" tone="primary" />
        <StatCard label="Com problema" value={cams.length - online.length} hint="Sem imagem ou com erro" tone={cams.length - online.length ? 'error' : 'neutral'} />
        <StatCard label="Sendo assistidas agora" value={abertas.length} hint="Analisadas no ritmo cheio (3 por segundo)" />
        <StatCard label="Tempo de análise (média)" value={`${Math.round(inferencia)} ms`} hint="Por imagem, no servidor (CPU)" />
      </div>
      <Secao titulo="Cada câmera" descricao={`Lido do motor de visão a cada 3 s${erro ? ' · última leitura falhou' : ''}. As câmeras que ninguém está assistindo analisam 1 imagem a cada 10 s para poupar o servidor.`}>
        <Tabela
          cabecalho={['Câmera', 'Situação', 'Imagem', 'Análises/s', 'Tempo de análise', 'Pessoas agora']}
          alinharDireita={[3, 4, 5]}
          linhas={cams.map((c) => [
            <span key="n" className="text-sm">
              {partesDoNome(c.nome).codigo} {partesDoNome(c.nome).titulo}
            </span>,
            c.online ? <Badge key="s" variant="success">Online</Badge> : <Badge key="s" variant="error">{c.erro ? 'Erro' : 'Offline'}</Badge>,
            <span key="i" className="text-xs text-on-surface-variant">
              {c.resolucao[0]}×{c.resolucao[1]} · {c.fps_fonte} fps
            </span>,
            `${c.fps_analise.toFixed(1).replace('.', ',')} / ${c.fps_analise_alvo}`,
            `${c.inferencia_ms} ms`,
            c.stats.pessoas_detectadas ?? c.stats.ocupacao_atual,
          ])}
        />
      </Secao>
    </div>
  );
}
