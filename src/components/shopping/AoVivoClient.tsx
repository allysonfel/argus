'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { CameraFoco } from './cameras/CameraFoco';
import { MosaicoCameras, filtrarCameras, type FiltrosMosaico, type Layout } from './cameras/MosaicoCameras';
import { partesDoNome, pessoasNaImagem, type CameraMotor } from './cameras/tipos';

// Central de câmeras: mosaico com todas as câmeras (miniaturas ao vivo por
// um WebSocket só) e, ao clicar, a câmera em foco com a análise desenhada.
// A câmera aberta fica na URL (?camera=id): o "voltar" do navegador volta
// ao mosaico e dá pra compartilhar o link de uma câmera.

const CHAVE_LAYOUT = 'argus.cameras.layout';

function lerLayoutSalvo(): Layout {
  try {
    const v = Number(localStorage.getItem(CHAVE_LAYOUT));
    return v === 2 || v === 3 || v === 4 ? v : 3;
  } catch {
    return 3;
  }
}

export function AoVivoClient({ urlMotor }: { urlMotor: string }) {
  const [cameras, setCameras] = useState<CameraMotor[] | null>(null);
  const [erroMotor, setErroMotor] = useState(false);
  const [filtros, setFiltrosEstado] = useState<FiltrosMosaico>({ busca: '', andar: 'todos', ordem: 'numero', layout: 3, pagina: 0 });
  const searchParams = useSearchParams();
  const cameraAberta = searchParams.get('camera');
  // Se o foco foi aberto daqui (pushState), "voltar" usa o histórico.
  const abriuPeloMosaico = useRef(false);

  useEffect(() => {
    setFiltrosEstado((f) => ({ ...f, layout: lerLayoutSalvo() }));
  }, []);

  const setFiltros = useCallback((mudanca: Partial<FiltrosMosaico>) => {
    setFiltrosEstado((f) => ({ ...f, ...mudanca, pagina: Math.max(0, mudanca.pagina ?? f.pagina) }));
    if (mudanca.layout) {
      try {
        localStorage.setItem(CHAVE_LAYOUT, String(mudanca.layout));
      } catch {}
    }
  }, []);

  // Lista de câmeras + status (a cada 2 s)
  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const res = await fetch(`${urlMotor}/api/cameras`);
        const lista: CameraMotor[] = await res.json();
        if (!ativo) return;
        setCameras(lista);
        setErroMotor(false);
      } catch {
        if (ativo) setErroMotor(true);
      }
    }
    carregar();
    const t = setInterval(carregar, 2000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [urlMotor]);

  const abrir = useCallback((id: string) => {
    abriuPeloMosaico.current = true;
    window.history.pushState(null, '', `?camera=${encodeURIComponent(id)}`);
  }, []);

  const trocar = useCallback((id: string) => {
    window.history.replaceState(null, '', `?camera=${encodeURIComponent(id)}`);
  }, []);

  const voltar = useCallback(() => {
    if (abriuPeloMosaico.current) {
      abriuPeloMosaico.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  if (erroMotor && !cameras) {
    return (
      <Card>
        <p className="text-sm text-on-surface">
          Não foi possível falar com o motor de visão em <code>{urlMotor}</code>.
        </p>
        <p className="mt-2 text-sm text-on-surface-variant">
          Rode em <code>visao-ia/</code>: <code>uv run uvicorn argus_visao.api:app --port 8500</code>. Se o motor já está no ar, confira se a
          origem deste painel está em <code>ARGUS_PAINEL_ORIGENS</code> (CORS).
        </p>
      </Card>
    );
  }

  if (!cameras) {
    return <div className="flex min-h-64 items-center justify-center text-sm text-on-surface-variant">Carregando câmeras...</div>;
  }

  const online = cameras.filter((c) => c.online);
  const totalPessoas = online.reduce((soma, c) => soma + pessoasNaImagem(c), 0);
  const totalPassagens = online.reduce((soma, c) => soma + c.stats.linhas.reduce((x, l) => x + l.entradas + l.saidas, 0), 0);
  const maisMovimentada = online.reduce<CameraMotor | null>((m, c) => (!m || pessoasNaImagem(c) > pessoasNaImagem(m) ? c : m), null);

  const emFoco = cameraAberta ? cameras.find((c) => c.id === cameraAberta) : undefined;
  const listaFoco = emFoco ? (filtrarCameras(cameras, filtros).some((c) => c.id === emFoco.id) ? filtrarCameras(cameras, filtros) : cameras) : [];

  return (
    <div className="flex flex-col gap-5">

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pessoas nas câmeras agora" value={totalPessoas} hint="Soma das imagens de todas as câmeras" tone="primary" />
        <StatCard label="Passagens contadas" value={totalPassagens} hint="Linhas amarelas, desde que o motor ligou. Só conta nas câmeras abertas por alguém: as outras analisam 1 imagem a cada 10 s, pouco pra seguir quem cruza" />
        <StatCard
          label="Mais movimentada agora"
          value={maisMovimentada ? pessoasNaImagem(maisMovimentada) : '-'}
          hint={maisMovimentada ? partesDoNome(maisMovimentada.nome).titulo : undefined}
        />
        <StatCard label="Câmeras online" value={`${online.length}/${cameras.length}`} hint="Análise local, sem enviar imagem para fora" />
      </div>

      {emFoco ? (
        <CameraFoco camera={emFoco} cameras={listaFoco} urlMotor={urlMotor} onVoltar={voltar} onTrocar={trocar} />
      ) : (
        <MosaicoCameras cameras={cameras} urlMotor={urlMotor} filtros={filtros} setFiltros={setFiltros} onAbrir={abrir} />
      )}
    </div>
  );
}
