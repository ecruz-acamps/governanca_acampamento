# API de pré-fichas por núcleo

O sistema de Governança **consulta** uma API do outro sistema (que guarda as pré-fichas) para preencher a divisão de
fichas, sem precisar perguntar a cada núcleo. Só o **superadmin** vê a aba *API* e dispara a busca.

## Configuração (Vercel)

| Variável | Valor |
|---|---|
| `PREFICHAS_API_URL` | endereço completo do endpoint, com `https://` (ex.: `https://outro-sistema.exemplo/api/pre-fichas`) |
| `PREFICHAS_API_TOKEN` | segredo longo e aleatório, o mesmo configurado no outro sistema (`openssl rand -hex 32`) |

Depois de salvar as variáveis, faça um novo deploy. O token nunca é mostrado na tela nem gravado no banco.

## O que o outro sistema deve fazer

**Requisição** (feita pela Governança):

    GET {PREFICHAS_API_URL}
    Authorization: Bearer <PREFICHAS_API_TOKEN>
    Accept: application/json

O outro sistema precisa recusar com `401` quem não mandar o token certo, comparando em tempo constante, e deve responder
em menos de 10 segundos.

**Resposta** `200 application/json`:

    {
      "atualizado_em": "2026-10-28T12:00:00Z",
      "nucleos": [
        { "codigo": "ANGELINA", "nome": "Angelina", "pre_fichas": 12 },
        { "nome": "Garopaba", "pre_fichas": 9, "pre_fichas_fora": 3 },
        { "nome": "Palhoça – São Sebastião", "pre_fichas": 7 }
      ]
    }

Regras:
- `nucleos`: de 1 a 200 itens.
- `pre_fichas`: inteiro de 0 a 100000, obrigatório. `pre_fichas_fora` é opcional (pré-fichas de fora da Arquidiocese; só
  conta para Anitápolis e Garopaba, que separam dentro e fora).
- Cada item precisa de `codigo` **ou** `nome`. A Governança liga o item ao núcleo pelo código externo (cadastrado na aba
  *API*) e, se não houver, pelo nome sem acento e sem diferenciar maiúsculas/minúsculas.
- Resposta fora desse formato é recusada inteira, e nada é gravado.

## Fluxo na Governança

1. *API* > escolher a distribuição de fichas > **Consultar a API** (prévia: mostra hoje x API por núcleo, sem gravar).
2. Conferir as diferenças e os itens sem correspondência.
3. **Aplicar**: busca de novo na API e grava as pré-fichas. O resultado entra no histórico da aba.
4. Em *Fichas por núcleo*, as fichas já aparecem recalculadas.

## Segurança

- A Governança só chama o endereço configurado na Vercel; não existe campo para digitar um endereço na tela.
- Exige `https` (exceto `localhost` fora de produção), não segue redirecionamentos e limita resposta a 1 MB e 10 segundos.
- A API deve devolver só a contagem por núcleo, sem nome de pessoa nem dado pessoal.
