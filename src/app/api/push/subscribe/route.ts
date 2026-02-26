import { NextResponse } from 'next/server';
import { createSupabaseServerAdminClient, getAuthenticatedUser } from '@/lib/supabaseServer';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const { subscription } = await request.json() as {
      subscription?: {
        endpoint: string;
        keys?: { p256dh?: string; auth?: string };
      };
    };

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Subscription endpoint is required' }, { status: 400 });
    }

    const admin = createSupabaseServerAdminClient();
    const { error } = await admin
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh || null,
        auth: subscription.keys?.auth || null,
        enabled: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.toLowerCase().includes('auth') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

