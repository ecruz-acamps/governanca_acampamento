// Define (ou redefine) a senha de um usuário direto no banco, sem passar pela internet.
// Uso:  npm run definir-senha -- email@dominio.com
import readline from 'node:readline';
import postgres from 'postgres';
import { hash } from '@node-rs/argon2';

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Uso: npm run definir-senha -- email@dominio.com');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não encontrada. Crie o arquivo .env.local (veja .env.example).');
  process.exit(1);
}

function perguntarOculto(texto) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const escrever = rl._writeToOutput.bind(rl);
    let mudo = false;
    rl._writeToOutput = (s) => {
      if (!mudo) escrever(s);
    };
    rl.question(texto, (resposta) => {
      rl.close();
      process.stdout.write('\n');
      resolve(resposta);
    });
    mudo = true;
  });
}

function validar(senha) {
  if (senha.length < 12) return 'A senha precisa ter pelo menos 12 caracteres.';
  if (senha.length > 128) return 'A senha pode ter no máximo 128 caracteres.';
  if (!/[A-Za-zÀ-ÿ]/.test(senha)) return 'A senha precisa ter pelo menos uma letra.';
  if (!/[^A-Za-zÀ-ÿ]/.test(senha)) return 'A senha precisa ter pelo menos um número ou símbolo.';
  return null;
}

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', prepare: false, max: 1 });

try {
  const [u] = await sql`select id, nome from gov.usuario where email = ${email}`;
  if (!u) {
    console.error(`Nenhum usuário com o e-mail ${email}. Cadastre-o primeiro.`);
    process.exit(1);
  }
  console.log(`Definindo a senha de ${u.nome} (${email}).`);
  const s1 = await perguntarOculto('Nova senha (mín. 12 caracteres): ');
  const erro = validar(s1);
  if (erro) {
    console.error(erro);
    process.exit(1);
  }
  const s2 = await perguntarOculto('Repita a senha: ');
  if (s1 !== s2) {
    console.error('As senhas não conferem.');
    process.exit(1);
  }
  const h = await hash(s1, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  await sql`
    update gov.usuario
       set senha_hash = ${h}, senha_alterada_em = now(), precisa_trocar_senha = false,
           tentativas_falhas = 0, bloqueado_ate = null
     where id = ${u.id}
  `;
  console.log('Senha definida. Já pode entrar no sistema.');
} finally {
  await sql.end();
}
