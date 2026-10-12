import { TituloPagina } from '@/components/shopping/Comum';
import { AoVivoClient } from '@/components/shopping/AoVivoClient';

export default function AoVivoPage() {
  const urlMotor = process.env.NEXT_PUBLIC_ARGUS_VISAO_URL || 'http://localhost:8500';
  return (
    <div>
      <TituloPagina
        titulo="Câmeras ao vivo"
        demo={false}
        descricao="Vídeo na velocidade original, com a análise de pessoas desenhada por cima (motor de visão real). Os números são estimativas do sistema."
      />
      <AoVivoClient urlMotor={urlMotor} />
    </div>
  );
}
