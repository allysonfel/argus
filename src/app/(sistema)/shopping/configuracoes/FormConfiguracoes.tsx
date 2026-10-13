'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { Secao } from '@/components/shopping/Comum';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, SelectField } from '@/components/ui/Field';
import type { CamposConfiguracoes } from '@/lib/shopping/configuracoes';
import { salvar } from './acoes';

const FUSOS: [string, string][] = [
  ['America/Recife', 'Recife / Caruaru (UTC−3)'],
  ['America/Fortaleza', 'Fortaleza (UTC−3)'],
  ['America/Bahia', 'Salvador (UTC−3)'],
  ['America/Sao_Paulo', 'Brasília / São Paulo (UTC−3)'],
  ['America/Belem', 'Belém (UTC−3)'],
  ['America/Manaus', 'Manaus (UTC−4)'],
  ['America/Cuiaba', 'Cuiabá (UTC−4)'],
  ['America/Rio_Branco', 'Rio Branco (UTC−5)'],
  ['America/Noronha', 'Fernando de Noronha (UTC−2)'],
];

/** Onde cada configuração já vale hoje (pra ninguém achar que mudou algo que ainda não muda). */
function Aplica({ agora }: { agora: boolean }) {
  return agora ? <Badge variant="success">vale agora</Badge> : <Badge variant="neutral">vale com as câmeras do shopping</Badge>;
}

function Bloco({ titulo, descricao, aplica, children }: { titulo: string; descricao: string; aplica?: ReactNode; children: ReactNode }) {
  return (
    <Secao titulo={titulo} descricao={descricao} acao={aplica}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </Secao>
  );
}

export function FormConfiguracoes({ inicial }: { inicial: CamposConfiguracoes }) {
  const router = useRouter();
  const [c, setC] = useState(inicial);
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const num = (k: keyof CamposConfiguracoes) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: Number(e.target.value.replace(',', '.')) });
  const txt = (k: keyof CamposConfiguracoes) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setC({ ...c, [k]: e.target.value });

  function escolherLogo(arquivo: File | undefined) {
    if (!arquivo) return;
    if (arquivo.size > 300_000) return setMsg({ ok: false, texto: 'A logo precisa ter até 300 KB.' });
    const r = new FileReader();
    r.onload = () => setC((x) => ({ ...x, logo: String(r.result) }));
    r.readAsDataURL(arquivo);
  }

  function enviar() {
    setMsg(null);
    iniciar(async () => {
      try {
        const r = await salvar(c);
        setMsg(r.ok ? { ok: true, texto: 'Configurações salvas.' } : { ok: false, texto: r.erro });
        if (r.ok) router.refresh();
      } catch (e) {
        setMsg({ ok: false, texto: e instanceof Error ? e.message : 'Não foi possível salvar.' });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Bloco titulo="Dados do shopping" descricao="Aparecem no menu e nos relatórios." aplica={<Aplica agora />}>
        <Field label="Nome do shopping" value={c.nome} onChange={txt('nome')} />
        <Field label="Cidade" value={c.cidade} onChange={txt('cidade')} />
        <div>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Logo (foto de perfil no menu)</span>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-low">
              <img src={c.logo ?? '/caruaru-simbolo.png'} alt="" className="h-10 w-10 object-contain" />
            </span>
            <label className="cursor-pointer rounded-sm border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container-low">
              Escolher imagem
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => escolherLogo(e.target.files?.[0])} />
            </label>
            {c.logo && (
              <button className="text-xs text-primary hover:underline" onClick={() => setC({ ...c, logo: null })}>
                Usar a padrão
              </button>
            )}
          </div>
        </div>
      </Bloco>

      <Bloco titulo="Fuso e horário de funcionamento" descricao="Base para o limite diário do Pergunte ao Argus, áreas restritas e relatórios." aplica={<Aplica agora />}>
        <SelectField label="Fuso horário" value={c.fuso} onChange={txt('fuso')}>
          {FUSOS.map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Seg a sáb · abre" type="time" value={c.abre} onChange={txt('abre')} />
          <Field label="fecha" type="time" value={c.fecha} onChange={txt('fecha')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Domingo e feriado · abre" type="time" value={c.domingo_abre} onChange={txt('domingo_abre')} />
          <Field label="fecha" type="time" value={c.domingo_fecha} onChange={txt('domingo_fecha')} />
        </div>
      </Bloco>

      <Bloco titulo="Prazos de retenção" descricao="Por quanto tempo o sistema guarda evidências e recortes. Depois disso são apagados." aplica={<Aplica agora={false} />}>
        <Field label="Evidências (dias)" type="number" min={1} max={365} value={c.retencao_evidencias_dias} onChange={num('retencao_evidencias_dias')} hint="Clipes e imagens de ocorrências." />
        <Field label="Buffer da busca de criança (horas)" type="number" min={1} max={168} value={c.retencao_busca_crianca_horas} onChange={num('retencao_busca_crianca_horas')} hint="Recortes e descritores usados pra procurar." />
      </Bloco>

      <Bloco titulo="Pergunte ao Argus" descricao="O assistente responde só com dados agregados e só sobre as abas que cada usuário vê." aplica={<Aplica agora />}>
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input type="checkbox" checked={c.pergunte_ativo} onChange={(e) => setC({ ...c, pergunte_ativo: e.target.checked })} />
          Assistente ligado
        </label>
        <Field label="Perguntas por usuário por dia" type="number" min={0} max={500} value={c.pergunte_limite_dia} onChange={num('pergunte_limite_dia')} />
      </Bloco>

      <Bloco titulo="Detecção" descricao="Parâmetros gerais do motor de visão para as câmeras do shopping." aplica={<Aplica agora={false} />}>
        <Field label="Confiança mínima (0,10 a 0,90)" type="number" step={0.05} min={0.1} max={0.9} value={c.deteccao_confianca} onChange={num('deteccao_confianca')} hint="Mais baixo pega mais gente, mas erra mais." />
        <Field label="Análises por segundo por câmera" type="number" step={0.5} min={0.5} max={15} value={c.deteccao_fps} onChange={num('deteccao_fps')} hint="Mais alto rastreia melhor e gasta mais servidor." />
      </Bloco>

      <Bloco titulo="Segurança do login" descricao="Valem para todos os usuários." aplica={<Aplica agora />}>
        <Field label="Sessão expira em (horas)" type="number" min={1} max={720} value={c.sessao_horas} onChange={num('sessao_horas')} hint="Depois disso pede login de novo." />
        <Field label="Tentativas erradas antes de bloquear" type="number" min={3} max={20} value={c.max_tentativas} onChange={num('max_tentativas')} />
        <Field label="Tempo de bloqueio (minutos)" type="number" min={1} max={1440} value={c.bloqueio_minutos} onChange={num('bloqueio_minutos')} />
      </Bloco>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-md border border-outline-variant bg-surface p-3 shadow-md">
        <Button onClick={enviar} disabled={pendente}>
          {pendente ? 'Salvando…' : 'Salvar configurações'}
        </Button>
        {msg && <Alert variant={msg.ok ? 'success' : 'error'}>{msg.texto}</Alert>}
      </div>
    </div>
  );
}
