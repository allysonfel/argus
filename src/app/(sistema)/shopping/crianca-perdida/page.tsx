import { TituloPagina, Secao } from '@/components/shopping/Comum';
import { BuscaCrianca } from '@/components/shopping/BuscaCrianca';
import { exigirSessao } from '@/lib/sessaoServidor';
import { descritoresRecentes } from '@/lib/shopping/seguranca';

export default async function CriancaPerdidaPage() {
  const sessao = await exigirSessao();
  return (
    <div>
      <TituloPagina
        titulo="Busca de criança perdida"
        descricao="Descreva a roupa e o sistema procura, nas câmeras de corredor das últimas 2 horas, pessoas com cores e estatura compatíveis. Ele sugere candidatos; quem confirma é a equipe de Segurança."
      />

      <Secao titulo="Buscar" descricao="Exemplos: “menino de camisa azul e bermuda preta”, “menina de vestido rosa”, “criança de blusa amarela”" >
        <BuscaCrianca pessoas={descritoresRecentes()} usuario={sessao.nome} />
      </Secao>

    </div>
  );
}
