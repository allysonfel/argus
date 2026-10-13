import { TituloPagina } from '@/components/shopping/Comum';
import { listarAuditoria } from '@/lib/auditoria';
import { exigirAba } from '@/lib/sessaoServidor';
import { listarUsuarios } from '@/lib/usuarios';
import { GerenciarUsuarios } from './GerenciarUsuarios';

export default async function UsuariosPage() {
  const sessao = await exigirAba('usuarios');
  const [usuarios, auditoria] = await Promise.all([listarUsuarios(sessao.empresaId), listarAuditoria(sessao.empresaId)]);
  return (
    <div>
      <TituloPagina titulo="Usuários e permissões" descricao="Só o administrador geral vê esta tela. Cadastre quem usa o sistema, escolha as abas de cada um (os perfis prontos preenchem as abas, depois dá pra ajustar) e acompanhe o registro de auditoria. Usuários não são excluídos, só desativados, pra manter o histórico." />
      <GerenciarUsuarios
        eu={sessao.id}
        usuarios={usuarios.map((u) => ({ ...u, bloqueado_ate: u.bloqueado_ate?.toISOString() ?? null, ultimo_acesso: u.ultimo_acesso?.toISOString() ?? null, criado_em: u.criado_em.toISOString() }))}
        auditoria={auditoria.map((a) => ({ ...a, criado_em: a.criado_em.toISOString() }))}
      />
    </div>
  );
}
