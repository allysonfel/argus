import { TituloPagina } from '@/components/shopping/Comum';
import { CalorSimulado } from '@/components/shopping/simulacao/CalorSimulado';

export default function Pagina() {
  return (
    <div>
      <TituloPagina titulo="Mapa de calor" descricao="Onde as pessoas mais circulam e ficam, sobre a planta de cada andar, ao longo do dia. Cada câmera de corredor é calibrada na planta e projeta a posição das pessoas nela; o calor soma esse movimento. Toque o dia ou arraste até a hora que quiser." />
      <CalorSimulado />
    </div>
  );
}
