import { exigirSessao } from '@/lib/sessaoServidor';
import { AoVivoClient } from './AoVivoClient';

export default async function AoVivoPage() {
  await exigirSessao();
  const urlMotor = process.env.NEXT_PUBLIC_ARGUS_VISAO_URL || 'http://localhost:8500';

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-on-surface">Câmeras ao vivo</h1>
      <p className="mb-6 text-sm text-on-surface-variant">
        Vídeo na velocidade original, com a análise de pessoas desenhada por cima. Os números são estimativas do sistema.
      </p>
      <AoVivoClient urlMotor={urlMotor} />
    </div>
  );
}
