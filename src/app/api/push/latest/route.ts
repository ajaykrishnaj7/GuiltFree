import { NextResponse } from 'next/server';
import { createSupabaseServerAdminClient } from '@/lib/supabaseServer';

export async function POST(request: Request) {
  try {
    const { endpoint } = await request.json() as { endpoint?: string };
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
    }

    const admin = createSupabaseServerAdminClient();

    const { data: subscription, error: subError } = await admin
      .from('push_subscriptions')
      .select('user_id')
      .eq('endpoint', endpoint)
      .single();
    if (subError || !subscription) {
      return NextResponse.json({ title: 'Daily nutrition update', message: 'Open the app for today\'s insight.' });
    }

    const today = new Date().toLocaleDateString('en-CA');
    const { data: suggestion } = await admin
      .from('daily_goal_suggestions')
      .select('title, message')
      .eq('user_id', subscription.user_id)
      .eq('day', today)
      .single();

    return NextResponse.json({
      title: suggestion?.title || 'Daily nutrition update',
      message: suggestion?.message || 'Open the app for today\'s insight.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

