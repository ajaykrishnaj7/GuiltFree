-- Create a table for public user profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  dob DATE,
  weight FLOAT,
  height FLOAT,
  sex TEXT,
  goal_focus TEXT DEFAULT 'maintain_weight',
  weight_unit TEXT DEFAULT 'g', -- 'g' or 'oz'
  energy_unit TEXT DEFAULT 'kcal', -- 'kcal' or 'kj'
  daily_calorie_goal INTEGER DEFAULT 2000,
  daily_protein_goal_g FLOAT,
  daily_carbs_goal_g FLOAT,
  daily_fats_goal_g FLOAT,
  daily_fats_saturated_goal_g FLOAT,
  daily_fats_unsaturated_goal_g FLOAT,
  daily_fiber_goal_g FLOAT,
  daily_sugars_total_goal_g FLOAT,
  daily_sugars_natural_goal_g FLOAT,
  daily_sugars_added_goal_g FLOAT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Trigger to create profile automatically on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create meals table (parent)
CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  total_calories INTEGER DEFAULT 0,
  total_protein FLOAT DEFAULT 0,
  total_carbs FLOAT DEFAULT 0,
  total_fats FLOAT DEFAULT 0,
  total_fats_saturated FLOAT DEFAULT 0,
  total_fats_unsaturated FLOAT DEFAULT 0,
  total_fiber FLOAT DEFAULT 0,
  total_sugars_total FLOAT DEFAULT 0,
  total_sugars_natural FLOAT DEFAULT 0,
  total_sugars_added FLOAT DEFAULT 0,
  raw_input TEXT,
  name TEXT,
  type TEXT
);

-- Create meal_items table (individual items)
CREATE TABLE meal_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT,
  quantity FLOAT,
  unit TEXT,
  rationale TEXT,
  calories INTEGER,
  protein FLOAT,
  carbs FLOAT,
  fats_total FLOAT,
  fats_saturated FLOAT,
  fats_unsaturated FLOAT,
  fiber FLOAT,
  sugars_total FLOAT,
  sugars_natural FLOAT,
  sugars_added FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_items ENABLE ROW LEVEL SECURITY;

-- MEALS: Users can only see/edit their own data
CREATE POLICY "Users can manage their own meals" 
  ON meals FOR ALL 
  USING (auth.uid() = user_id);

-- MEAL_ITEMS: Users can only see/edit items linked to their own meals
CREATE POLICY "Users can manage their own meal items" 
  ON meal_items FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM meals 
      WHERE meals.id = meal_items.meal_id 
      AND meals.user_id = auth.uid()
    )
  );

-- Function to update meal totals (Optional, but useful for performance)
-- You can also just calculate these on the fly or in the application code.
-- KITCHEN ITEMS TABLE (Personal Food Bucket)
CREATE TABLE kitchen_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_url TEXT,
  calories INTEGER DEFAULT 0,
  protein FLOAT DEFAULT 0,
  carbs FLOAT DEFAULT 0,
  fats_total FLOAT DEFAULT 0,
  fiber FLOAT DEFAULT 0,
  sugars_total FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE kitchen_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own kitchen items" ON kitchen_items
  FOR ALL USING (auth.uid() = user_id);

-- =========================
-- FEATURE: AI GOAL LIMITS
-- =========================
CREATE TABLE goal_suggestion_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE goal_suggestion_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goal suggestion usage"
  ON goal_suggestion_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own goal suggestion usage"
  ON goal_suggestion_usage FOR ALL
  USING (auth.uid() = user_id);

-- =========================
-- FEATURE: WEB PUSH
-- =========================
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT,
  auth TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX push_subscriptions_user_id_idx ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);

CREATE TABLE daily_goal_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, day)
);

CREATE INDEX daily_goal_suggestions_user_id_day_idx ON daily_goal_suggestions (user_id, day);

ALTER TABLE daily_goal_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily goal suggestions"
  ON daily_goal_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own daily goal suggestions"
  ON daily_goal_suggestions FOR ALL
  USING (auth.uid() = user_id);

-- =========================
-- FEATURE: ENCRYPTED USER AI SETTINGS
-- =========================
CREATE TABLE user_ai_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  use_user_key BOOLEAN NOT NULL DEFAULT false,
  primary_provider TEXT NOT NULL DEFAULT 'gemini',
  primary_model TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
  encrypted_payload TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI settings"
  ON user_ai_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own AI settings"
  ON user_ai_settings FOR ALL
  USING (auth.uid() = user_id);
