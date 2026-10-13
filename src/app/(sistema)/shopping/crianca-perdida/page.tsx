import { TituloPagina } from '@/components/shopping/Comum';
import { CasoCrianca } from '@/components/shopping/casos/CasoCrianca';
import { URL_MOTOR } from '@/lib/shopping/casos';
import { exigirAba } from '@/lib/sessaoServidor';

export default async function CriancaPerdidaPage() {
  const sessao = await exigirAba('crianca-perdida');
  return (
    <div>
      <TituloPagina
        titulo="Busca de criança perdida"
        descricao="Descreva a criança como a família descreveria (cor da roupa e se é criança). O sistema procura em todas as câmeras pessoas compatíveis e mostra o recorte, a câmera e o momento no vídeo. Ele sugere candidatos; quem confirma é a equipe de Segurança."
      />
      <CasoCrianca urlMotor={URL_MOTOR} usuario={sessao.nome} />
    </div>
  );
}
