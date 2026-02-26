import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const createSupabaseServerAnonClient = () =>
  createClient(supabaseUrl, supabaseAnonKey);

export const createSupabaseServerAdminClient = () => {
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server admin operations');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export const getBearerToken = (request: Request) => {
  const header = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
};

export const getAuthenticatedUser = async (request: Request): Promise<User> => {
  const token = getBearerToken(request);
  if (!token) throw new Error('Missing auth token');

  const anonClient = createSupabaseServerAnonClient();
  const { data, error } = await anonClient.auth.getUser(token);
  if (error || !data.user) {
    throw new Error('Invalid auth token');
  }
  return data.user;
};

