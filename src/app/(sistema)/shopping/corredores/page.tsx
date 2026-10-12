import { TituloPagina } from '@/components/shopping/Comum';
import { CasoLoja } from '@/components/shopping/casos/CasoLoja';
import { URL_MOTOR } from '@/lib/shopping/casos';

export default function CorredoresPage() {
  return (
    <div>
      <TituloPagina
        titulo="Corredores e lojas"
        descricao="Quantas pessoas passam em frente a uma loja, quantas param na vitrine e quantas entram, medido pela câmera do corredor. Câmera de segurança real de um shopping (CAVIAR, Lisboa), comparada com a contagem feita à mão."
      />
      <CasoLoja urlMotor={URL_MOTOR} />
    </div>
  );
}
