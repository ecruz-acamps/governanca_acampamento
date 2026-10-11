type ErroPg = { code?: string; constraint_name?: string; message?: string };

const POR_RESTRICAO: Record<string, string> = {
  ck_requisitos_associado:
    'Para ser associado é preciso ter feito um acampamento querigmático, ter a 1ª Eucaristia e ter data de admissão (Art. 6).',
  ck_admissao_proposta:
    'Admissão proposta por outro associado precisa ser aprovada em assembleia (Art. 7, n). Esse registro entra na Fase 2.',
  ux_mandato_cargo_unico: 'Esse cargo já tem um ocupante ativo neste ciclo.',
  ux_usuario_email: 'Já existe um usuário com esse e-mail.',
  usuario_associado_id_key: 'Esse associado já está ligado a outro usuário.',
  ck_email_minusculo: 'O e-mail precisa estar em letras minúsculas.',
};

/** Traduz erros do banco em mensagens que o usuário entende. */
export function mensagemErro(e: unknown): string {
  const err = e as ErroPg;
  if (err?.constraint_name && POR_RESTRICAO[err.constraint_name]) return POR_RESTRICAO[err.constraint_name];
  // Regras escritas nas funções do banco (ex.: Diretoria exige missão do sênior)
  if (err?.code === 'P0001' && err.message) return err.message;
  console.error('Erro inesperado', e);
  return 'Não foi possível salvar. Confira os dados e tente de novo.';
}
