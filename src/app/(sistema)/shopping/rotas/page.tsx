import { exigirAba } from '@/lib/sessaoServidor';
import { AlternarSimulacao } from '@/components/shopping/AlternarSimulacao';
import { TituloPagina } from '@/components/shopping/Comum';
import { RotasReal } from '@/components/shopping/real/RotasReal';
import { RotasSimuladas } from '@/components/shopping/simulacao/RotasSimuladas';
import { URL_MOTOR } from '@/lib/shopping/casos';

export default async function Pagina() {
  await exigirAba('rotas');
  return (
    <div>
      <TituloPagina titulo="Rotas e fluxo" descricao="Por onde as pessoas entram, que caminho fazem e para onde vão. Com a simulação desligada, sai dos caminhos reais nas câmeras; ligada, mostra as rotas pelo shopping inteiro." />
      <AlternarSimulacao real={<RotasReal urlMotor={URL_MOTOR} />} simulado={<RotasSimuladas />} />
    </div>
  );
}
