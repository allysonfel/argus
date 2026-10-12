'use client';

import { useCallback, useEffect, useRef } from 'react';

// Miniaturas ao vivo de VÁRIAS câmeras por UM WebSocket (/ws/mosaico do
// motor). Cada mensagem binária = 1 byte (tamanho do id) + id + 8 bytes
// (timestamp) + JPEG. A imagem vai direto no <img> registrado para a
// câmera, sem passar pelo estado do React (dezenas de quadros/s).

const decodificador = new TextDecoder();

export function useMosaicoAoVivo(urlMotor: string, ids: string[], largura: number, fps: number) {
  const imagens = useRef(new Map<string, HTMLImageElement>());
  // Últimas URLs de blob por câmera: a anterior só é liberada depois que a
  // seguinte chegou, pra não liberar uma imagem que ainda está carregando.
  const urls = useRef(new Map<string, string[]>());
  const wsRef = useRef<WebSocket | null>(null);
  const pedidoRef = useRef({ ids, largura, fps });
  pedidoRef.current = { ids, largura, fps };
  const chavePedido = `${ids.join(',')}|${largura}|${fps}`;

  const enviarPedido = useCallback(() => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return;
    const { ids, largura, fps } = pedidoRef.current;
    ws.send(JSON.stringify({ cameras: ids, largura, fps }));
  }, []);

  useEffect(() => {
    let encerrado = false;
    let religar: ReturnType<typeof setTimeout> | undefined;
    const mapaUrls = urls.current;

    function conectar() {
      const ws = new WebSocket(`${urlMotor.replace(/^http/, 'ws')}/ws/mosaico`);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;
      ws.onopen = enviarPedido;
      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') return;
        const bytes = new Uint8Array(ev.data);
        const n = bytes[0];
        const id = decodificador.decode(bytes.subarray(1, 1 + n));
        const url = URL.createObjectURL(new Blob([bytes.subarray(1 + n + 8)], { type: 'image/jpeg' }));
        const fila = mapaUrls.get(id) ?? [];
        fila.push(url);
        while (fila.length > 2) URL.revokeObjectURL(fila.shift()!);
        mapaUrls.set(id, fila);
        const img = imagens.current.get(id);
        if (img) img.src = url;
      };
      ws.onclose = () => {
        if (!encerrado) religar = setTimeout(conectar, 2000);
      };
    }
    conectar();

    return () => {
      encerrado = true;
      clearTimeout(religar);
      wsRef.current?.close();
      for (const fila of mapaUrls.values()) fila.forEach((u) => URL.revokeObjectURL(u));
      mapaUrls.clear();
    };
  }, [urlMotor, enviarPedido]);

  useEffect(() => {
    enviarPedido();
  }, [chavePedido, enviarPedido]);

  /** Ref de callback para o <img> da câmera: `<img ref={registrar(id)} />`. */
  const registrar = useCallback(
    (id: string) => (el: HTMLImageElement | null) => {
      if (el) {
        imagens.current.set(id, el);
        const ultima = urls.current.get(id)?.at(-1);
        if (ultima && el.src !== ultima) el.src = ultima;
      } else {
        imagens.current.delete(id);
      }
    },
    []
  );

  return registrar;
}
