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

      <Secao titulo="Buscar" descricao="Exemplos: “menino de camisa azul e bermuda preta”, “menina de vestido rosa”, “criança de blusa amarela”" className="mb-6">
        <BuscaCrianca pessoas={descritoresRecentes()} usuario={sessao.nome} />
      </Secao>

      <Secao titulo="Privacidade (LGPD)">
        <ul className="grid grid-cols-1 gap-x-8 gap-y-1.5 pl-5 text-xs leading-relaxed text-on-surface-variant sm:grid-cols-2 list-disc">
          <li>Sem rosto e sem biometria: só cores predominantes da roupa (parte de cima e de baixo), estatura estimada, câmera, horário e posição na planta.</li>
          <li>Recortes ficam num buffer temporário de 2 horas e são apagados automaticamente.</li>
          <li>Acesso exclusivo do perfil Segurança. Cada busca fica registrada (quem, quando, o que buscou).</li>
          <li>A função pode ser desligada a qualquer momento pela administração.</li>
          <li>A interpretação do texto roda num modelo open source local (OpenCLIP). Nada é enviado para fora do servidor.</li>
          <li>O Pergunte ao Argus não tem acesso a esta tela nem aos seus dados.</li>
        </ul>
      </Secao>
    </div>
  );
}
