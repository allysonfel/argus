import { exigirAba } from '@/lib/sessaoServidor';
import { AlternarSimulacao } from '@/components/shopping/AlternarSimulacao';
import { TituloPagina } from '@/components/shopping/Comum';
import { CalorReal } from '@/components/shopping/real/CalorReal';
import { CalorSimulado } from '@/components/shopping/simulacao/CalorSimulado';
import { URL_MOTOR } from '@/lib/shopping/casos';

export default async function Pagina() {
  await exigirAba('mapa-calor');
  return (
    <div>
      <TituloPagina titulo="Mapa de calor" descricao="Onde as pessoas mais circulam e ficam. Com a simulação desligada, o calor sai dos vídeos reais das câmeras; ligada, mostra o shopping inteiro sobre a planta, ao vivo ou em outro dia." />
      <AlternarSimulacao real={<CalorReal urlMotor={URL_MOTOR} />} simulado={<CalorSimulado />} />
    </div>
  );
}
