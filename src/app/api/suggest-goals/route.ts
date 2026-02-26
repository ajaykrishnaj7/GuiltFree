import { NextResponse } from 'next/server';
import { generateJsonText, RequestAIConfig } from '@/lib/aiClient';
import { createSupabaseServerAdminClient, getAuthenticatedUser } from '@/lib/supabaseServer';

interface GoalSuggestProfile {
  age?: string;
  heightCm?: string;
  weightKg?: string;
  country?: string;
  sex?: string;
  activityLevel?: string;
  goalIntent?: string;
  mealsPerDay?: string;
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    const { profile, aiConfig } = await req.json() as { profile?: GoalSuggestProfile; aiConfig?: RequestAIConfig };
    if (!profile) {
      return NextResponse.json({ error: 'Profile details are required' }, { status: 400 });
    }

    const admin = createSupabaseServerAdminClient();
    const today = new Date().toLocaleDateString('en-CA');

    const { data: usageRow, error: usageReadError } = await admin
      .from('goal_suggestion_usage')
      .select('request_count')
      .eq('user_id', user.id)
      .eq('day', today)
      .single();

    if (usageReadError && usageReadError.code !== 'PGRST116') {
      throw usageReadError;
    }

    const used = usageRow?.request_count || 0;
    if (used >= 5) {
      return NextResponse.json({
        error: 'Daily limit reached',
        remaining: 0,
      }, { status: 429 });
    }

    const nextCount = used + 1;
    const { error: usageWriteError } = await admin
      .from('goal_suggestion_usage')
      .upsert({
        user_id: user.id,
        day: today,
        request_count: nextCount,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,day' });
    if (usageWriteError) throw usageWriteError;

    const prompt = `
      Suggest realistic daily nutrition goals for this user profile.
      Return ONLY a JSON object:
      {
        "daily_calorie_goal": number,
        "daily_protein_goal_g": number,
        "daily_carbs_goal_g": number,
        "daily_fats_goal_g": number,
        "daily_fiber_goal_g": number,
        "daily_sugars_total_goal_g": number
      }

      Constraints:
      - calories between 1200 and 4500
      - protein between 40 and 300
      - carbs between 50 and 500
      - fats between 20 and 180
      - fiber between 15 and 70
      - sugars between 15 and 120

      User profile:
      ${JSON.stringify(profile)}
    `;

    const raw = await generateJsonText(prompt, aiConfig);
    const parsed = JSON.parse(raw);

    return NextResponse.json({
      daily_calorie_goal: Math.round(Number(parsed.daily_calorie_goal) || 2000),
      daily_protein_goal_g: Math.round(Number(parsed.daily_protein_goal_g) || 150),
      daily_carbs_goal_g: Math.round(Number(parsed.daily_carbs_goal_g) || 225),
      daily_fats_goal_g: Math.round(Number(parsed.daily_fats_goal_g) || 65),
      daily_fiber_goal_g: Math.round(Number(parsed.daily_fiber_goal_g) || 30),
      daily_sugars_total_goal_g: Math.round(Number(parsed.daily_sugars_total_goal_g) || 50),
      remaining: Math.max(0, 5 - nextCount),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.toLowerCase().includes('auth token') || message.toLowerCase().includes('invalid auth')
      ? 401
      : 500;
    return NextResponse.json({
      error: 'Failed to suggest goals',
      details: message,
    }, { status });
  }
}
