// ============ State ============
let pantryItems = JSON.parse(localStorage.getItem('pantry') || '[]');
let currentMeals = [];
let excludedMeals = [];
let activeFilters = { mealType: 'all', dietary: [] };
let savedRecipes = JSON.parse(localStorage.getItem('saved_recipes') || '[]');

// ============ DOM ============
const $ = id => document.getElementById(id);
const pages = document.querySelectorAll('.page');
const navBtns = document.querySelectorAll('.nav-btn');

// ============ Navigation ============
function switchPage(pageId) {
  pages.forEach(p => p.classList.remove('active'));
  navBtns.forEach(b => b.classList.remove('active'));
  $(pageId).classList.add('active');
  document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => switchPage(btn.dataset.page));
});

// ============ Pantry Management ============
function savePantry() {
  localStorage.setItem('pantry', JSON.stringify(pantryItems));
  renderPantry();
  updatePantryCount();
}

function addPantryItem(name) {
  name = name.trim();
  if (!name) return;
  if (pantryItems.some(i => i.toLowerCase() === name.toLowerCase())) return;
  pantryItems.push(name);
  savePantry();
}

function removePantryItem(index) {
  pantryItems.splice(index, 1);
  savePantry();
}

function clearPantry() {
  if (confirm('Remove all pantry items?')) {
    pantryItems = [];
    savePantry();
  }
}

function renderPantry() {
  const list = $('pantry-list');
  if (pantryItems.length === 0) {
    list.innerHTML = `
      <div class="pantry-empty">
        <div class="pantry-empty-icon">🛒</div>
        <p>Your pantry is empty.<br>Add items above or load your saved list.</p>
      </div>`;
    return;
  }
  list.innerHTML = pantryItems.map((item, i) => `
    <div class="pantry-item">
      <span>${item}</span>
      <button class="remove-btn" onclick="removePantryItem(${i})">&times;</button>
    </div>
  `).join('');
}

function updatePantryCount() {
  $('pantry-count').textContent = `${pantryItems.length} item${pantryItems.length !== 1 ? 's' : ''} in pantry`;
}

// Add item on enter or button click
$('add-item-input').addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    addPantryItem(e.target.value);
    e.target.value = '';
  }
});
$('add-item-btn').addEventListener('click', () => {
  addPantryItem($('add-item-input').value);
  $('add-item-input').value = '';
});

// Load default pantry from file
$('load-default-btn').addEventListener('click', async () => {
  try {
    const resp = await fetch('pantry_items.txt');
    const text = await resp.text();
    const items = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    pantryItems = items;
    savePantry();
  } catch {
    alert('Could not load pantry_items.txt');
  }
});

$('clear-pantry-btn').addEventListener('click', clearPantry);

// ============ Meal Filters ============
document.querySelectorAll('.filter-chip[data-type]').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip[data-type]').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilters.mealType = chip.dataset.type;
  });
});

document.querySelectorAll('.filter-chip[data-diet]').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('active');
    const diet = chip.dataset.diet;
    if (activeFilters.dietary.includes(diet)) {
      activeFilters.dietary = activeFilters.dietary.filter(d => d !== diet);
    } else {
      activeFilters.dietary.push(diet);
    }
  });
});

// ============ Generate Meals ============
$('generate-btn').addEventListener('click', generateMeals);
$('more-ideas-btn').addEventListener('click', generateMeals);

async function generateMeals() {
  if (pantryItems.length === 0) {
    alert('Add items to your pantry first!');
    switchPage('page-pantry');
    return;
  }

  const btn = $('generate-btn');
  const moreBtn = $('more-ideas-btn');
  btn.disabled = true;
  moreBtn.disabled = true;
  btn.innerHTML = '<span class="loading-dots">Cooking up ideas</span>';
  $('meals-container').innerHTML = `
    <div class="no-meals">
      <div class="no-meals-icon">👨‍🍳</div>
      <p>Generating recipes for you...</p>
    </div>`;

  const allowMissing = parseInt($('missing-tolerance').value);

  try {
    const meals = await generateMealIdeas(pantryItems, {
      mealType: activeFilters.mealType,
      dietaryPrefs: activeFilters.dietary,
      allowMissing,
      count: 5,
      excludeMeals: excludedMeals
    });

    currentMeals = meals;
    excludedMeals.push(...meals.map(m => m.name));
    if (excludedMeals.length > 20) excludedMeals = excludedMeals.slice(-10);

    renderMeals(meals);
  } catch (err) {
    $('meals-container').innerHTML = `
      <div class="no-meals">
        <div class="no-meals-icon">😕</div>
        <p>${err.message}</p>
      </div>`;
  } finally {
    btn.disabled = false;
    moreBtn.disabled = false;
    btn.innerHTML = 'Generate Meal Ideas';
  }
}

// ============ Render Meals ============
function renderMeals(meals) {
  if (!meals || meals.length === 0) {
    $('meals-container').innerHTML = `
      <div class="no-meals">
        <div class="no-meals-icon">🤷</div>
        <p>No meal ideas found. Try adjusting your filters or adding more pantry items.</p>
      </div>`;
    return;
  }

  $('meals-container').innerHTML = meals.map((meal, idx) => {
    const badgeClass = `badge-${meal.type}`;
    const macros = meal.macros || {};
    const ingredients = meal.ingredients || [];
    const pantryIngredients = ingredients.filter(i => i.fromPantry);
    const missingIngredients = ingredients.filter(i => !i.fromPantry);
    const steps = meal.steps || [];
    const totalIngredients = ingredients.length;
    const matchPercent = totalIngredients > 0 ? Math.round((pantryIngredients.length / totalIngredients) * 100) : 0;
    const isSaved = savedRecipes.some(r => r.name === meal.name);

    return `
    <div class="meal-card" onclick="toggleRecipe(${idx})">
      <div class="meal-header">
        <span class="meal-name">${meal.name}</span>
        <span class="meal-type-badge ${badgeClass}">${meal.type}</span>
      </div>

      <div class="meal-tags">
        ${(meal.tags || []).map(t => `<span class="meal-tag">${t}</span>`).join('')}
        ${meal.prepTime ? `<span class="meal-tag">Prep ${meal.prepTime}</span>` : ''}
        ${meal.cookTime ? `<span class="meal-tag">Cook ${meal.cookTime}</span>` : ''}
        ${meal.servings ? `<span class="meal-tag">${meal.servings} serving${meal.servings > 1 ? 's' : ''}</span>` : ''}
      </div>

      <div class="meal-macros-inline">
        <span class="macro-pill pill-cal">${macros.calories || '?'} cal</span>
        <span class="macro-pill pill-protein">${macros.protein || '?'}g protein</span>
        <span class="macro-pill pill-carbs">${macros.carbs || '?'}g carbs</span>
        <span class="macro-pill pill-fat">${macros.fat || '?'}g fat</span>
      </div>

      <div class="match-bar">
        <div class="match-bar-fill ${missingIngredients.length === 0 ? 'match-100' : missingIngredients.length <= 1 ? 'match-high' : 'match-low'}"
             style="width:${matchPercent}%"></div>
      </div>
      <div class="match-label">
        <span>
          ${pantryIngredients.length}/${totalIngredients} in pantry
          ${missingIngredients.length > 0
            ? `<span class="to-buy"> · ${missingIngredients.length} to buy</span>`
            : '<span class="ready"> · Ready to cook</span>'}
        </span>
        <span class="tap-hint">tap for recipe</span>
      </div>

      <!-- Expandable recipe -->
      <div class="recipe-detail" id="recipe-${idx}" style="display:none;">
        <div class="recipe-ingredients">
          <h4>Ingredients</h4>
          <ul>
            ${ingredients.map(ing => `
              <li class="${ing.fromPantry ? 'have' : 'missing-ing'}">
                <span class="ing-quantity">${ing.quantity}</span> ${ing.item}
                ${!ing.fromPantry ? '<span class="buy-tag">NEED</span>' : ''}
              </li>
            `).join('')}
          </ul>
        </div>

        <div class="recipe-steps">
          <h4>Instructions</h4>
          <ol>
            ${steps.map(step => `<li>${step}</li>`).join('')}
          </ol>
        </div>

        ${macros.calories ? `
        <div class="recipe-macro-breakdown">
          <h4>Nutrition per serving</h4>
          <div class="macro-grid">
            <div class="macro-cell">
              <div class="macro-cell-value macro-cal">${macros.calories}</div>
              <div class="macro-cell-label">Cal</div>
            </div>
            <div class="macro-cell">
              <div class="macro-cell-value macro-protein">${macros.protein}g</div>
              <div class="macro-cell-label">Protein</div>
            </div>
            <div class="macro-cell">
              <div class="macro-cell-value macro-carbs">${macros.carbs}g</div>
              <div class="macro-cell-label">Carbs</div>
            </div>
            <div class="macro-cell">
              <div class="macro-cell-value macro-fat">${macros.fat}g</div>
              <div class="macro-cell-label">Fat</div>
            </div>
          </div>
        </div>` : ''}

        <button class="save-btn ${isSaved ? 'saved' : ''}"
                id="save-btn-${idx}"
                onclick="event.stopPropagation(); saveRecipe(${idx})">
          ${isSaved ? '♥ Saved' : '♡ Save Recipe'}
        </button>
      </div>
    </div>`;
  }).join('');
}

function toggleRecipe(idx) {
  const el = document.getElementById(`recipe-${idx}`);
  if (el.style.display === 'none') {
    el.style.display = 'block';
    el.style.animation = 'fadeIn 0.3s ease';
  } else {
    el.style.display = 'none';
  }
}

// ============ Export / Import ============
$('export-pantry-btn').addEventListener('click', () => {
  const blob = new Blob([pantryItems.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'my_pantry.txt';
  a.click();
});

$('import-pantry-btn').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt';
  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const items = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    pantryItems = [...new Set([...pantryItems, ...items])];
    savePantry();
  };
  input.click();
});

// ============ Saved Recipes ============
function saveRecipe(idx) {
  const meal = currentMeals[idx];
  if (!meal) return;
  if (savedRecipes.some(r => r.name === meal.name)) {
    savedRecipes = savedRecipes.filter(r => r.name !== meal.name);
  } else {
    savedRecipes.push({ ...meal, savedAt: new Date().toISOString() });
  }
  localStorage.setItem('saved_recipes', JSON.stringify(savedRecipes));
  const btn = document.getElementById(`save-btn-${idx}`);
  if (btn) {
    const isSaved = savedRecipes.some(r => r.name === meal.name);
    btn.className = `save-btn ${isSaved ? 'saved' : ''}`;
    btn.textContent = isSaved ? '♥ Saved' : '♡ Save Recipe';
  }
  renderSavedRecipes();
}

function removeSavedRecipe(idx) {
  savedRecipes.splice(idx, 1);
  localStorage.setItem('saved_recipes', JSON.stringify(savedRecipes));
  renderSavedRecipes();
}

function renderSavedRecipes() {
  const container = $('saved-container');
  if (!container) return;

  if (savedRecipes.length === 0) {
    container.innerHTML = `
      <div class="no-meals">
        <div class="no-meals-icon">📌</div>
        <p>No saved recipes yet. Generate meals and save the ones you like.</p>
      </div>`;
    return;
  }

  container.innerHTML = savedRecipes.map((meal, idx) => {
    const badgeClass = `badge-${meal.type}`;
    const macros = meal.macros || {};
    const ingredients = meal.ingredients || [];
    const steps = meal.steps || [];

    return `
    <div class="saved-meal-card" onclick="toggleSavedDetail(${idx})">
      <div class="meal-header">
        <span class="meal-name">${meal.name}</span>
        <button class="unsave-btn" onclick="event.stopPropagation(); removeSavedRecipe(${idx})" title="Remove">&times;</button>
      </div>
      <span class="meal-type-badge ${badgeClass}" style="display:inline-block;margin-bottom:10px;">${meal.type}</span>

      <div class="meal-tags">
        ${(meal.tags || []).map(t => `<span class="meal-tag">${t}</span>`).join('')}
        ${meal.prepTime ? `<span class="meal-tag">Prep ${meal.prepTime}</span>` : ''}
        ${meal.cookTime ? `<span class="meal-tag">Cook ${meal.cookTime}</span>` : ''}
        ${meal.servings ? `<span class="meal-tag">${meal.servings} serving${meal.servings > 1 ? 's' : ''}</span>` : ''}
      </div>

      <div class="meal-macros-inline">
        <span class="macro-pill pill-cal">${macros.calories || '?'} cal</span>
        <span class="macro-pill pill-protein">${macros.protein || '?'}g protein</span>
        <span class="macro-pill pill-carbs">${macros.carbs || '?'}g carbs</span>
        <span class="macro-pill pill-fat">${macros.fat || '?'}g fat</span>
      </div>

      <div class="match-label" style="margin-top:10px;">
        <span></span>
        <span class="tap-hint">tap for recipe</span>
      </div>

      <div class="recipe-detail" id="saved-recipe-${idx}" style="display:none;">
        <div class="recipe-ingredients">
          <h4>Ingredients</h4>
          <ul>
            ${ingredients.map(ing => `
              <li class="${ing.fromPantry ? 'have' : 'missing-ing'}">
                <span class="ing-quantity">${ing.quantity}</span> ${ing.item}
                ${!ing.fromPantry ? '<span class="buy-tag">NEED</span>' : ''}
              </li>
            `).join('')}
          </ul>
        </div>
        <div class="recipe-steps">
          <h4>Instructions</h4>
          <ol>
            ${steps.map(step => `<li>${step}</li>`).join('')}
          </ol>
        </div>
        <div class="recipe-macro-breakdown">
          <h4>Nutrition per serving</h4>
          <div class="macro-grid">
            <div class="macro-cell"><div class="macro-cell-value macro-cal">${macros.calories}</div><div class="macro-cell-label">Cal</div></div>
            <div class="macro-cell"><div class="macro-cell-value macro-protein">${macros.protein}g</div><div class="macro-cell-label">Protein</div></div>
            <div class="macro-cell"><div class="macro-cell-value macro-carbs">${macros.carbs}g</div><div class="macro-cell-label">Carbs</div></div>
            <div class="macro-cell"><div class="macro-cell-value macro-fat">${macros.fat}g</div><div class="macro-cell-label">Fat</div></div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleSavedDetail(idx) {
  const el = document.getElementById(`saved-recipe-${idx}`);
  if (el.style.display === 'none') {
    el.style.display = 'block';
    el.style.animation = 'fadeIn 0.3s ease';
  } else {
    el.style.display = 'none';
  }
}

// ============ Theme Toggle ============
function loadTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  $('theme-toggle').textContent = saved === 'dark' ? '☀️' : '🌙';
}

$('theme-toggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  $('theme-toggle').textContent = next === 'dark' ? '☀️' : '🌙';
});

// ============ Init ============
loadTheme();
renderPantry();
updatePantryCount();
renderSavedRecipes();
document.querySelector('.filter-chip[data-type="all"]')?.classList.add('active');
