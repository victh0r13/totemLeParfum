/**
 * Autorização inicial do Bling (OAuth 2.0 Authorization Code).
 *
 * Uso: cd sync && npm run auth
 *
 * 1. Sobe um servidor local para receber o callback (BLING_REDIRECT_URI).
 * 2. Abre/exibe a URL de autorização do Bling.
 * 3. Troca o authorization_code por access_token + refresh_token.
 * 4. Salva os tokens em sync/.tokens.json (ignorado pelo git).
 */
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import express from 'express';

import { requireEnv } from './env.js';
import { exchangeCode } from './tokens.js';

const AUTHORIZE_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize';

const clientId = requireEnv('BLING_CLIENT_ID');
requireEnv('BLING_CLIENT_SECRET');
const redirectUri = process.env.BLING_REDIRECT_URI || 'http://localhost:3000/callback';

const redirect = new URL(redirectUri);
const port = Number(redirect.port || 80);
const state = crypto.randomBytes(16).toString('hex');

const authUrl = new URL(AUTHORIZE_URL);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('state', state);

const app = express();

// O callback é aceito em qualquer rota: o Bling redireciona para a URI
// cadastrada no app (raiz ou /callback), e as duas devem funcionar.
app.get('*', async (req, res, next) => {
  const { code, state: returnedState, error } = req.query;
  if (!code && !error) return next();
  if (error) {
    res.status(400).send(`<h2>Autorização negada: ${error}</h2>`);
    console.error(`\n[erro] Autorização negada pelo Bling: ${error}`);
    process.exit(1);
  }
  if (returnedState !== state) {
    res.status(400).send('<h2>State inválido — tente novamente.</h2>');
    console.error('\n[erro] state divergente no callback (possível tentativa de CSRF).');
    process.exit(1);
  }
  try {
    await exchangeCode(String(code));
    res.send(
      '<h2 style="font-family:sans-serif">✅ Bling autorizado com sucesso!</h2>' +
        '<p style="font-family:sans-serif">Pode fechar esta janela e voltar ao terminal.</p>',
    );
    console.log('\n[ok] Tokens salvos em sync/.tokens.json');
    console.log('[ok] Agora rode:  npm run sync\n');
    setTimeout(() => process.exit(0), 500);
  } catch (err) {
    res.status(500).send(`<h2>Falha ao trocar o código: ${err.message}</h2>`);
    console.error(`\n[erro] ${err.message}`);
    process.exit(1);
  }
});

app.listen(port, () => {
  console.log(`\n[auth] Aguardando callback do Bling na porta ${port} (qualquer rota) ...`);
  console.log('\nAbra esta URL no navegador (tentando abrir automaticamente):\n');
  console.log(`  ${authUrl.toString()}\n`);
  const opener =
    process.platform === 'win32' ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${opener} "${authUrl.toString()}"`, () => {});
});
