'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, SelectField } from '@/components/ui/Field';

type Registro = { zona: string; data: string; descricao: string };

/** Formulário de registro de ação. Na demonstração fica só na tela;
 *  com o banco agregado (etapa 4) passa a gravar e entra na comparação. */
export function RegistrarAcao({ zonas }: { zonas: { id: string; nome: string }[] }) {
  const [aberto, setAberto] = useState(false);
  const [registros, setRegistros] = useState<Registro[]>([]);

  if (!aberto) {
    return (
      <div className="mt-4">
        {registros.map((r, i) => (
          <p key={i} className="mb-1 text-sm text-on-surface">
            {r.data.split('-').reverse().join('/')} · {r.zona} · {r.descricao} <span className="text-xs text-on-surface-variant">(aguardando dados depois da ação)</span>
          </p>
        ))}
        <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
          + Registrar ação
        </Button>
      </div>
    );
  }

  return (
    <form
      className="mt-4 grid grid-cols-1 gap-3 rounded-sm border border-outline-variant p-4 sm:grid-cols-4 sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const zona = zonas.find((z) => z.id === f.get('zona'))?.nome ?? '';
        setRegistros((rs) => [...rs, { zona, data: String(f.get('data')), descricao: String(f.get('descricao')) }]);
        setAberto(false);
      }}
    >
      <SelectField label="Área" name="zona" required>
        {zonas.map((z) => (
          <option key={z.id} value={z.id}>
            {z.nome}
          </option>
        ))}
      </SelectField>
      <Field label="Data" name="data" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
      <Field label="O que foi feito" name="descricao" required placeholder="Ex.: quiosque instalado" />
      <div className="flex gap-2">
        <Button type="submit" size="md">
          Salvar
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
