import { exigirAba } from '@/lib/sessaoServidor';
import { AlternarSimulacao } from '@/components/shopping/AlternarSimulacao';
import { TituloPagina } from '@/components/shopping/Comum';
import { ZonasMortasReal } from '@/components/shopping/real/ZonasMortasReal';
import { ZonasMortasSimuladas } from '@/components/shopping/simulacao/ZonasMortasSimuladas';
import { URL_MOTOR } from '@/lib/shopping/casos';

export default async function Pagina() {
  await exigirAba('zonas-mortas');
  return (
    <div>
      <TituloPagina titulo="Zonas mortas" descricao="Áreas com movimento bem abaixo da média. Com a simulação desligada, sai dos vídeos reais das câmeras; ligada, mostra o shopping inteiro e permite testar uma ação (quiosque, evento, sinalização)." />
      <AlternarSimulacao real={<ZonasMortasReal urlMotor={URL_MOTOR} />} simulado={<ZonasMortasSimuladas />} />
    </div>
  );
}
