import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

function isPlaceholderSupabaseValue(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? '';

  return (
    normalized === '' ||
    normalized.includes('example.supabase.co') ||
    normalized.includes('seu-projeto') ||
    normalized.includes('sua_chave') ||
    normalized.includes('placeholder') ||
    normalized.includes('ci-only') ||
    normalized.includes('ci_only') ||
    normalized.includes('validation-only') ||
    normalized.includes('validation_only') ||
    normalized.includes('dummy-key')
  );
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isCi = process.env.CI === 'true';

  if (
    command === 'build' &&
    (!env.VITE_SUPABASE_URL ||
      !env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      (!isCi &&
        (isPlaceholderSupabaseValue(env.VITE_SUPABASE_URL) ||
          isPlaceholderSupabaseValue(env.VITE_SUPABASE_PUBLISHABLE_KEY))))
  ) {
    throw new Error(
      'Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY reais antes do build de produção.',
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
  };
});
