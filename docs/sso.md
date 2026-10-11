# Acesso direto a partir do sistema interno (SSO)

O sistema interno (on-premises, publicado via cloudflared) gera, **a cada clique**, um link assinado:

    https://SEU-SITE/sso#t=<payload>.<assinatura>

- `payload` = base64url de `{"email":"admin@...","exp":<unix s, até 2 min à frente>,"jti":"<16+ caracteres aleatórios>"}`
- `assinatura` = base64url do HMAC-SHA256 do `payload` com o segredo `SSO_SECRET` (o mesmo nos dois lados, mín. 32 caracteres)
- Regras: o e-mail precisa ser de um usuário **ativo com papel admin**; cada `jti` só vale uma vez; expirou, não entra.
- O token vai no fragmento (#), então não aparece em logs de servidor. A página `/sso` o troca por uma sessão e limpa o endereço.

## Gerar o link no sistema interno

Node.js:

    import { createHmac, randomBytes } from 'node:crypto';
    export function linkGovernanca(email) {
      const corpo = Buffer.from(JSON.stringify({
        email, exp: Math.floor(Date.now()/1000) + 120, jti: randomBytes(16).toString('hex'),
      })).toString('base64url');
      const sig = createHmac('sha256', process.env.SSO_SECRET).update(corpo).digest('base64url');
      return `https://SEU-SITE/sso#t=${corpo}.${sig}`;
    }

Python:

    import base64, hashlib, hmac, json, os, secrets, time
    def link_governanca(email):
        corpo = base64.urlsafe_b64encode(json.dumps({"email": email, "exp": int(time.time())+120,
                "jti": secrets.token_hex(16)}).encode()).rstrip(b"=").decode()
        sig = base64.urlsafe_b64encode(hmac.new(os.environ["SSO_SECRET"].encode(), corpo.encode(),
                hashlib.sha256).digest()).rstrip(b"=").decode()
        return f"https://SEU-SITE/sso#t={corpo}.{sig}"

No botão/menu do sistema interno, o clique chama uma rota do **servidor** que devolve um redirecionamento (302) para esse link.
O `SSO_SECRET` fica só no servidor do sistema interno, nunca no navegador. Só gere o link para quem já está logado e autorizado lá.
