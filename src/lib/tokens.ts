import { createHash } from 'crypto';

/** O banco guarda só o hash do token enviado por e-mail. */
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
