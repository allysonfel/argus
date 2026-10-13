'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Secao, Tabela } from '@/components/shopping/Comum';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, SelectField } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { ABAS, PERFIS_MODELO } from '@/lib/shopping/permissoes';
import { alterarAtivo, criarUsuario, desbloquear, editarUsuario, redefinirSenha, type DadosUsuario, type Resultado } from './acoes';

type Usuario = {
  id: number;
  nome: string;
  username: string;
  email: string | null;
  telefone: string | null;
  role: string;
  admin_geral: boolean;
  abas: string[];
  perfil_modelo: string | null;
  ativo: boolean;
  trocar_senha: boolean;
  bloqueado_ate: string | null;
  ultimo_acesso: string | null;
  criado_em: string;
};
type LinhaAuditoria = { id: number; criado_em: string; acao: string; quem: string | null; alvo: string | null; detalhes: Record<string, unknown> | null };

const NOME_ACAO: Record<string, string> = {
  login: 'Entrou no sistema',
  login_falhou: 'Errou a senha',
  login_bloqueado: 'Bloqueado por tentativas erradas',
  logout: 'Saiu do sistema',
  senha_trocada: 'Trocou a própria senha',
  senha_redefinida: 'Redefiniu a senha de',
  usuario_criado: 'Cadastrou',
  usuario_editado: 'Editou o cadastro de',
  permissoes_alteradas: 'Mudou as permissões de',
  usuario_desativado: 'Desativou',
  usuario_reativado: 'Reativou',
  usuario_desbloqueado: 'Desbloqueou',
  configuracoes_alteradas: 'Alterou as configurações',
};

const ABAS_LIBERAVEIS = ABAS.filter((a) => !a.soAdminGeral);
const fmtData = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Recife', dateStyle: 'short', timeStyle: 'short' }) : '—');

const VAZIO: DadosUsuario = { nome: '', username: '', senha: '', email: '', telefone: '', abas: PERFIS_MODELO[0].abas, perfilModelo: PERFIS_MODELO[0].id, adminGeral: false };

export function GerenciarUsuarios({ eu, usuarios, auditoria }: { eu: number; usuarios: Usuario[]; auditoria: LinhaAuditoria[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [editando, setEditando] = useState<number | 'novo' | null>(null);
  const [form, setForm] = useState<DadosUsuario>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; senha?: string } | null>(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);

  function executar(acao: () => Promise<Resultado>, sucesso: (r: Extract<Resultado, { ok: true }>) => void) {
    setErro(null);
    iniciar(async () => {
      try {
        const r = await acao();
        if (!r.ok) setErro(r.erro);
        else {
          sucesso(r);
          router.refresh();
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Algo deu errado.');
      }
    });
  }

  function abrirNovo() {
    setForm(VAZIO);
    setEditando('novo');
    setErro(null);
    setAviso(null);
  }

  function abrirEdicao(u: Usuario) {
    setForm({ nome: u.nome, username: u.username, email: u.email ?? '', telefone: u.telefone ?? '', abas: u.abas, perfilModelo: u.perfil_modelo, adminGeral: u.admin_geral });
    setEditando(u.id);
    setErro(null);
    setAviso(null);
  }

  function aplicarPerfil(id: string) {
    const p = PERFIS_MODELO.find((x) => x.id === id);
    setForm((f) => ({ ...f, perfilModelo: p ? p.id : null, abas: p ? p.abas : f.abas }));
  }

  function alternarAba(id: string) {
    setForm((f) => ({ ...f, abas: f.abas.includes(id) ? f.abas.filter((a) => a !== id) : [...f.abas, id] }));
  }

  function salvar() {
    if (editando === 'novo')
      executar(
        () => criarUsuario(form),
        () => {
          setAviso({ texto: `Usuário ${form.username} criado. No primeiro acesso ele vai ter que trocar a senha.` });
          setEditando(null);
        }
      );
    else if (typeof editando === 'number')
      executar(
        () => editarUsuario(editando, form),
        () => {
          setAviso({ texto: 'Cadastro salvo.' });
          setEditando(null);
        }
      );
  }

  const lista = usuarios.filter((u) => mostrarInativos || u.ativo);
  const bloqueado = (u: Usuario) => !!u.bloqueado_ate && new Date(u.bloqueado_ate).getTime() > Date.now();

  return (
    <div className="flex flex-col gap-6">
      {aviso && (
        <Alert variant="success">
          {aviso.texto}
          {aviso.senha && (
            <span className="mt-2 block">
              Senha provisória: <code className="rounded-sm bg-surface px-2 py-0.5 text-base font-semibold tracking-wider">{aviso.senha}</code> · anote e passe para a pessoa. Ela não aparece de novo; no próximo acesso o sistema pede uma senha nova.
            </span>
          )}
        </Alert>
      )}
      {erro && !editando && <Alert variant="error">{erro}</Alert>}

      {editando !== null && (
        <Secao titulo={editando === 'novo' ? 'Novo usuário' : 'Editar usuário'} descricao="Nome, login e senha são obrigatórios; e-mail e telefone são opcionais.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            <Field label="Login" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required hint="Letras, números, ponto ou hífen (ex.: maria.silva)" />
            {editando === 'novo' && <Field label="Senha inicial" type="text" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required hint="Pelo menos 8 caracteres, com letras e números. A pessoa troca no primeiro acesso." />}
            <Field label="E-mail (opcional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Field label="Telefone (opcional)" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>

          <div className="mt-5 rounded-md border border-outline-variant p-4">
            <div className="flex flex-wrap items-end gap-4">
              <SelectField label="Perfil pronto (preenche as abas)" value={form.perfilModelo ?? ''} onChange={(e) => aplicarPerfil(e.target.value)} className="w-72">
                <option value="">Personalizado</option>
                {PERFIS_MODELO.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </SelectField>
              <label className="flex items-center gap-2 pb-2 text-sm text-on-surface">
                <input type="checkbox" checked={form.adminGeral} onChange={(e) => setForm({ ...form, adminGeral: e.target.checked })} />
                Administrador geral (vê tudo e gerencia usuários e configurações)
              </label>
            </div>
            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Abas que este usuário pode acessar</p>
            <div className={cn('grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3', form.adminGeral && 'pointer-events-none opacity-50')}>
              {ABAS_LIBERAVEIS.map((a) => (
                <label key={a.id} className={cn('flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm', form.abas.includes(a.id) ? 'border-primary bg-primary/5' : 'border-outline-variant')}>
                  <input type="checkbox" className="mt-0.5" checked={form.adminGeral || form.abas.includes(a.id)} onChange={() => {
                    alternarAba(a.id);
                    setForm((f) => ({ ...f, perfilModelo: null }));
                  }} />
                  <span>
                    <span className="block font-medium text-on-surface">
                      {a.nome} {a.seguranca && <Badge variant="warning" className="ml-1">segurança</Badge>}
                    </span>
                    <span className="block text-xs text-on-surface-variant">{a.descricao}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-on-surface-variant">Usuários e Configurações são só do administrador geral. O Pergunte ao Argus só responde sobre as abas liberadas e nunca sobre segurança.</p>
          </div>

          {erro && <Alert variant="error" className="mt-4">{erro}</Alert>}
          <div className="mt-4 flex gap-2">
            <Button onClick={salvar} disabled={pendente}>
              {pendente ? 'Salvando…' : editando === 'novo' ? 'Cadastrar usuário' : 'Salvar'}
            </Button>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
          </div>
        </Secao>
      )}

      <Secao
        titulo="Usuários"
        descricao={`${usuarios.filter((u) => u.ativo).length} ativo(s) · ${usuarios.filter((u) => !u.ativo).length} desativado(s)`}
        acao={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} /> Mostrar desativados
            </label>
            <Button size="sm" onClick={abrirNovo}>
              + Novo usuário
            </Button>
          </div>
        }
      >
        <Tabela
          cabecalho={['Usuário', 'Acesso', 'Situação', 'Último acesso', '']}
          linhas={lista.map((u) => [
            <div key="n">
              <p className="font-medium text-on-surface">
                {u.nome} {u.id === eu && <span className="text-xs text-on-surface-variant">(você)</span>}
              </p>
              <p className="text-xs text-on-surface-variant">
                {u.username}
                {u.email ? ` · ${u.email}` : ''}
                {u.telefone ? ` · ${u.telefone}` : ''}
              </p>
            </div>,
            <div key="a" className="max-w-72 text-xs">
              {u.admin_geral ? (
                <Badge variant="primary">Administrador geral</Badge>
              ) : (
                <>
                  {u.perfil_modelo && <Badge className="mb-1">{PERFIS_MODELO.find((p) => p.id === u.perfil_modelo)?.nome}</Badge>}
                  <p className="text-on-surface-variant">{u.abas.length ? ABAS.filter((a) => u.abas.includes(a.id)).map((a) => a.nome).join(', ') : 'Nenhuma aba'}</p>
                </>
              )}
            </div>,
            <div key="s" className="flex flex-col items-start gap-1">
              {!u.ativo ? <Badge variant="neutral">Desativado</Badge> : bloqueado(u) ? <Badge variant="error">Bloqueado</Badge> : <Badge variant="success">Ativo</Badge>}
              {u.ativo && u.trocar_senha && <span className="text-[11px] text-on-surface-variant">troca de senha pendente</span>}
            </div>,
            <span key="u" className="text-xs text-on-surface-variant">
              {fmtData(u.ultimo_acesso)}
            </span>,
            <div key="b" className="flex flex-wrap justify-end gap-1.5">
              <Button size="sm" variant="outline" onClick={() => abrirEdicao(u)}>
                Editar
              </Button>
              <Button size="sm" variant="outline" disabled={pendente} onClick={() => confirm(`Gerar uma senha provisória para ${u.nome}? A senha atual deixa de funcionar.`) && executar(() => redefinirSenha(u.id), (r) => setAviso({ texto: `Senha de ${u.nome} redefinida.`, senha: r.senhaProvisoria }))}>
                Redefinir senha
              </Button>
              {bloqueado(u) && (
                <Button size="sm" variant="outline" disabled={pendente} onClick={() => executar(() => desbloquear(u.id), () => setAviso({ texto: `${u.nome} desbloqueado.` }))}>
                  Desbloquear
                </Button>
              )}
              {u.id !== eu &&
                (u.ativo ? (
                  <Button size="sm" variant="danger" disabled={pendente} onClick={() => confirm(`Desativar ${u.nome}? Ele perde o acesso na hora (o histórico fica guardado).`) && executar(() => alterarAtivo(u.id, false), () => setAviso({ texto: `${u.nome} desativado.` }))}>
                    Desativar
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled={pendente} onClick={() => executar(() => alterarAtivo(u.id, true), () => setAviso({ texto: `${u.nome} reativado.` }))}>
                    Reativar
                  </Button>
                ))}
            </div>,
          ])}
        />
      </Secao>

      <Secao titulo="Registro de auditoria" descricao="Entradas no sistema, cadastros, mudanças de permissão, senhas e configurações: quem fez e quando (últimos 150)">
        <div className="max-h-[28rem] overflow-y-auto">
          <Tabela
            cabecalho={['Quando', 'Quem', 'O que']}
            linhas={auditoria.map((a) => [
              <span key="q" className="whitespace-nowrap text-xs text-on-surface-variant">
                {fmtData(a.criado_em)}
              </span>,
              a.quem ?? '—',
              <span key="o" className="text-sm">
                {NOME_ACAO[a.acao] ?? a.acao}
                {a.alvo && !['login', 'login_falhou', 'login_bloqueado', 'logout', 'senha_trocada'].includes(a.acao) ? ` ${a.alvo}` : ''}
                {a.acao === 'permissoes_alteradas' && a.detalhes ? (
                  <span className="block text-xs text-on-surface-variant">
                    {resumoPermissoes(a.detalhes)}
                  </span>
                ) : null}
              </span>,
            ])}
          />
        </div>
      </Secao>
    </div>
  );
}

function resumoPermissoes(d: Record<string, unknown>): string {
  const antes = (d.antes as { abas: string[]; adminGeral: boolean }) ?? { abas: [], adminGeral: false };
  const depois = (d.depois as { abas: string[]; adminGeral: boolean }) ?? { abas: [], adminGeral: false };
  const nome = (id: string) => ABAS.find((a) => a.id === id)?.nome ?? id;
  const partes: string[] = [];
  if (antes.adminGeral !== depois.adminGeral) partes.push(depois.adminGeral ? 'virou administrador geral' : 'deixou de ser administrador geral');
  const ganhou = depois.abas.filter((a) => !antes.abas.includes(a));
  const perdeu = antes.abas.filter((a) => !depois.abas.includes(a));
  if (ganhou.length) partes.push(`ganhou: ${ganhou.map(nome).join(', ')}`);
  if (perdeu.length) partes.push(`perdeu: ${perdeu.map(nome).join(', ')}`);
  return partes.join(' · ');
}
