'use client';

import { useEffect, useMemo, useState } from 'react';
import { Secao, Tabela } from '@/components/shopping/Comum';
import { GraficoBarras } from '@/components/shopping/Graficos';
import { ErroCaso } from '@/components/shopping/casos/useCaso';
import { partesDoNome } from '@/components/shopping/cameras/tipos';
import { MapaCameras } from '@/components/shopping/real/MapaCameras';
import { useCamerasReais } from '@/components/shopping/real/MosaicoReal';
import { StatCard } from '@/components/ui/StatCard';
import { formatarNumero } from '@/lib/shopping/demo';
import { carregarCamerasReais, movimento, passagensLinha } from '@/lib/shopping/real';

// Visão geral REAL: tudo sai do que o motor viu nos vídeos das 15 câmeras
// de demonstração (casos) e do que ele está vendo agora (/api/cameras).

export function VisaoGeralReal({ urlMotor }: { urlMotor: string }) {
  const { cameras, erro } = useCamerasReais(urlMotor, carregarCamerasReais);
  const [agora, setAgora] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    const ler = () =>
      fetch(`${urlMotor}/api/cameras`)
        .then((r) => r.json())
        .then((cs: { online: boolean; stats: { pessoas_detectadas?: number; ocupacao_atual: number } }[]) => {
          if (ativo) setAgora(cs.filter((c) => c.online).reduce((s, c) => s + (c.stats.pessoas_detectadas ?? c.stats.ocupacao_atual), 0));
        })
        .catch(() => {});
    ler();
    const t = setInterval(ler, 5000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [urlMotor]);

  const dados = useMemo(() => {
    if (!cameras) return null;
    const linhas = cameras.map((c) => {
      const passagens = c.linhas.reduce((s, l) => {
        const p = passagensLinha(c.caso, l);
        return s + p.entradas + p.saidas;
      }, 0);
      return { c, pessoas: c.caso.pessoas.length, mov: movimento(c.caso), passagens, criancas: c.caso.pessoas.filter((p) => p.altura_cm != null && p.altura_cm <= 135).length };
    });
    return {
      linhas: linhas.sort((a, b) => b.mov - a.mov),
      pessoas: linhas.reduce((s, l) => s + l.pessoas, 0),
      passagens: linhas.reduce((s, l) => s + l.passagens, 0),
      segundos: cameras.reduce((s, c) => s + c.caso.duracao_s, 0),
    };
  }, [cameras]);

  if (erro) return <ErroCaso erro={erro} urlMotor={urlMotor} />;
  if (!cameras || !dados) return <p className="text-sm text-on-surface-variant">Carregando as câmeras…</p>;
  const top = dados.linhas[0];
  const nome = (c: (typeof dados.linhas)[number]['c']) => `${partesDoNome(c.caso.nome).codigo ?? ''} ${partesDoNome(c.caso.nome).titulo}`.trim();

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-on-surface-variant">
        {cameras.length} câmeras de demonstração · {Math.round(dados.segundos / 60)} min de vídeo no total. Os filtros de data ficam na simulação: os vídeos são uma gravação só.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pessoas nas câmeras agora" value={agora === null ? '…' : formatarNumero(agora)} hint="Detectadas pelo motor neste momento" tone="primary" />
        <StatCard label="Pessoas registradas nos vídeos" value={formatarNumero(dados.pessoas)} hint={`em ${cameras.length} câmeras`} />
        <StatCard label="Passagens nas linhas de contagem" value={formatarNumero(dados.passagens)} hint="Entradas + saídas nas linhas amarelas" />
        <StatCard label="Câmera mais movimentada" value={top ? partesDoNome(top.c.caso.nome).titulo : '—'} hint={top ? `${Math.round(top.mov)} pessoas × s por minuto` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao titulo="Mapa das câmeras" descricao="Calor do vídeo inteiro em cada câmera e as pessoas andando agora" className="xl:col-span-2">
          <MapaCameras urlMotor={urlMotor} cameras={cameras} modo="calor" />
        </Secao>
        <Secao titulo="Pessoas por câmera" descricao="Pessoas diferentes que o motor rastreou em cada vídeo">
          <GraficoBarras dados={dados.linhas.map((l) => ({ nome: partesDoNome(l.c.caso.nome).codigo ?? l.c.caso.camera, valor: l.pessoas }))} x="nome" series={[{ chave: 'valor', nome: 'Pessoas' }]} horizontal altura={Math.max(260, dados.linhas.length * 26)} />
        </Secao>
      </div>

      <Secao titulo="Câmeras, da mais para a menos movimentada" descricao="Medido nos vídeos">
        <Tabela
          cabecalho={['Câmera', 'Pessoas', 'Crianças', 'Passagens nas linhas', 'Movimento']}
          alinharDireita={[1, 2, 3, 4]}
          linhas={dados.linhas.map((l) => [nome(l.c), l.pessoas, l.criancas, l.c.linhas.length ? l.passagens : '–', Math.round(l.mov)])}
        />
      </Secao>
    </div>
  );
}
