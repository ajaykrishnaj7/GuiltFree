import { NextResponse } from 'next/server';
import { AIProvider, AISettings, DEFAULT_AI_SETTINGS, PROVIDER_MODELS } from '@/lib/aiSettings';
import { encryptJson, decryptJson } from '@/lib/aiKeyVault';
import { createSupabaseServerAdminClient, getAuthenticatedUser } from '@/lib/supabaseServer';

const sanitizeApiKeys = (apiKeys: unknown): Partial<Record<AIProvider, string>> => {
  const providers = Object.keys(PROVIDER_MODELS) as AIProvider[];
  const obj = (apiKeys && typeof apiKeys === 'object') ? apiKeys as Record<string, unknown> : {};
  const out: Partial<Record<AIProvider, string>> = {};
  for (const provider of providers) {
    const value = obj[provider];
    out[provider] = typeof value === 'string' ? value : '';
  }
  return out;
};

const normalizeSettings = (input: Partial<AISettings>): AISettings => {
  const provider = input.provider && PROVIDER_MODELS[input.provider]
    ? input.provider
    : DEFAULT_AI_SETTINGS.provider;
  const model = input.model && PROVIDER_MODELS[provider].includes(input.model)
    ? input.model
    : PROVIDER_MODELS[provider][0];
  const apiKeys = sanitizeApiKeys(input.apiKeys);
  const apiKey = (apiKeys[provider] || input.apiKey || '').toString();

  return {
    useUserKey: Boolean(input.useUserKey),
    provider,
    model,
    apiKey,
    apiKeys,
  };
};

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const admin = createSupabaseServerAdminClient();
    const { data, error } = await admin
      .from('user_ai_settings')
      .select('use_user_key, primary_provider, primary_model, encrypted_payload')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) {
      return NextResponse.json({ settings: DEFAULT_AI_SETTINGS });
    }

    const decrypted = decryptJson<{ apiKeys?: Partial<Record<AIProvider, string>> }>(data.encrypted_payload || '{}');
    const settings = normalizeSettings({
      useUserKey: data.use_user_key,
      provider: data.primary_provider as AIProvider,
      model: data.primary_model,
      apiKeys: decrypted.apiKeys || {},
      apiKey: decrypted.apiKeys?.[data.primary_provider as AIProvider] || '',
    });

    return NextResponse.json({ settings });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.toLowerCase().includes('auth') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const { settings } = await request.json() as { settings?: Partial<AISettings> };
    if (!settings) {
      return NextResponse.json({ error: 'Settings are required' }, { status: 400 });
    }

    const normalized = normalizeSettings(settings);
    const admin = createSupabaseServerAdminClient();
    const { data: existingRow, error: existingError } = await admin
      .from('user_ai_settings')
      .select('encrypted_payload')
      .eq('user_id', user.id)
      .single();
    if (existingError && existingError.code !== 'PGRST116') throw existingError;

    const existingApiKeys = existingRow?.encrypted_payload
      ? decryptJson<{ apiKeys?: Partial<Record<AIProvider, string>> }>(existingRow.encrypted_payload || '{}').apiKeys || {}
      : {};

    const providers = Object.keys(PROVIDER_MODELS) as AIProvider[];
    const mergedApiKeys = providers.reduce<Partial<Record<AIProvider, string>>>((acc, provider) => {
      const incoming = (normalized.apiKeys?.[provider] || '').trim();
      const existing = (existingApiKeys?.[provider] || '').trim();
      acc[provider] = incoming || existing || '';
      return acc;
    }, {});

    const primaryIncoming = (normalized.apiKey || '').trim();
    if (primaryIncoming) {
      mergedApiKeys[normalized.provider] = primaryIncoming;
    }

    const encryptedPayload = encryptJson({
      apiKeys: sanitizeApiKeys(mergedApiKeys),
    });

    const { error } = await admin
      .from('user_ai_settings')
      .upsert({
        user_id: user.id,
        use_user_key: normalized.useUserKey,
        primary_provider: normalized.provider,
        primary_model: normalized.model,
        encrypted_payload: encryptedPayload,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw error;
    const persisted = normalizeSettings({
      ...normalized,
      apiKeys: mergedApiKeys,
      apiKey: mergedApiKeys[normalized.provider] || '',
    });
    return NextResponse.json({ settings: persisted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.toLowerCase().includes('auth') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
