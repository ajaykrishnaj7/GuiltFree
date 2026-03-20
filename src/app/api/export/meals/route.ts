import { NextResponse } from 'next/server';
import { createSupabaseServerAdminClient, getAuthenticatedUser } from '@/lib/supabaseServer';

type ExportRange = 'week' | 'month' | 'all' | 'custom';

const escapeCsv = (value: unknown) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const startOfDayIso = (date: string) => new Date(`${date}T00:00:00.000Z`).toISOString();
const endOfDayIso = (date: string) => new Date(`${date}T23:59:59.999Z`).toISOString();

const formatLocalDateTime = (iso: string, timeZone: string) => {
  const date = new Date(iso);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });
  const parts = formatter.formatToParts(date);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${pick('month')}/${pick('day')}/${pick('year')} ${pick('hour')}:${pick('minute')} ${pick('timeZoneName')}`.trim();
};

const resolveRange = (
  range: ExportRange,
  customFrom?: string | null,
  customTo?: string | null
): { fromIso: string | null; toIso: string | null; label: string } => {
  const now = new Date();
  const today = isoDate(now);

  if (range === 'all') {
    return { fromIso: null, toIso: null, label: 'all-time' };
  }

  if (range === 'week') {
    const start = new Date(now);
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    const startDate = isoDate(start);
    return { fromIso: startOfDayIso(startDate), toIso: endOfDayIso(today), label: 'this-week' };
  }

  if (range === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = isoDate(start);
    return { fromIso: startOfDayIso(startDate), toIso: endOfDayIso(today), label: 'this-month' };
  }

  if (!customFrom || !customTo) {
    throw new Error('Custom range requires from and to dates');
  }

  const minDate = new Date(now);
  minDate.setDate(minDate.getDate() - 180);
  const minDateStr = isoDate(minDate);
  if (customFrom < minDateStr) {
    throw new Error('Custom from-date cannot be older than 180 days');
  }
  if (customTo > today) {
    throw new Error('Custom to-date cannot be in the future');
  }
  if (customTo < customFrom) {
    throw new Error('Custom to-date cannot be before from-date');
  }

  return {
    fromIso: startOfDayIso(customFrom),
    toIso: endOfDayIso(customTo),
    label: `${customFrom}_to_${customTo}`,
  };
};

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const admin = createSupabaseServerAdminClient();
    const { searchParams } = new URL(request.url);
    const rawRange = (searchParams.get('range') || 'month').toLowerCase();
    const requestedTz = searchParams.get('tz') || 'UTC';
    const timeZone = requestedTz.trim() || 'UTC';
    const range: ExportRange = ['week', 'month', 'all', 'custom'].includes(rawRange)
      ? (rawRange as ExportRange)
      : 'month';
    const customFrom = searchParams.get('from');
    const customTo = searchParams.get('to');
    const { fromIso, toIso, label } = resolveRange(range, customFrom, customTo);

    let mealQuery = admin
      .from('meals')
      .select('id,created_at,name,type,description,total_calories,total_protein,total_fiber,total_carbs,total_fats,total_sugars_total')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (fromIso) mealQuery = mealQuery.gte('created_at', fromIso);
    if (toIso) mealQuery = mealQuery.lte('created_at', toIso);

    const { data: meals, error: mealsError } = await mealQuery;
    if (mealsError) throw mealsError;

    const mealIds = (meals || []).map((meal) => meal.id);
    let mealItems: any[] = [];
    if (mealIds.length > 0) {
      const { data: items, error: itemsError } = await admin
        .from('meal_items')
        .select('meal_id,name,display_name,quantity,unit,calories,protein,fiber,carbs,fats_total,sugars_total,rationale')
        .in('meal_id', mealIds);
      if (itemsError) throw itemsError;
      mealItems = items || [];
    }

    const itemsByMeal = mealItems.reduce<Record<string, any[]>>((acc, row) => {
      if (!acc[row.meal_id]) acc[row.meal_id] = [];
      acc[row.meal_id].push(row);
      return acc;
    }, {});

    const header = [
      'meal_created_at',
      'meal_name',
      'meal_type',
      'meal_description',
      'meal_total_calories',
      'meal_total_protein_g',
      'meal_total_fiber_g',
      'meal_total_carbs_g',
      'meal_total_fats_g',
      'meal_total_sugars_g',
      'item_name',
      'item_quantity',
      'item_unit',
      'item_calories',
      'item_protein_g',
      'item_fiber_g',
      'item_carbs_g',
      'item_fats_g',
      'item_sugars_g',
      'item_rationale',
    ];

    const rows: string[] = [header.join(',')];
    for (const meal of meals || []) {
      const items = itemsByMeal[meal.id] || [];
      if (items.length === 0) {
        rows.push([
          formatLocalDateTime(meal.created_at, timeZone),
          meal.name || '',
          meal.type || '',
          meal.description || '',
          meal.total_calories ?? 0,
          meal.total_protein ?? 0,
          meal.total_fiber ?? 0,
          meal.total_carbs ?? 0,
          meal.total_fats ?? 0,
          meal.total_sugars_total ?? 0,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ].map(escapeCsv).join(','));
        continue;
      }

      for (const item of items) {
        rows.push([
          formatLocalDateTime(meal.created_at, timeZone),
          meal.name || '',
          meal.type || '',
          meal.description || '',
          meal.total_calories ?? 0,
          meal.total_protein ?? 0,
          meal.total_fiber ?? 0,
          meal.total_carbs ?? 0,
          meal.total_fats ?? 0,
          meal.total_sugars_total ?? 0,
          item.name || '',
          item.quantity ?? 0,
          item.unit || '',
          item.calories ?? 0,
          item.protein ?? 0,
          item.fiber ?? 0,
          item.carbs ?? 0,
          item.fats_total ?? 0,
          item.sugars_total ?? 0,
          item.rationale || '',
        ].map(escapeCsv).join(','));
      }
    }

    const csv = rows.join('\n');
    const filename = `guiltfree_meals_${label}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to export meals';
    const lower = message.toLowerCase();
    const status = lower.includes('auth') || lower.includes('token') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
