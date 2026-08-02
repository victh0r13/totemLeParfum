import fs from 'node:fs';
import { TOKENS_PATH, requireEnv } from './env.js';

const TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token';
/** Renova o access_token quando faltar menos que isso para expirar. */
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

export function loadTokens() {
  if (!fs.existsSync(TOKENS_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function saveTokens(payload) {
  const tokens = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: Date.now() + (payload.expires_in ?? 21600) * 1000,
  };
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), 'utf8');
  return tokens;
}

function basicAuthHeader() {
  const clientId = requireEnv('BLING_CLIENT_ID');
  const clientSecret = requireEnv('BLING_CLIENT_SECRET');
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

async function tokenRequest(body) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Bling OAuth falhou (HTTP ${res.status}): ${JSON.stringify(data).slice(0, 400)}`,
    );
  }
  return data;
}

/** Troca o authorization_code por tokens e salva localmente. */
export async function exchangeCode(code) {
  const data = await tokenRequest({ grant_type: 'authorization_code', code });
  return saveTokens(data);
}

/** Renova via refresh_token e salva. */
export async function refreshTokens(refreshToken) {
  const data = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
  return saveTokens(data);
}

/**
 * Retorna um access_token válido, renovando automaticamente quando expirado.
 * Encerra com instruções caso a autorização inicial ainda não tenha sido feita.
 */
export async function getAccessToken() {
  let tokens = loadTokens();
  if (!tokens?.refresh_token) {
    // Lança em vez de encerrar: o servidor roda o sync dentro do próprio
    // processo e não pode morrer porque uma rodada falhou.
    throw new Error(
      'Nenhum token do Bling encontrado. Rode a autorização inicial: cd sync && npm run auth',
    );
  }
  if (Date.now() >= (tokens.expires_at ?? 0) - EXPIRY_MARGIN_MS) {
    console.log('[bling] access_token expirado — renovando via refresh_token...');
    try {
      tokens = await refreshTokens(tokens.refresh_token);
    } catch (err) {
      throw new Error(
        `Falha ao renovar o token do Bling (${err.message}). ` +
          'O refresh_token expira com ~30 dias sem uso — refaça: cd sync && npm run auth',
      );
    }
  }
  return tokens.access_token;
}
