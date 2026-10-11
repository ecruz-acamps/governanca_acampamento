import postgres from 'postgres';

export type Sql = postgres.Sql;

const g = globalThis as unknown as { __govSql?: Sql };

function criar(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não configurada');
  return postgres(url, {
    ssl: 'require',
    prepare: false, // obrigatório no pooler em modo transação
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    // datas (tipo "date") ficam como texto AAAA-MM-DD, sem deslocamento de fuso
    types: {
      date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
    },
  }) as unknown as Sql;
}

export function sql(): Sql {
  return (g.__govSql ??= criar());
}

/**
 * Executa tudo em UMA transação. Define o fuso do Brasil e, quando há usuário,
 * o app.user_id que a auditoria do banco registra como autor da alteração.
 */
export async function run<T>(userId: string | null, fn: (tx: Sql) => Promise<T>): Promise<T> {
  const resultado = await sql().begin(async (tx) => {
    await tx`select set_config('TimeZone', 'America/Sao_Paulo', true)`;
    if (userId) await tx`select set_config('app.user_id', ${userId}, true)`;
    return fn(tx as unknown as Sql);
  });
  return resultado as T;
}
