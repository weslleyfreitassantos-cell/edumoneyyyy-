import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const SUPABASE_REQUEST_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit = {},
): Promise<Response> {
    const controller = new AbortController();
    const upstreamSignal = init.signal;
    let timedOut = false;
    const timeoutId = globalThis.setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, SUPABASE_REQUEST_TIMEOUT_MS);
    const abortFromCaller = () => controller.abort();

    upstreamSignal?.addEventListener('abort', abortFromCaller, { once: true });

    try {
        return await globalThis.fetch(input, {
            ...init,
            signal: controller.signal,
        });
    } catch (error) {
        if (timedOut) {
            const timeoutError = new Error(
                'A comunicacao com o servidor expirou.',
            );
            timeoutError.name = 'TimeoutError';
            throw timeoutError;
        }
        throw error;
    } finally {
        globalThis.clearTimeout(timeoutId);
        upstreamSignal?.removeEventListener('abort', abortFromCaller);
    }
}

if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
        'As variáveis VITE_SUPABASE_URL e ' +
        'VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórias.',
    );
}

export const supabase = createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
        auth: {
            detectSessionInUrl: false,
        },
        global: {
            fetch: fetchWithTimeout,
        },
    }
);
