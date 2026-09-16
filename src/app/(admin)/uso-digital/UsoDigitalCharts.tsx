'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

type Distribuicao = { nome: string; cliques: number }[];

const CORES = { primary: '#2563eb', secondary: '#4e8af7' };

export function UsoDigitalCharts({
  porColaborador,
  porUnidade,
  porDepartamento,
  mediaPorUnidade,
  evolucaoSemanal,
}: {
  porColaborador: Distribuicao;
  porUnidade: Distribuicao;
  porDepartamento: Distribuicao;
  mediaPorUnidade: { unidade: string; media: number }[];
  evolucaoSemanal: { semana: string; cliques: number }[];
}) {
  const [aba, setAba] = useState<'colaborador' | 'unidade' | 'departamento'>('colaborador');
  const dados = aba === 'colaborador' ? porColaborador.slice(0, 10) : aba === 'unidade' ? porUnidade : porDepartamento;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-on-surface">Distribuição de cliques</h2>
          <div className="flex gap-1 rounded-sm bg-surface-container-low p-0.5 text-xs">
            {(['colaborador', 'unidade', 'departamento'] as const).map((opcao) => (
              <button
                key={opcao}
                onClick={() => setAba(opcao)}
                className={cn(
                  'rounded-sm px-2.5 py-1 font-medium capitalize transition-colors',
                  aba === opcao ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'
                )}
              >
                {opcao}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={110} />
              <Tooltip />
              <Bar dataKey="cliques" fill={CORES.primary} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-on-surface">Média de cliques por unidade</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mediaPorUnidade}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" vertical={false} />
              <XAxis dataKey="unidade" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="media" fill={CORES.secondary} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <h2 className="mb-4 text-base font-semibold text-on-surface">Evolução semanal (colaborador selecionado)</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolucaoSemanal}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
              <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="cliques" stroke={CORES.primary} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
