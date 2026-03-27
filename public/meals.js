// AI-powered meal generation via server proxy (API key in .env)

async function generateMealIdeas(pantryItems, options = {}) {
  const {
    mealType = 'all',
    dietaryPrefs = [],
    allowMissing = 2,
    count = 5,
    excludeMeals = [],
    dietaryProfile = { restrictions: [], customRestrictions: [], goals: {} }
  } = options;

  const mealTypeInstruction = mealType === 'all'
    ? 'Generate a mix of breakfast, lunch, dinner, dessert, snack, and drink ideas.'
    : `Generate ${mealType} ideas only.${mealType === 'drink' ? ' Include a variety like lattes, smoothies, protein shakes, mocktails, and cocktails.' : ''}`;

  const dietaryInstruction = dietaryPrefs.length > 0
    ? `Dietary preferences for this request: ${dietaryPrefs.join(', ')}. Prioritize meals that fit these.`
    : '';

  const excludeInstruction = excludeMeals.length > 0
    ? `Do NOT suggest these meals (already suggested): ${excludeMeals.join(', ')}`
    : '';

  // Dietary profile restrictions
  const allRestrictions = [...(dietaryProfile.restrictions || []), ...(dietaryProfile.customRestrictions || [])];
  const restrictionInstruction = allRestrictions.length > 0
    ? `STRICT DIETARY RESTRICTIONS (must always be followed): ${allRestrictions.join(', ')}. Never include ingredients that violate these.`
    : '';

  // Macro goals
  const goals = dietaryProfile.goals || {};
  const goalInstruction = (goals.calories || goals.protein || goals.carbs || goals.fat)
    ? `Target macros per serving: ${goals.calories ? goals.calories + ' cal' : ''}${goals.protein ? ', ' + goals.protein + 'g protein' : ''}${goals.carbs ? ', ' + goals.carbs + 'g carbs' : ''}${goals.fat ? ', ' + goals.fat + 'g fat' : ''}. Try to get close to these targets.`
    : '';

  const prompt = `You are a creative home chef meal planner. Based on the pantry items below, suggest exactly ${count} meal ideas with FULL recipes.

PANTRY ITEMS:
${pantryItems.join('\n')}

RULES:
- ${mealTypeInstruction}
- Each meal should use as many pantry items as possible
- It's OK if a meal needs up to ${allowMissing} ingredients NOT in the pantry — clearly mark those as "missing"
- ${dietaryInstruction}
- ${restrictionInstruction}
- ${goalInstruction}
- ${excludeInstruction}
- Be creative and varied — different cuisines, cooking methods, flavors
- Provide EXACT quantities for every ingredient (e.g. "2 tbsp soy sauce", "1 cup rice", "2 eggs")
- Provide clear numbered step-by-step cooking instructions
- Calculate macros ACCURATELY based on the actual ingredient quantities in the recipe. Use real nutritional data (e.g. 1 egg = 6g protein/78 cal, 100g chicken breast = 31g protein/165 cal, 1 cup rice = 4g protein/206 cal). Do not estimate loosely — sum up each ingredient's contribution.
- When "high-protein" is requested, aim for a 10:1 calorie-to-protein ratio (e.g. 500 cal meal should have ~50g protein). Prioritize protein-dense ingredients like eggs, chicken, steak, protein powder, greek yogurt, etc.
- Specify how many servings the recipe makes

Respond ONLY with valid JSON in this exact format (no markdown, no backticks, no explanation):
[
  {
    "name": "Meal Name",
    "type": "breakfast|lunch|dinner|snack|dessert|drink",
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
