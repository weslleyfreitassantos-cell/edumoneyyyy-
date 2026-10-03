import { readFileSync } from 'node:fs';

const expectedPlatformHost = 'admin.grupotec.dev.br';
const forbiddenEduHost = 'tecescola.grupotec.dev.br';
const platformHost = process.env.PLATFORM_HOST ?? expectedPlatformHost;
const deployHost = process.env.EDU_DEPLOY_HOST ?? '';

if (platformHost !== expectedPlatformHost) {
  throw new Error(
    `DOMAIN_ROUTING_GUARD_FAILED: PLATFORM_HOST must be ${expectedPlatformHost}`,
  );
}

if (deployHost === forbiddenEduHost) {
  throw new Error(
    `DOMAIN_ROUTING_GUARD_FAILED: Edu cannot deploy to ${forbiddenEduHost}`,
  );
}

const wranglerConfig = readFileSync('wrangler.jsonc', 'utf8');
const subdomainSource = readFileSync('src/lib/subdomain.ts', 'utf8');
const ssoSource = readFileSync(
  'supabase/functions/institution-sso-handoff/index.ts',
  'utf8',
);

if (!wranglerConfig.includes('*.grupotec.dev.br/*')) {
  throw new Error('DOMAIN_ROUTING_GUARD_FAILED: tenant wildcard route missing');
}

if (new RegExp(`"pattern"\\s*:\\s*"${forbiddenEduHost}/\\*"`).test(wranglerConfig)) {
  throw new Error(
    `DOMAIN_ROUTING_GUARD_FAILED: reserved marketing host is present in Edu wrangler routes`,
  );
}

if (!subdomainSource.includes(`cleanHost === '${expectedPlatformHost}'`)) {
  throw new Error(
    'DOMAIN_ROUTING_GUARD_FAILED: platform classification is not anchored on admin',
  );
}

if (subdomainSource.includes(`cleanHost === '${forbiddenEduHost}'`)) {
  throw new Error(
    'DOMAIN_ROUTING_GUARD_FAILED: marketing host is classified as platform',
  );
}

if (!ssoSource.includes(`https://${expectedPlatformHost}`)) {
  throw new Error(
    'DOMAIN_ROUTING_GUARD_FAILED: SSO callback is not anchored on admin',
  );
}

if (ssoSource.includes(`https://${forbiddenEduHost}`)) {
  throw new Error(
    'DOMAIN_ROUTING_GUARD_FAILED: SSO callback still references marketing host',
  );
}

process.stdout.write(
  `DOMAIN_ROUTING_GUARD=PASS platform=${expectedPlatformHost} forbidden=${forbiddenEduHost}\n`,
);
