'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { SelectField } from '@/components/ui/Field';
import { IconeCamera, IconeCheck } from '@/components/ui/icones';

type Props = {
  colaboradorIdSessao: number | null;
  ehAdmin: boolean;
  colaboradores: { id: number; nome: string }[];
};

export function CheckinForm({ colaboradorIdSessao, ehAdmin, colaboradores }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streamAtivo, setStreamAtivo] = useState(false);
  const [fotoCapturada, setFotoCapturada] = useState<string | null>(null);
  const [colaboradorId, setColaboradorId] = useState<number | ''>(colaboradorIdSessao ?? (colaboradores[0]?.id ?? ''));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ rotulo: string; registradoEm: string } | null>(null);

  useEffect(() => {
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function ligarCamera() {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreamAtivo(true);
    } catch {
      setErro('Não foi possível acessar a câmera — verifique a permissão do navegador.');
    }
  }

  function capturarFoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);
    setFotoCapturada(canvas.toDataURL('image/jpeg', 0.85));

    const stream = video.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    setStreamAtivo(false);
  }

  function refazer() {
    setFotoCapturada(null);
    ligarCamera();
  }

  async function registrar() {
    if (!fotoCapturada || !colaboradorId) return;
    setEnviando(true);
    setErro(null);

    const posicao = await new Promise<GeolocationPosition | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition((p) => resolve(p), () => resolve(null), { timeout: 8000 });
    });

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colaboradorId,
          fotoDataUrl: fotoCapturada,
          latitude: posicao?.coords.latitude ?? null,
          longitude: posicao?.coords.longitude ?? null,
        }),
      });
      const corpo = await res.json();
      if (!res.ok) {
        setErro(corpo?.error ?? 'Não foi possível registrar o ponto.');
        return;
      }
      setResultado(corpo);
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return (
      <div className="rounded bg-surface border border-outline-variant p-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success-container text-on-success-container">
          <IconeCheck width={28} height={28} strokeWidth={2.5} />
        </div>
        <h2 className="text-lg font-semibold text-on-surface">Ponto registrado!</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          {resultado.rotulo} às {new Date(resultado.registradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <Button className="mt-5" fullWidth onClick={() => setResultado(null)}>
          Registrar outro ponto
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded bg-surface border border-outline-variant p-6">
      {ehAdmin && (
        <SelectField
          label="Colaborador"
          className="mb-4"
          value={colaboradorId}
          onChange={(e) => setColaboradorId(Number(e.target.value))}
        >
          {colaboradores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </SelectField>
      )}

      <div className="relative mb-4 aspect-square w-full overflow-hidden rounded-sm bg-surface-container-high">
        {fotoCapturada ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fotoCapturada} alt="Selfie capturada" className="h-full w-full object-cover" />
        ) : (
          <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${streamAtivo ? '' : 'hidden'}`} />
        )}
        {!streamAtivo && !fotoCapturada && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-on-surface-variant">
            <IconeCamera width={32} height={32} />
            <span className="text-xs">Câmera desligada</span>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {erro && <Alert variant="error" className="mb-4">{erro}</Alert>}

      {!fotoCapturada ? (
        streamAtivo ? (
          <Button fullWidth onClick={capturarFoto}>
            Capturar selfie
          </Button>
        ) : (
          <Button fullWidth onClick={ligarCamera}>
            Ligar câmera
          </Button>
        )
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" onClick={refazer} disabled={enviando}>
            Refazer
          </Button>
          <Button fullWidth onClick={registrar} disabled={enviando || !colaboradorId}>
            {enviando ? 'Registrando…' : 'Confirmar ponto'}
          </Button>
        </div>
      )}

      <p className="mt-4 text-center text-xs text-on-surface-variant">A localização é capturada automaticamente ao confirmar.</p>
    </div>
  );
}
