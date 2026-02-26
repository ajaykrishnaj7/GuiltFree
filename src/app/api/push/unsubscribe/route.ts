import { NextResponse } from 'next/server';
import { createSupabaseServerAdminClient, getAuthenticatedUser } from '@/lib/supabaseServer';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const { endpoint } = await request.json() as { endpoint?: string };
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
    }

    const admin = createSupabaseServerAdminClient();
    const { error } = await admin
      .from('push_subscriptions')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.toLowerCase().includes('auth') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

