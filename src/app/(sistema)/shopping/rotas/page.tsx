import { TituloPagina } from '@/components/shopping/Comum';
import { RotasSimuladas } from '@/components/shopping/simulacao/RotasSimuladas';

export default function Pagina() {
  return (
    <div>
      <TituloPagina titulo="Rotas e fluxo" descricao="Por onde as pessoas entram, que caminho fazem e para onde vão. Cada câmera registra por qual lado a pessoa entrou e saiu da imagem; juntando as câmeras vizinhas sai o caminho pelo shopping." />
      <RotasSimuladas />
    </div>
  );
}
