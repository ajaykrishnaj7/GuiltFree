import { NextResponse } from 'next/server';
import { createSupabaseServerAdminClient, getAuthenticatedUser } from '@/lib/supabaseServer';
import { generateJsonText, RequestAIConfig } from '@/lib/aiClient';
import { sendVapidPush } from '@/lib/webPush';

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const buildPushFallback = (goalFocus: string) => ({
  title: 'Daily nutrition check-in',
  message: `Review today's intake against your ${goalFocus.replace(/_/g, ' ')} focus and make one meal-level adjustment for tomorrow.`,
  goal_impact: `A small consistent adjustment each day compounds progress for ${goalFocus.replace(/_/g, ' ')}.`,
  action_plan: [
    'Prioritize protein in your first meal.',
    'Add one high-fiber food to lunch or dinner.',
    'Pre-log one planned meal for tomorrow.',
  ],
  foods_to_add: ['Lean protein', 'Vegetables', 'Whole grains'],
  foods_to_limit: ['Untracked snacks', 'Sugary drinks'],
});

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const { aiConfig } = await request.json() as { aiConfig?: RequestAIConfig };
    const admin = createSupabaseServerAdminClient();

    const now = new Date();
    const today = now.toLocaleDateString('en-CA');
    const start = new Date(`${today}T00:00:00.000`);
    const end = new Date(`${today}T23:59:59.999`);

    const [{ data: meals }, { data: profile }] = await Promise.all([
      admin
        .from('meals')
        .select('total_calories,total_protein,total_carbs,total_fats,total_fiber,total_sugars_total')
        .eq('user_id', user.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString()),
      admin
        .from('profiles')
        .select('daily_calorie_goal,daily_protein_goal_g,daily_carbs_goal_g,daily_fats_goal_g,daily_fiber_goal_g,daily_sugars_total_goal_g,goal_focus')
        .eq('id', user.id)
        .single(),
    ]);

    const totals = (meals || []).reduce((acc, meal) => ({
      calories: acc.calories + toNumber(meal.total_calories),
      protein: acc.protein + toNumber(meal.total_protein),
      carbs: acc.carbs + toNumber(meal.total_carbs),
      fats: acc.fats + toNumber(meal.total_fats),
      fiber: acc.fiber + toNumber(meal.total_fiber),
      sugars: acc.sugars + toNumber(meal.total_sugars_total),
    }), { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sugars: 0 });

    const goalFocus = String(profile?.goal_focus || 'maintain_weight');

    const goals = {
      calories: toNumber(profile?.daily_calorie_goal, 2000),
      protein: toNumber(profile?.daily_protein_goal_g, 150),
      carbs: toNumber(profile?.daily_carbs_goal_g, 225),
      fats: toNumber(profile?.daily_fats_goal_g, 65),
      fiber: toNumber(profile?.daily_fiber_goal_g, 30),
      sugars: toNumber(profile?.daily_sugars_total_goal_g, 50),
    };

    const prompt = `
      You are a nutrition coach. Give a personalized, practical end-of-day suggestion aligned to this goal focus: ${goalFocus}.
      Return ONLY JSON:
      {
        "title": "string",
        "message": "string",
        "goal_impact": "string",
        "action_plan": ["string","string","string"],
        "foods_to_add": ["string","string","string"],
        "foods_to_limit": ["string","string","string"]
      }
      Max 20 words for title and 100 words for message.
      Date: ${today}
      Totals: ${JSON.stringify(totals)}
      Goals: ${JSON.stringify(goals)}
    `;

    let suggestion;
    try {
      const aiRaw = await generateJsonText(prompt, aiConfig);
      const aiSuggestion = JSON.parse(aiRaw) as {
        title?: string;
        message?: string;
        goal_impact?: string;
        action_plan?: unknown[];
        foods_to_add?: unknown[];
        foods_to_limit?: unknown[];
      };
      suggestion = {
        title: String(aiSuggestion.title || 'Daily nutrition check-in'),
        message: String(aiSuggestion.message || 'Review today and adjust tomorrow to match your macro targets.'),
        goal_impact: String(aiSuggestion.goal_impact || `Today's pattern influences your ${goalFocus.replace(/_/g, ' ')} progress.`),
        action_plan: Array.isArray(aiSuggestion.action_plan) ? aiSuggestion.action_plan.map((v) => String(v)).slice(0, 3) : [],
        foods_to_add: Array.isArray(aiSuggestion.foods_to_add) ? aiSuggestion.foods_to_add.map((v) => String(v)).slice(0, 5) : [],
        foods_to_limit: Array.isArray(aiSuggestion.foods_to_limit) ? aiSuggestion.foods_to_limit.map((v) => String(v)).slice(0, 5) : [],
      };
    } catch {
      suggestion = buildPushFallback(goalFocus);
    }

    const { error: upsertError } = await admin
      .from('daily_goal_suggestions')
      .upsert({
        user_id: user.id,
        day: today,
        title: suggestion.title,
        message: suggestion.message,
        updated_at: now.toISOString(),
      }, { onConflict: 'user_id,day' });
    if (upsertError) throw upsertError;

    const { data: subscriptions } = await admin
      .from('push_subscriptions')
      .select('endpoint')
      .eq('user_id', user.id)
      .eq('enabled', true);

    const invalidEndpoints: string[] = [];
    for (const sub of subscriptions || []) {
      try {
        const res = await sendVapidPush(sub.endpoint);
        if (res.status === 404 || res.status === 410) {
          invalidEndpoints.push(sub.endpoint);
        }
      } catch {
        // keep non-fatal push errors isolated per subscription
      }
    }

    if (invalidEndpoints.length > 0) {
      await admin
        .from('push_subscriptions')
        .update({ enabled: false, updated_at: now.toISOString() })
        .in('endpoint', invalidEndpoints);
    }

    return NextResponse.json({
      ...suggestion,
      sent: (subscriptions || []).length - invalidEndpoints.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.toLowerCase().includes('auth') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
