# GuiltFree

Log meals like a human, not a data entry clerk. GuiltFree uses AI to turn your '3 slices of pizza and a coke' into precise nutritional data. Total clarity, zero guilt.

## 🚀 Vision
Most calorie trackers feel like a second job. GuiltFree eliminates the friction of searching through databases and weighing food by using LLMs to infer nutritional value from natural language cues.

## 🚀 Roadmap

- [x] **V1.0: Core AI Logging**
  - Natural Language Parsing (Gemini 1.5 Flash)
  - Detailed Nutritional Breakdown (Calories, Macros, Sugars, Fiber)
  - Supabase Persistence & Authentication
  - Basic Diary Timeline & Progress Bars

- [ ] **V1.1: The Kitchen & Insights**
  - **The Kitchen**: Save custom foods and links to a personal nutrition bucket.
  - **URL Scraper**: Automatically extract nutrition facts from food/recipe links.
  - **Deep Diary**: Clickable logs to view full ingredient breakdowns.
  - **Goal Customization**: Optional Fiber and Sugar targets.
  - **Activity Hub**: Dedicated `/diary` page for historical data.

- [ ] **V1.2: Proactive Health (Future)**
  - **AI Health Coach**: Personalized tips based on your eating habits.
  - **Smart Streaks**: Gamification for hitting nutritional goals.
  - **Intermittent Fasting**: Integrated fasting timer and window tracking.
  - **Grocery Lists**: Generate shopping lists from your recent meal trends.
# GuiltFree

Log meals like a human, not a data entry clerk. GuiltFree uses AI to turn your '3 slices of pizza and a coke' into precise nutritional data. Total clarity, zero guilt.

## 🚀 Vision
Most calorie trackers feel like a second job. GuiltFree eliminates the friction of searching through databases and weighing food by using LLMs to infer nutritional value from natural language cues.

## 🛠 Features (Detailed)

### 1. Magic Input Bar
- **Natural Language Parsing**: Just type what you ate. AI handles the rest.
- **Ambiguity Handling**: If you say "Sandwich", the AI makes an educated guess based on common types or asks for clarification.
- **Batch Entry**: Input multiple items at once (e.g., "Breakfast was 2 eggs, toast, and coffee").

### 2. Smart Diary
- **Visual Log**: A clean, chronological timeline of your meals.
- **Nutritional Breakdown**: Real-time totals for Calories, Protein, Carbs, and Fats.
- **Historical Insights**: 180-day history with scrollable views and basic trend charts.

### 3. Personal Dashboard
- **Goal Tracking**: Set daily calorie and macronutrient targets.
- **Progress Visualization**: Progress bars that fill up as you log.
- **Quick Actions**: "Re-log" frequent meals with one tap.

### 4. PWA Experience
- **Offline Mode**: View history even without a connection.
- **Native Feel**: Install as an app on iOS/Android for instant access.

## 📐 Architecture & Flow

### System Architecture
```mermaid
graph TD
    User((User)) -->|Logs Meal| Frontend[Next.js PWA]
    Frontend -->|POST /api/parse| API[Next.js Edge API]
    API -->|Prompt| Gemini[Gemini 1.5 Flash LLM]
    Gemini -->|Structured JSON| API
    API -->|Store Log| DB[(Supabase / Postgres)]
    DB -->|History Data| Frontend
    Frontend -->|Cache| SW[Service Worker / LocalStorage]
```

### User Flow
```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as AI Agent (Gemini)
    participant D as Database

    U->>F: Types "2 cheeseburgers"
    F->>A: Parse nutritional data
    A-->>F: Returns JSON (Calories: 600, etc.)
    F->>U: Displays "Found: 2 Cheeseburgers (600cal). Save?"
    U->>F: Clicks Save
    F->>D: Persist entry
    F->>U: Update Daily Progress Bar
```

## 🏗 Tech Stack
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, Lucide Icons.
- **AI**: Gemini 1.5 Flash (via Google AI SDK).
- **Backend / DB**: Supabase (Auth, Postgres).
- **Deployment**: Vercel.

## ⚙️ Setup Notes (New)

### 1. Server-enforced AI goal suggestion limit (5/day)
- Run the updated SQL in `supabase-schema.sql` to create:
  - `goal_suggestion_usage`
- This is now enforced on the backend route (`/api/suggest-goals`) per authenticated user and per day.

### 2. Background push notifications (PWA)
- Run the updated SQL in `supabase-schema.sql` to create:
  - `push_subscriptions`
  - `daily_goal_suggestions`
- Add environment variables:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT` (example: `mailto:you@yourdomain.com`)

### 3. VAPID key generation example
Generate once and store securely:

```bash
openssl ecparam -name prime256v1 -genkey -noout -out vapid_private.pem
openssl ec -in vapid_private.pem -pubout -out vapid_public.pem
```

Then convert keys to URL-safe base64 format expected by app env vars.
