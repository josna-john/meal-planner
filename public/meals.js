// AI-powered meal generation via server proxy (API key stored in .env)

async function generateMealIdeas(pantryItems, options = {}) {
  const {
    mealType = 'all',
    dietaryPrefs = [],
    allowMissing = 2,
    count = 5,
    excludeMeals = []
  } = options;

  const mealTypeInstruction = mealType === 'all'
    ? 'Generate a mix of breakfast, lunch, dinner, dessert, and snack ideas.'
    : `Generate ${mealType} ideas only.`;

  const dietaryInstruction = dietaryPrefs.length > 0
    ? `Dietary preferences: ${dietaryPrefs.join(', ')}. Prioritize meals that fit these preferences.`
    : '';

  const excludeInstruction = excludeMeals.length > 0
    ? `Do NOT suggest these meals (already suggested): ${excludeMeals.join(', ')}`
    : '';

  const prompt = `You are a creative home chef meal planner. Based on the pantry items below, suggest exactly ${count} meal ideas with FULL recipes.

PANTRY ITEMS:
${pantryItems.join('\n')}

RULES:
- ${mealTypeInstruction}
- Each meal should use as many pantry items as possible
- It's OK if a meal needs up to ${allowMissing} ingredients NOT in the pantry — clearly mark those as "missing"
- ${dietaryInstruction}
- ${excludeInstruction}
- Be creative and varied — different cuisines, cooking methods, flavors
- Provide EXACT quantities for every ingredient (e.g. "2 tbsp soy sauce", "1 cup rice", "2 eggs")
- Provide clear numbered step-by-step cooking instructions
- Estimate realistic macros per serving
- Specify how many servings the recipe makes

Respond ONLY with valid JSON in this exact format (no markdown, no backticks, no explanation):
[
  {
    "name": "Meal Name",
    "type": "breakfast|lunch|dinner|snack|dessert",
    "servings": 2,
    "prepTime": "10 min",
    "cookTime": "15 min",
    "ingredients": [
      { "item": "ingredient name", "quantity": "1 cup", "fromPantry": true },
      { "item": "missing item", "quantity": "1 tbsp", "fromPantry": false }
    ],
    "steps": [
      "Step 1 instruction here.",
      "Step 2 instruction here.",
      "Step 3 instruction here."
    ],
    "tags": ["high-protein", "quick", "etc"],
    "macros": {
      "calories": 450,
      "protein": 35,
      "carbs": 40,
      "fat": 15
    }
  }
]`;

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('INVALID_API_KEY');
    if (response.status === 500 && err.error?.includes('.env')) throw new Error(err.error);
    throw new Error(err.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0].text.trim();

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse meal ideas from AI response');
  }
}
