import { readFileSync } from 'node:fs';

const REQUIRED_SUPABASE_URL = 'https://api-edu-vps.grupotec.dev.br';

function readEnvFileValue(name) {
  try {
    const line = readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith(`${name}=`));

    if (!line) {
      return '';
    }

    return line
      .slice(line.indexOf('=') + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  } catch {
    return '';
  }
}

const supabaseUrl = (
  process.env.VITE_SUPABASE_URL ||
  readEnvFileValue('VITE_SUPABASE_URL')
).replace(/\/+$/, '');
const publishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  readEnvFileValue('VITE_SUPABASE_PUBLISHABLE_KEY');

if (!supabaseUrl) {
  throw new Error(
    'PRODUCTION_CONFIG_GUARD_FAILED: VITE_SUPABASE_URL is required',
  );
}

if (supabaseUrl.endsWith('.supabase.co') || supabaseUrl.includes('.supabase.co/')) {
  throw new Error(
    'PRODUCTION_CONFIG_GUARD_FAILED: Supabase Cloud is not allowed for production deploys',
  );
}

if (supabaseUrl !== REQUIRED_SUPABASE_URL) {
  throw new Error(
    `PRODUCTION_CONFIG_GUARD_FAILED: VITE_SUPABASE_URL must be ${REQUIRED_SUPABASE_URL}`,
  );
}

if (!publishableKey || publishableKey.includes('placeholder')) {
  throw new Error(
    'PRODUCTION_CONFIG_GUARD_FAILED: VITE_SUPABASE_PUBLISHABLE_KEY is missing or placeholder',
  );
}

process.stdout.write(
  `PRODUCTION_CONFIG_GUARD=PASS supabase=${REQUIRED_SUPABASE_URL}\n`,
);
