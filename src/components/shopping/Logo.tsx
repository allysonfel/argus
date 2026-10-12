import { cn } from '@/lib/cn';

// O logo original (public/argus-logo.png) é branco com transparência.
// Usado como MÁSCARA, ele assume a cor que o tema mandar (fica visível
// no claro e no escuro) sem redesenhar nada.
function Mascara({ src, proporcao, className }: { src: string; proporcao: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block bg-current', className)}
      style={{
        aspectRatio: proporcao,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}

/** Logotipo completo "ARGUS" (o A tem o olhinho). */
export function LogoArgus({ className }: { className?: string }) {
  return <Mascara src="/argus-logo.png" proporcao={751 / 187} className={className} />;
}

/** Só o "A" com olhinho, recortado do logotipo (public/argus-a.png). */
export function LogoA({ className }: { className?: string }) {
  return <Mascara src="/argus-a.png" proporcao={226 / 182} className={className} />;
}
