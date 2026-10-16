import Link from "next/link";
import ArgusHeader from "./ArgusHeader";
import TrackingDemo from "./TrackingDemo";
import TypingOnScroll from "./TypingOnScroll";
import CameraSimulator from "./CameraSimulator";
import Reveal from "./Reveal";

// Título do hero em Inter (ver argus-theme.css, --font-sans dessa
// página) — tema "Oxide" pede peso 400 fixo em tudo, hierarquia vem só
// de tamanho/tracking, nunca de peso maior nem de fonte de destaque à
// parte (Archivo/Alliance No.1 saíram daqui por causa disso).

// Copy escrita pelo cliente pro Logos [Argus] (revisão de 11/09), adaptada
// aqui pro formato de seções que a página já usa (cards, grids, cores
// alternando bg-surface/bg-surface-container-lowest) — sem travessão em
// nenhum texto, por pedido explícito (regra já usada no resto do
// projeto: reescrever com vírgula, ponto, ou parênteses em vez de "—").

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
      <path d="M9 18l-5.5 2.2a1 1 0 01-1.5-.9V5.7a1 1 0 01.7-1L9 3m0 15l6 3m-6-3V3m6 18l5.5-2.2a1 1 0 00.5-.9V4.7a1 1 0 00-1.4-1L15 6m0 15V6m0 0L9 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
      <path d="M6 10a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 21h4" strokeLinecap="round" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
      <path d="M4 20V10M12 20V4M20 20v-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 20h18" strokeLinecap="round" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
      <path d="M3 8a2 2 0 012-2h1.5l1.4-2h8.2l1.4 2H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function IconPlug() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
      <path d="M9 3v5M15 3v5M7 8h10v4a5 5 0 01-10 0zM12 17v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
      <path d="M4 5h16v11H9l-5 4z" strokeLinejoin="round" />
      <path d="M8 9.5h8M8 12.5h5" strokeLinecap="round" />
    </svg>
  );
}

const OVERVIEW = [
  {
    icon: IconClock,
    title: "Ponto IA",
    body: "Analise os registros de jornada com inteligência artificial e acompanhe os critérios definidos pela empresa.",
  },
  {
    icon: IconMap,
    title: "Rastreio em Tempo Real",
    body: "Acompanhe seus equipamentos no mapa e tenha visibilidade sobre sua última localização e status.",
  },
  {
    icon: IconCamera,
    title: "Câmeras IA",
    body: "Dê inteligência às câmeras que já estão instaladas e receba no WhatsApp o aviso com foto quando alguém entrar em uma área restrita.",
  },
  {
    icon: IconBell,
    title: "Alertas",
    body: "Identifique situações que fogem do padrão e receba informações para agir no momento certo.",
  },
  {
    icon: IconChart,
    title: "Uso Digital",
    body: "Acompanhe os sistemas e sites mais acessados pela equipe e entenda os hábitos de uso durante a jornada.",
  },
];

const CAMERA_STATS = [
  { value: "24/7", label: "Monitoramento contínuo" },
  { value: "99%", label: "Precisão na detecção" },
  { value: "< 3s", label: "Aviso no WhatsApp com foto" },
  { value: "Sem obra", label: "Funciona com suas câmeras" },
];

const CAMERA_STEPS = [
  {
    icon: IconPlug,
    title: "Conectamos suas câmeras",
    body: "Não é preciso comprar câmeras novas. O Argus se conecta aos gravadores e câmeras de rede que a sua empresa já tem instalados.",
  },
  {
    icon: IconEye,
    title: "A inteligência vigia dia e noite",
    body: "A IA identifica pessoas e veículos em áreas restritas, com 99% de precisão, e reduz os alarmes falsos causados por vento, chuva e animais.",
  },
  {
    icon: IconChat,
    title: "Aviso no WhatsApp, com foto",
    body: "Se alguém entrar em uma área proibida, você e sua equipe recebem o aviso com a foto do momento no WhatsApp, em menos de 3 segundos.",
  },
];

const ALERTS = [
  {
    title: "Queda de produtividade",
    body: "Identifique alterações significativas no desempenho e acompanhe situações que merecem atenção.",
  },
  {
    title: "Tempo ocioso",
    body: "Receba alertas quando o período de inatividade ultrapassar os limites definidos.",
  },
  {
    title: "Comportamentos fora do padrão",
    body: "A inteligência artificial ajuda a identificar situações que se desviam do comportamento habitual da operação.",
  },
];

const FAQ = [
  {
    q: "O que é o Sistema Argus?",
    a: "O Sistema Argus é uma plataforma para acompanhamento de jornadas, dispositivos e informações da operação. O sistema reúne recursos como Ponto IA, localização de dispositivos, Câmeras IA, alertas inteligentes e uso digital da equipe em um único ambiente.",
  },
  {
    q: "O que é o Ponto IA?",
    a: "É o recurso de inteligência artificial do Sistema Argus que analisa o check-in realizado pelo colaborador de acordo com os critérios definidos pela empresa. A análise pode considerar informações como rosto, uniforme, crachá, calçado, estação de trabalho e localização. Funciona tanto para equipe interna quanto externa.",
  },
  {
    q: "O Ponto IA bloqueia o registro?",
    a: "Não. O registro continua sendo realizado normalmente. A IA apenas analisa o check-in e apresenta o resultado para a gestão.",
  },
  {
    q: "O que acontece se a IA identificar uma não conformidade?",
    a: "O sistema sinaliza o resultado para que a gestão possa analisar a situação. A IA não aplica punições automaticamente e não impede o colaborador de realizar o registro.",
  },
  {
    q: "O sistema registra a localização?",
    a: "Sim. A localização pode ser utilizada junto ao registro para que a gestão tenha mais informações sobre onde o check-in foi realizado.",
  },
  {
    q: "Preciso instalar um relógio de ponto?",
    a: "Não. O Sistema Argus funciona por meio de software e aplicativo. Não depende da instalação de um relógio físico para realizar os registros.",
  },
  {
    q: "Posso acompanhar os dispositivos da empresa?",
    a: "Sim. O Sistema Argus permite visualizar dispositivos no mapa, consultar sua última localização conhecida e acompanhar informações de status disponíveis no sistema.",
  },
  {
    q: "Preciso trocar minhas câmeras para usar o Câmeras IA?",
    a: "Não. O Câmeras IA se conecta aos gravadores e câmeras de rede que a empresa já tem instalados, sem obra e sem troca de equipamento. A compatibilidade é confirmada antes da instalação.",
  },
  {
    q: "Como recebo os avisos das câmeras?",
    a: "Quando a IA detecta uma ocorrência, o Argus envia um aviso pelo WhatsApp com a foto do momento, em menos de 3 segundos. Os avisos vão para as pessoas que você definir.",
  },
  {
    q: "O sistema dispara alarme à toa com chuva, vento ou animais?",
    a: "A IA foi treinada para reconhecer pessoas e veículos com 99% de precisão e ignora movimentos como vento, chuva e animais, o que reduz os alarmes falsos.",
  },
  {
    q: "Posso utilizar o sistema em diferentes unidades?",
    a: "Sim. É possível centralizar diferentes unidades, equipes, colaboradores e dispositivos na mesma plataforma.",
  },
  {
    q: "O Sistema Argus serve para qualquer empresa?",
    a: "O sistema foi desenvolvido para operações que precisam acompanhar equipes, jornadas, dispositivos e informações operacionais de forma centralizada. A estrutura pode ser adaptada de acordo com a realidade da empresa.",
  },
];

export default function ArgusPage() {
  return (
    <>
      {/* HEADER — extraído pra ArgusHeader.tsx (Client Component): fica
          transparente no topo da página e "aparece" ao rolar (ver
          comentário lá pro porquê de fixed em vez de sticky). O ícone de
          menu (☰, ver MobileMenu.tsx) abre o mesmo painel em tela cheia
          do menu principal do site (MobileNav), até essa página ganhar
          uma navegação própria. */}
      <ArgusHeader />

      {/*
        HERO — vídeo de fundo cobrindo a seção inteira (não uma coluna
        separada: reexaminando a referência QOVES, o "hero" deles é UM
        elemento só, com foto/vídeo de fundo em toda a extensão e o
        texto sobreposto por cima, ancorado embaixo à esquerda no
        celular e mais centralizado no desktop). Isso garante título,
        subtítulo e botão sempre visíveis na primeira tela, sem precisar
        rolar — o problema da tentativa anterior (vídeo e texto em blocos
        empilhados) era justamente empurrar o texto pra fora da tela no
        celular.

        O vídeo (/argus-hero.mp4) ainda não existe, o cliente vai gravar
        o próprio; até lá cai num fundo sólido (bg-surface-container-high)
        por trás do degradê.

        A pedido do cliente: checklist "Ponto IA/Dispositivos/Alertas"
        removida daqui (o vídeo já vai deixar isso claro). O widget
        interativo (TrackingDemo, o "quadrado" com as 3 abas) voltou,
        sempre visível em qualquer tamanho de tela — ao lado do texto
        no desktop (flex-row), empilhado embaixo dele no celular
        (flex-col, herdado do container pai).
      */}
      {/*
        min-h 100svh cheio agora (não mais calc(100svh-64px)): o
        cabeçalho virou fixed e some transparente no topo (ver
        ArgusHeader.tsx), não ocupa mais espaço no fluxo normal, então
        não precisa mais descontar a altura dele aqui — sobra mais tela
        pro hero, e o conteúdo (título/subtítulo/botão/quadrado) pôde
        subir e se agrupar mais.
      */}
      <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden border-b border-outline-variant/60 lg:items-center">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full bg-surface-container-high object-cover"
        >
          <source src="/argus-hero.mp4" type="video/mp4" />
        </video>
        {/* Degradê escurecendo por trás do texto, mais forte embaixo (mobile)
            e mais forte à esquerda (desktop), pra manter contraste com
            qualquer vídeo. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/5 lg:bg-gradient-to-r lg:from-black/80 lg:via-black/45 lg:to-transparent"
        />

        <div className="relative mx-auto flex w-full min-w-0 max-w-[1200px] flex-col gap-md px-gutter pb-lg pt-24 lg:flex-row lg:items-center lg:justify-between lg:gap-xl lg:px-[4rem]">
          <div className="min-w-0 max-w-[30rem] text-center">
            {/*
              Título principal do hero: digita 1 vez só (TypingOnScroll,
              sem loop) e usa a fonte Archivo (ver import acima) em vez
              da SF Pro do resto do site, pra chegar mais perto do
              visual da Alliance No.1 da Palantir (licenciada, sem
              acesso) nesse tamanho grande de título.
            */}
            <TypingOnScroll
              as="h1"
              text="Controle e segurança pra sua operação, em um só sistema."
              className="text-headline-md font-normal leading-tight tracking-tight text-white sm:text-headline-lg"
            />
            <p className="mt-xs text-label-md text-white/60">
              Em tempo real, jornadas, produtividade e comportamento, tudo com dados reais e IA
              identificando o que merece atenção.
            </p>

            <ul className="mt-sm flex flex-wrap items-center justify-center gap-x-md gap-y-xs text-label-md text-white/70">
              {["Sem relógio caro", "Sem instalação física", "Inteligência Artificial Avançada"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="h-4 w-4 shrink-0 text-tertiary"
                  >
                    <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-md">
              <Link
                href="/contato"
                className="argus-mono inline-flex h-12 items-center justify-center border border-primary bg-primary px-6 text-label-md text-on-primary transition-colors hover:bg-primary-hover"
              >
                Fale Conosco Agora
              </Link>
            </div>
          </div>

          {/* Widget flutuando por cima do vídeo — a frase "Escolha o que
              precisa, combine como quiser." mora aqui agora (antes ficava
              junto do título), bem em cima do quadrado de propósito. */}
          <div className="w-full min-w-0 max-w-[480px] shrink-0">
            <p className="mb-sm text-center text-body-md text-white/80 sm:text-body-lg">
              Escolha o que precisa, combine como quiser.
            </p>
            <TrackingDemo />
          </div>
        </div>
      </section>

      {/* VISÃO GERAL */}
      <section className="border-b border-outline-variant/60">
        <Reveal className="mx-auto max-w-[1200px] px-gutter py-xl">
          <h2 className="text-center text-headline-md font-normal sm:text-[32px]">
            Uma visão completa da sua operação.
          </h2>
          <p className="mx-auto mt-xs max-w-[36rem] text-center text-body-md text-on-surface-variant">
            O Sistema Argus reúne informações que normalmente ficam espalhadas em diferentes
            sistemas e transforma tudo em uma única visão.
          </p>

          <div className="mt-lg grid gap-md sm:grid-cols-2 lg:grid-cols-6">
            {OVERVIEW.map((o, index) => (
              <div
                key={o.title}
                className={`border border-outline-variant/60 bg-surface p-md text-center ${
                  index < 3
                    ? "lg:col-span-2"
                    : index === OVERVIEW.length - 1
                      ? "sm:col-span-2 lg:col-span-3"
                      : "lg:col-span-3"
                }`}
              >
                <div className="mx-auto flex h-10 w-10 items-center justify-center border border-outline-variant/60 bg-primary-container text-on-primary-container">
                  <o.icon />
                </div>
                <p className="argus-mono mt-sm text-label-md text-on-surface">{o.title}</p>
                <p className="mt-xs text-body-md text-on-surface-variant">{o.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-lg text-center text-title-lg font-medium text-on-surface">Tudo em um só lugar.</p>
        </Reveal>
      </section>

      {/* CÂMERAS IA */}
      <section className="border-b border-outline-variant/60 bg-surface-container-lowest">
        <Reveal className="mx-auto max-w-[1200px] px-gutter py-xl">
          <div className="mx-auto max-w-[36rem] text-center">
            <p className="argus-mono text-label-sm text-on-surface-variant">Câmeras IA</p>
            <h2 className="mt-xs text-headline-md font-normal sm:text-[32px]">
              Aproveite as câmeras que você já tem.
            </h2>
            <p className="mt-xs text-body-md text-on-surface-variant">
              O Argus dá inteligência às câmeras e gravadores já instalados na sua operação, sem trocar
              equipamento e sem obra.
            </p>
          </div>

          <div className="mt-lg grid grid-cols-2 gap-px border border-outline-variant/60 bg-outline-variant lg:grid-cols-4">
            {CAMERA_STATS.map((stat) => (
              <div key={stat.label} className="bg-surface p-sm text-center">
                <p className="text-title-lg text-on-surface">{stat.value}</p>
                <p className="argus-mono mt-1 text-[10px] text-on-surface-variant">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-md grid gap-md md:grid-cols-3">
            {CAMERA_STEPS.map((step, index) => (
              <div key={step.title} className="border border-outline-variant/60 bg-surface p-md">
                <div className="flex items-center justify-between gap-sm">
                  <span className="flex h-10 w-10 items-center justify-center border border-outline-variant/60 bg-primary-container text-on-primary-container">
                    <step.icon />
                  </span>
                  <span className="argus-mono text-label-sm text-on-surface-variant">
                    Passo {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <p className="mt-sm text-title-lg text-on-surface">{step.title}</p>
                <p className="mt-xs text-body-md text-on-surface-variant">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-xl max-w-[36rem] text-center">
            <p className="argus-mono text-label-sm text-on-surface-variant">Simulador interativo</p>
            <h3 className="mt-xs text-headline-md font-normal sm:text-[32px]">Teste você mesmo.</h3>
            <p className="mt-xs text-body-md text-on-surface-variant">
              Escolha o evento, o local e a severidade. Veja o Argus detectar a ocorrência e montar o
              aviso que chega no WhatsApp.
            </p>
          </div>

          <div className="mt-lg">
            <CameraSimulator />
          </div>
        </Reveal>
      </section>

      {/* ALERTAS */}
      <section className="border-b border-outline-variant/60">
        <Reveal className="mx-auto max-w-[1200px] px-gutter py-xl">
          <div className="mx-auto max-w-[36rem] text-center">
            <h2 className="text-headline-md font-normal sm:text-[32px]">
              Nem todo problema aparece de uma vez. Primeiro, ele foge do padrão.
            </h2>
            <p className="mt-xs text-body-lg text-on-surface-variant">
              O Sistema Argus ajuda você a perceber antes que passe despercebido.
            </p>
          </div>

          <div className="mt-lg grid gap-md sm:grid-cols-2">
            {ALERTS.map((alert) => (
              <div key={alert.title} className="flex gap-sm border border-outline-variant/60 p-md">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-outline-variant/60 bg-primary-container text-on-primary-container">
                  <IconBell />
                </span>
                <div>
                  <p className="font-medium text-on-surface">{alert.title}</p>
                  <p className="mt-xs text-body-md text-on-surface-variant">{alert.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* VISÃO CENTRALIZADA */}
      <section className="border-b border-outline-variant/60 bg-surface-container-lowest">
        <Reveal className="mx-auto max-w-[1200px] px-gutter py-xl text-center">
          <h2 className="text-headline-md font-normal sm:text-[32px]">
            Você não precisa estar em todos os lugares.
          </h2>
          <p className="mx-auto mt-xs max-w-[36rem] text-body-lg text-on-surface-variant">
            Precisa conseguir enxergar o que acontece neles.
          </p>
          <p className="mx-auto mt-md max-w-[36rem] text-body-md text-on-surface-variant">
            O Sistema Argus centraliza informações importantes da operação para que você
            tenha uma visão mais clara do que está acontecendo, mesmo quando a sua equipe
            está longe de você.
          </p>

          <div className="mx-auto mt-lg flex max-w-[36rem] flex-wrap justify-center gap-sm">
            {["Jornadas", "Check-ins", "Localização", "Dispositivos", "Câmeras", "Alertas", "Uso Digital"].map((item) => (
              <span
                key={item}
                className="argus-mono border border-outline-variant px-3 py-1 text-label-sm text-on-surface"
              >
                {item}
              </span>
            ))}
          </div>

          <p className="mt-lg text-title-lg font-medium text-on-surface">
            Tudo conectado em uma única plataforma.
          </p>
        </Reveal>
      </section>

      {/* CONFORMIDADE */}
      <section className="border-b border-outline-variant/60">
        <Reveal className="mx-auto max-w-[1200px] px-gutter py-xl text-center">
          <h2 className="text-headline-md font-normal sm:text-[32px]">
            Segurança, rastreabilidade e conformidade.
          </h2>
          <p className="mx-auto mt-md max-w-[36rem] text-body-md text-on-surface-variant">
            O Sistema Argus opera como REP-P (Registrador Eletrônico de Ponto via Programa),
            desenvolvido para atender aos requisitos da Portaria MTP nº 671/2021.
          </p>
          <p className="mx-auto mt-md max-w-[36rem] text-body-md text-on-surface-variant">
            O registro continua sendo realizado normalmente. O Ponto IA adiciona uma
            camada de análise ao processo, permitindo que a gestão tenha mais informações
            sobre cada registro.
          </p>

          <div className="mt-lg flex flex-col items-center gap-xs text-title-lg font-medium text-on-surface">
            <p>Mais informação para decidir.</p>
            <p>Mais rastreabilidade para acompanhar.</p>
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="border-b border-outline-variant/60 bg-surface-container-lowest">
        <Reveal className="mx-auto max-w-[800px] px-gutter py-xl">
          <h2 className="text-center text-headline-md font-normal sm:text-[32px]">
            Perguntas frequentes
          </h2>

          <div className="mt-lg flex flex-col gap-sm">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group border border-outline-variant/60 bg-surface p-md open:bg-surface-container-lowest"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-sm font-medium text-on-surface">
                  {item.q}
                  <span className="shrink-0 text-on-surface-variant transition-transform group-open:rotate-45">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-sm text-body-md text-on-surface-variant">{item.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* CTA FINAL */}
      <section>
        <Reveal className="mx-auto max-w-[1200px] px-gutter py-xl text-center">
          <p className="mx-auto max-w-2xl text-[26px] font-normal leading-snug text-on-surface">
            O que acontece na sua operação quando você não está olhando? Agora você pode
            saber.
          </p>
          <p className="mx-auto mt-sm max-w-[36rem] text-body-md text-on-surface-variant">
            Tenha mais visibilidade sobre jornadas, dispositivos e comportamentos, em uma
            única plataforma.
          </p>
          <Link
            href="/contato"
            className="argus-mono mt-lg inline-flex h-12 items-center justify-center border border-primary bg-primary px-6 text-label-md text-on-primary transition-colors hover:bg-primary-hover"
          >
            Fale Conosco Agora
          </Link>
        </Reveal>
      </section>

      {/* FOOTER — mesmo padrão do rodapé institucional do site (ver
          Footer.tsx), sem nada a mais. */}
      <footer className="border-t border-outline-variant/60 bg-surface-container-lowest">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-lg px-gutter py-xl text-label-md">
          <div>
            <h3 className="mb-sm text-title-lg font-medium text-on-surface">Empresa</h3>
            <ul className="space-y-sm text-on-surface-variant">
              <li>
                <Link href="/sobre-nos" className="hover:text-primary">
                  Sobre nós
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-sm text-title-lg font-medium text-on-surface">Suporte</h3>
            <ul className="space-y-sm text-on-surface-variant">
              <li>
                <Link href="/contato" className="hover:text-primary">
                  Contate-nos
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-md px-gutter pb-md">
          <a
            href="https://www.instagram.com/logoscompany.io/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Logos Company no Instagram"
            className="text-on-surface-variant transition-colors hover:text-primary"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
            </svg>
          </a>
        </div>

        <div className="mx-auto max-w-[1200px] px-gutter pb-lg text-center text-label-sm text-on-surface-variant">
          © {new Date().getFullYear()} Logos Company. Todos os direitos reservados.
        </div>
      </footer>
    </>
  );
}
