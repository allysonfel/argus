import { exigirAba } from '@/lib/sessaoServidor';
import { Suspense } from 'react';
import { TituloPagina } from '@/components/shopping/Comum';
import { AoVivoClient } from '@/components/shopping/AoVivoClient';

export default async function AoVivoPage() {
  await exigirAba('cameras');
  const urlMotor = process.env.NEXT_PUBLIC_ARGUS_VISAO_URL || 'http://localhost:8500';
  return (
    <div>
      <TituloPagina
        titulo="Câmeras ao vivo"
        descricao="Todas as câmeras do shopping num só lugar. Filtre por piso, escolha quantas ver por tela e clique numa câmera para ver em detalhe, com pessoas, rastros, linhas de contagem e zonas desenhados pelo motor de visão. Os números são estimativas do sistema."
      />
      {/* useSearchParams (câmera aberta na URL) pede um limite de Suspense. */}
      <Suspense fallback={<div className="min-h-64" />}>
        <AoVivoClient urlMotor={urlMotor} />
      </Suspense>
    </div>
  );
}
