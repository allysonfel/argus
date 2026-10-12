'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, SelectField } from '@/components/ui/Field';

const PADRAO_INTELBRAS = /^rtsp:\/\/[^:@/\s]+:[^@/\s]+@[\d.]+(:\d+)?\/cam\/realmonitor\?channel=\d+&subtype=[01]$/;

/** Cadastro de câmera com teste de conexão (demonstração: valida o
 *  endereço; a conexão de verdade é feita pelo motor de visão). */
export function CadastroCamera() {
  const [tipo, setTipo] = useState<'rtsp' | 'video'>('rtsp');
  const [teste, setTeste] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testando, setTestando] = useState(false);

  function testar(fonte: string) {
    setTestando(true);
    setTeste(null);
    setTimeout(() => {
      setTestando(false);
      if (tipo === 'video') setTeste(fonte ? { ok: true, msg: 'Arquivo encontrado. Ele vai rodar em loop como se fosse uma câmera ao vivo.' } : { ok: false, msg: 'Informe o caminho do vídeo.' });
      else if (!PADRAO_INTELBRAS.test(fonte)) setTeste({ ok: false, msg: 'Endereço fora do padrão Intelbras: rtsp://USUARIO:SENHA@IP:554/cam/realmonitor?channel=N&subtype=1' });
      else if (!/subtype=1$/.test(fonte)) setTeste({ ok: false, msg: 'Use o substream (subtype=1) para a análise. O stream principal pesa mais e não melhora a contagem.' });
      else setTeste({ ok: true, msg: 'Endereço válido. No ambiente real, o motor conecta pela VPN do shopping (via TCP) e mostra o primeiro quadro aqui.' });
    }, 900);
  }

  return (
    <form
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        testar(String(new FormData(e.currentTarget).get('fonte') ?? '').trim());
      }}
    >
      <Field label="Nome" name="nome" placeholder="Ex.: Corredor Oeste · câm. 5" required />
      <SelectField label="Tipo de fonte" value={tipo} onChange={(e) => setTipo(e.target.value as 'rtsp' | 'video')}>
        <option value="rtsp">Câmera (RTSP do NVR Intelbras)</option>
        <option value="video">Arquivo de vídeo (simulação)</option>
      </SelectField>
      <Field
        label={tipo === 'rtsp' ? 'Endereço RTSP' : 'Caminho do vídeo'}
        name="fonte"
        className="sm:col-span-2"
        placeholder={tipo === 'rtsp' ? 'rtsp://usuario:senha@10.20.1.10:554/cam/realmonitor?channel=5&subtype=1' : 'videos/corredor-oeste.mp4'}
      />
      <Field label="FPS de análise" name="fps" type="number" min={1} max={10} defaultValue={4} />
      <SelectField label="Andar" name="andar">
        <option value="T">Térreo</option>
        <option value="P1">Piso 1</option>
      </SelectField>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={testando}>
          {testando ? 'Testando...' : 'Testar conexão'}
        </Button>
        <span className="text-xs text-on-surface-variant">Depois do teste: desenhar zonas, linhas de contagem e portais sobre a imagem, e calibrar os 4 pontos com a planta.</span>
      </div>
      {teste && (
        <Alert variant={teste.ok ? 'success' : 'error'} className="sm:col-span-2">
          {teste.msg}
        </Alert>
      )}
    </form>
  );
}
