'use client';

import { useMemo, useState } from 'react';
import { Numero, Secao, Tabela } from '@/components/shopping/Comum';
import { LegendaDivergente } from '@/components/shopping/Planta';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Field';
import { formatarNumero } from '@/lib/shopping/demo';
import { ZONAS, ZONA_ALIMENTACAO, zonaPorId, type Andar } from '@/lib/shopping/planta';
import { indiceZonas, sementeDoDia, simular, type Acao, type Simulacao } from '@/lib/shopping/simulacao';
import { ControlesRelogio, MapaSimulacao, SeletorAndar, useRelogio } from './MapaSimulacao';

const TIPOS = [
  { id: 'quiosque', nome: 'Quiosque ou estande', multiplicador: 2.5 },
  { id: 'evento', nome: 'Evento ou ativação', multiplicador: 4 },
  { id: 'sinalizacao', nome: 'Sinalização e iluminação', multiplicador: 1.6 },
];

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Visitantes que passaram pela zona no dia (cada um conta uma vez). */
function passagens(sim: Simulacao, zonaId: string): number {
  const z = zonaPorId(zonaId)!;
  const ai = z.andar === 'T' ? 0 : 1;
  let n = 0;
  for (const a of sim.agentes)
    if (a.segs.some((s) => s.vis && s.andar === ai && s.x1 >= z.rect.x && s.x1 <= z.rect.x + z.rect.w && s.y1 >= z.rect.y && s.y1 <= z.rect.y + z.rect.h)) n++;
  return n * sim.escala;
}

export function ZonasMortasSimuladas() {
  const relogio = useRelogio();
  const semente = sementeDoDia(relogio.dia);
  const base = useMemo(() => simular([], semente, relogio.dia), [semente, relogio.dia]);
  const [andar, setAndar] = useState<Andar>('P1');
  const [limite, setLimite] = useState(40);
  const indBase = useMemo(() => indiceZonas(base), [base]);
  const mortasBase = ZONAS.filter((z) => z.id in indBase && indBase[z.id] < limite / 100);
  const [zonaSel, setZonaSel] = useState<string>(() => [...ZONAS].filter((z) => z.id in indBase).sort((a, b) => indBase[a.id] - indBase[b.id])[0].id);
  const [tipo, setTipo] = useState(TIPOS[0].id);
  const [acao, setAcao] = useState<Acao & { tipo: string } | null>(null);
  const [ver, setVer] = useState<'antes' | 'depois'>('antes');
  const depois = useMemo(() => (acao ? simular([acao], semente, relogio.dia) : null), [acao, semente, relogio.dia]);
  const indDepois = useMemo(() => (depois ? indiceZonas(depois) : null), [depois]);

  const mostrando = ver === 'depois' && depois && indDepois ? { sim: depois, ind: indDepois } : { sim: base, ind: indBase };
  const doAndar = ZONAS.filter((z) => z.andar === andar && z.id in mostrando.ind).sort((a, b) => mostrando.ind[a.id] - mostrando.ind[b.id]);
  const mortasVistas = doAndar.filter((z) => mostrando.ind[z.id] < limite / 100);
  const valores: Record<string, number> = { [ZONA_ALIMENTACAO]: 1, ...mostrando.ind };

  function simularAcao() {
    const t = TIPOS.find((x) => x.id === tipo)!;
    setAcao({ zonaId: zonaSel, multiplicador: t.multiplicador, tipo: t.nome });
    setVer('depois');
    setAndar(zonaPorId(zonaSel)!.andar);
  }

  const resultado =
    acao && depois && indDepois
      ? {
          z: zonaPorId(acao.zonaId)!,
          antes: indBase[acao.zonaId],
          depois: indDepois[acao.zonaId],
          passAntes: passagens(base, acao.zonaId),
          passDepois: passagens(depois, acao.zonaId),
          tempoAntes: base.ocupacaoZona[acao.zonaId] * base.escala,
          tempoDepois: depois.ocupacaoZona[acao.zonaId] * depois.escala,
        }
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao
          titulo="Áreas abaixo da média do andar"
          descricao="Vermelho = abaixo da média, azul = acima. Contorno vermelho = zona morta. Clique numa área para escolhê-la."
          className="xl:col-span-2"
          acao={
            <div className="flex flex-wrap items-center gap-2">
              {acao && (
                <div className="flex rounded-sm bg-surface-container p-1">
                  {(['antes', 'depois'] as const).map((v) => (
                    <button key={v} onClick={() => setVer(v)} className={`h-8 rounded-sm px-3 text-sm font-medium ${ver === v ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant'}`}>
                      {v === 'antes' ? 'Antes da ação' : 'Depois da ação'}
                    </button>
                  ))}
                </div>
              )}
              <SeletorAndar andar={andar} setAndar={setAndar} />
            </div>
          }
        >
          <div className="mb-4">
            <ControlesRelogio relogio={relogio} />
          </div>
          <MapaSimulacao
            key={ver}
            sim={mostrando.sim}
            andar={andar}
            relogio={relogio}
            planta={{ valores, modo: 'divergente', formatarValor: 'indice', destaque: mortasVistas.map((z) => z.id), selecionada: zonaSel, aoClicarZona: (id) => id !== ZONA_ALIMENTACAO && setZonaSel(id) }}
          />
          <div className="mt-3">
            <LegendaDivergente />
          </div>
        </Secao>

        <div className="flex flex-col gap-6">
          <Secao titulo="Resumo do dia">
            <div className="grid grid-cols-2 gap-4">
              <Numero rotulo="Zonas mortas no shopping" valor={mortasBase.length} detalhe={`abaixo de ${limite}% da média`} />
              <Numero rotulo={`No ${andar === 'T' ? 'Térreo' : 'Piso 1'}`} valor={mortasVistas.length} detalhe={ver === 'depois' ? 'depois da ação' : 'hoje'} />
            </div>
            <SelectField label="Zona morta = abaixo de" value={limite} onChange={(e) => setLimite(Number(e.target.value))} className="mt-4">
              {[30, 40, 50, 60].map((v) => (
                <option key={v} value={v}>
                  {v}% da média do andar
                </option>
              ))}
            </SelectField>
          </Secao>

          <Secao titulo="Testar uma ação" descricao="Simula o mesmo dia com a ação na área escolhida e compara.">
            <div className="flex flex-col gap-3">
              <SelectField label="Área" value={zonaSel} onChange={(e) => setZonaSel(e.target.value)}>
                {[...ZONAS]
                  .filter((z) => z.id in indBase)
                  .sort((a, b) => indBase[a.id] - indBase[b.id])
                  .map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.nome} ({pct(indBase[z.id])})
                    </option>
                  ))}
              </SelectField>
              <SelectField label="Ação" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </SelectField>
              <Button onClick={simularAcao}>Simular ação</Button>
            </div>
            {resultado && (
              <div className="mt-4 rounded-sm bg-surface-container-low p-3 text-sm">
                <p className="mb-2 font-semibold text-on-surface">
                  {acao!.tipo} em {resultado.z.nome}
                </p>
                <ul className="flex flex-col gap-1 text-on-surface">
                  <li className="flex justify-between gap-2">
                    <span className="text-on-surface-variant">Índice da área</span>
                    <span className="tabular-nums">
                      {pct(resultado.antes)} → <b className={resultado.depois > resultado.antes ? 'text-[var(--color-success)]' : 'text-error'}>{pct(resultado.depois)}</b>
                    </span>
                  </li>
                  <li className="flex justify-between gap-2">
                    <span className="text-on-surface-variant">Visitantes que passam por dia</span>
                    <span className="tabular-nums">
                      {formatarNumero(resultado.passAntes)} → <b>{formatarNumero(resultado.passDepois)}</b>
                    </span>
                  </li>
                  <li className="flex justify-between gap-2">
                    <span className="text-on-surface-variant">Tempo das pessoas na área</span>
                    <span className="tabular-nums">
                      {formatarNumero(resultado.tempoAntes)} → <b>{formatarNumero(resultado.tempoDepois)}</b> pessoas × min
                    </span>
                  </li>
                </ul>
                <button onClick={() => { setAcao(null); setVer('antes'); }} className="mt-2 text-xs font-medium text-primary hover:underline">
                  Desfazer simulação
                </button>
              </div>
            )}
          </Secao>
        </div>
      </div>

      <Secao titulo={`Áreas do ${andar === 'T' ? 'Térreo' : 'Piso 1'}, da mais vazia para a mais movimentada`} descricao="Índice = tempo das pessoas na área por m² ÷ média do andar (100% = na média)">
        <Tabela
          cabecalho={['Área', 'Índice', 'Situação', '']}
          alinharDireita={[1]}
          linhas={doAndar.map((z) => [
            z.nome,
            pct(mostrando.ind[z.id]),
            mostrando.ind[z.id] < limite / 100 ? <Badge variant="error">Zona morta</Badge> : mostrando.ind[z.id] < 0.7 ? <Badge variant="warning">Pouco movimento</Badge> : <Badge>Normal</Badge>,
            <button key="b" onClick={() => setZonaSel(z.id)} className="text-xs font-medium text-primary hover:underline">
              Testar ação aqui
            </button>,
          ])}
        />
      </Secao>
    </div>
  );
}
