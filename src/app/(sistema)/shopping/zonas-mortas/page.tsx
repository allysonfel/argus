import { TituloPagina } from '@/components/shopping/Comum';
import { ZonasMortasSimuladas } from '@/components/shopping/simulacao/ZonasMortasSimuladas';

export default function Pagina() {
  return (
    <div>
      <TituloPagina titulo="Zonas mortas" descricao="Áreas de corredor com movimento bem abaixo da média do andar. Escolha uma delas e simule uma ação (quiosque, evento, sinalização) para ver o efeito no mesmo dia." />
      <ZonasMortasSimuladas />
    </div>
  );
}
