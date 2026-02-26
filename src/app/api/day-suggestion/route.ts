import { NextResponse } from 'next/server';
import { generateJsonText, RequestAIConfig } from '@/lib/aiClient';

const toNum = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const extractRetryAfterSeconds = (details: string) => {
  const patterns = [
    /next retry window in ~([0-9]+)s/i,
    /retry(?:\s+in|\s+after)?\s+([0-9]+(?:\.[0-9]+)?)s/i,
    /"retryDelay":"([0-9]+)s"/i,
    /retry-after:\s*([0-9]+(?:\.[0-9]+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = details.match(pattern);
    if (match?.[1]) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0) return Math.ceil(value);
    }
  }
  return null;
};

const buildFallbackSuggestion = (
  totals: Record<string, number>,
  goals: Record<string, number>,
  goalFocus: string
) => {
  const focusLabel = goalFocus.replace(/_/g, ' ');
  const caloriePct = goals.calories > 0 ? (totals.calories / goals.calories) * 100 : 0;
  const macroChecks = [
    { key: 'protein', label: 'protein' },
    { key: 'fiber', label: 'fiber' },
    { key: 'carbs', label: 'carbs' },
    { key: 'fats', label: 'healthy fats' },
  ].map((m) => ({
    label: m.label,
    pct: goals[m.key] > 0 ? (totals[m.key] / goals[m.key]) * 100 : 100,
  })).sort((a, b) => a.pct - b.pct);

  if (caloriePct < 85) {
    return {
      title: 'You were under target today',
      message: `You are likely under-fueling for ${focusLabel}. Add a balanced evening snack and prioritize ${macroChecks[0]?.label || 'protein'} tomorrow.`,
      goal_impact: `Consistent under-eating can slow progress for ${focusLabel}. Closing this gap improves recovery and adherence.`,
      action_plan: [
        `Start breakfast with a protein anchor (eggs, Greek yogurt, or tofu).`,
        `Add one complex-carb source near your most active time.`,
        `Include one produce + one protein snack to avoid late under-eating.`,
      ],
      foods_to_add: ['Greek yogurt', 'Eggs', 'Lentils', 'Oats', 'Berries'],
      foods_to_limit: ['Skipping meals', 'Sugary drinks'],
    };
  }

  if (caloriePct > 115) {
    return {
      title: 'You overshot calories today',
      message: `You exceeded your calorie target for ${focusLabel}. Tomorrow, keep portions slightly smaller and build meals around lean protein and fiber.`,
      goal_impact: `Reducing calorie overshoot improves consistency and helps your ${focusLabel} trend over the week.`,
      action_plan: [
        `Use one smaller plate for your two largest meals.`,
        `Eat protein + vegetables first, then carbs/fats.`,
        `Replace one high-calorie snack with fruit + protein.`,
      ],
      foods_to_add: ['Chicken breast', 'Vegetables', 'High-fiber wraps'],
      foods_to_limit: ['Fried snacks', 'Liquid calories', 'Desserts late night'],
    };
  }

  if (macroChecks[0] && macroChecks[0].pct < 80) {
    return {
      title: `${macroChecks[0].label[0].toUpperCase()}${macroChecks[0].label.slice(1)} needs attention`,
      message: `You hit calories well, but ${macroChecks[0].label} is low versus target. Raise it tomorrow to better support ${focusLabel}.`,
      goal_impact: `${macroChecks[0].label[0].toUpperCase()}${macroChecks[0].label.slice(1)} balance is a key driver for ${focusLabel}.`,
      action_plan: [
        `Add one ${macroChecks[0].label}-focused item to each main meal.`,
        `Pre-plan tomorrow's first two meals before bed.`,
        `Track at least one snack to avoid macro drift.`,
      ],
      foods_to_add: macroChecks[0].label === 'protein'
        ? ['Egg whites', 'Lean fish', 'Chicken', 'Greek yogurt']
        : macroChecks[0].label === 'fiber'
          ? ['Chia seeds', 'Lentils', 'Broccoli', 'Berries']
          : ['Whole grains', 'Avocado', 'Beans', 'Nuts'],
      foods_to_limit: ['Ultra-processed snacks', 'Random grazing'],
    };
  }

  return {
    title: 'Solid day overall',
    message: `You stayed close to your targets and aligned with ${focusLabel}. Repeat this structure tomorrow for consistency.`,
    goal_impact: `Consistency across days is the strongest lever for ${focusLabel}.`,
    action_plan: [
      `Repeat today’s best-performing meal.`,
      `Prepare one backup high-protein option for tomorrow.`,
      `Keep hydration steady through the day.`,
    ],
    foods_to_add: goalFocus.includes('muscle') ? ['Lean protein', 'Rice', 'Potatoes'] : ['Vegetables', 'Lean protein'],
    foods_to_limit: ['Large untracked snacks'],
  };
};

export async function POST(req: Request) {
  let totals: Record<string, number> | undefined;
  let goals: Record<string, number> | undefined;
  let goalFocus = 'maintain_weight';
  try {
    const payload = await req.json() as {
      date?: string;
      totals?: Record<string, number>;
      goals?: Record<string, number>;
      aiConfig?: RequestAIConfig;
      goalContext?: { focus?: string };
    };
    const { date, aiConfig } = payload;
    totals = payload.totals;
    goals = payload.goals;
    goalFocus = payload.goalContext?.focus || 'maintain_weight';

    if (!totals || !goals) {
      return NextResponse.json({ error: 'Daily totals and goals are required' }, { status: 400 });
    }

    const normalizedTotals = {
      calories: toNum(totals.calories),
      protein: toNum(totals.protein),
      carbs: toNum(totals.carbs),
      fats: toNum(totals.fats),
      fiber: toNum(totals.fiber),
      sugars: toNum(totals.sugars),
    };
    const normalizedGoals = {
      calories: Math.max(1, toNum(goals.calories, 2000)),
      protein: Math.max(1, toNum(goals.protein, 150)),
      carbs: Math.max(1, toNum(goals.carbs, 225)),
      fats: Math.max(1, toNum(goals.fats, 65)),
      fiber: Math.max(1, toNum(goals.fiber, 30)),
      sugars: Math.max(1, toNum(goals.sugars, 50)),
    };

    const prompt = `
      You are a highly practical nutrition coach. Give a specific, personalized end-of-day coaching response.
      The user primary goal focus is: ${goalFocus}
      Return ONLY JSON:
      {
        "title": "string",
        "message": "string",
        "goal_impact": "string",
        "action_plan": ["string","string","string"],
        "foods_to_add": ["string","string","string"],
        "foods_to_limit": ["string","string","string"]
      }
      Constraints:
      - title <= 20 words
      - message <= 140 words and must reference the user's goal focus
      - goal_impact <= 60 words and explain how today's pattern affects goal progress
      - action_plan must have 3 concise actions for tomorrow
      - foods_to_add and foods_to_limit should be practical food examples
      Date: ${date || new Date().toISOString().slice(0, 10)}
      Totals: ${JSON.stringify(normalizedTotals)}
      Goals: ${JSON.stringify(normalizedGoals)}
    `;

    const raw = await generateJsonText(prompt, aiConfig);
    const parsed = JSON.parse(raw);

    return NextResponse.json({
      title: String(parsed.title || 'Daily nutrition check-in'),
      message: String(parsed.message || 'Review today and adjust tomorrow to match your macro targets.'),
      goal_impact: String(parsed.goal_impact || `Today's intake pattern affects your ${goalFocus.replace(/_/g, ' ')} progress.`),
      action_plan: Array.isArray(parsed.action_plan) ? parsed.action_plan.map((v: unknown) => String(v)).slice(0, 3) : [],
      foods_to_add: Array.isArray(parsed.foods_to_add) ? parsed.foods_to_add.map((v: unknown) => String(v)).slice(0, 5) : [],
      foods_to_limit: Array.isArray(parsed.foods_to_limit) ? parsed.foods_to_limit.map((v: unknown) => String(v)).slice(0, 5) : [],
      source: 'ai',
    });
  } catch (error: unknown) {
    const fallback = buildFallbackSuggestion(
      {
        calories: toNum(totals?.calories),
        protein: toNum(totals?.protein),
        carbs: toNum(totals?.carbs),
        fats: toNum(totals?.fats),
        fiber: toNum(totals?.fiber),
        sugars: toNum(totals?.sugars),
      },
      {
        calories: Math.max(1, toNum(goals?.calories, 2000)),
        protein: Math.max(1, toNum(goals?.protein, 150)),
        carbs: Math.max(1, toNum(goals?.carbs, 225)),
        fats: Math.max(1, toNum(goals?.fats, 65)),
        fiber: Math.max(1, toNum(goals?.fiber, 30)),
        sugars: Math.max(1, toNum(goals?.sugars, 50)),
      },
      goalFocus
    );

    const details = error instanceof Error ? error.message : 'Unknown error';
    const retryAfterSeconds = extractRetryAfterSeconds(details);
    const nextAvailableAt = retryAfterSeconds
      ? new Date(Date.now() + retryAfterSeconds * 1000).toISOString()
      : null;
    return NextResponse.json({
      ...fallback,
      source: 'fallback',
      details,
      retry_after_seconds: retryAfterSeconds,
      next_available_at: nextAvailableAt,
    });
  }
}
