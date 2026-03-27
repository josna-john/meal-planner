// ============ State ============
let pantryItems = JSON.parse(localStorage.getItem('pantry_v2') || '[]');
if (pantryItems.length === 0) {
  const old = JSON.parse(localStorage.getItem('pantry') || '[]');
  if (old.length > 0) {
    pantryItems = old.map(name => typeof name === 'string' ? { name, category: 'pantry' } : name);
    localStorage.setItem('pantry_v2', JSON.stringify(pantryItems));
  }
}
let currentMeals = [];
let excludedMeals = [];
let activeFilters = { mealType: 'all', dietary: [] };
let savedRecipes = JSON.parse(localStorage.getItem('saved_recipes') || '[]');
let weeklyPlan = JSON.parse(localStorage.getItem('weekly_plan') || '{}');
let dietaryProfile = JSON.parse(localStorage.getItem('dietary_profile') || '{"restrictions":[],"customRestrictions":[],"goals":{}}');
let cookHistory = JSON.parse(localStorage.getItem('cook_history') || '[]');
let plannerWeekOffset = 0;
let pantrySearchQuery = '';

const CATEGORIES = { fridge: { icon: '🧊', label: 'Fridge' }, freezer: { icon: '❄️', label: 'Freezer' }, pantry: { icon: '🏪', label: 'Pantry' }, spices: { icon: '🌶️', label: 'Spices' } };
const SLOT_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const QUICK_ADD_ITEMS = [
  { name: 'Eggs', cat: 'fridge' }, { name: 'Milk', cat: 'fridge' }, { name: 'Butter', cat: 'fridge' },
  { name: 'Chicken breast', cat: 'fridge' }, { name: 'Rice', cat: 'pantry' }, { name: 'Pasta', cat: 'pantry' },
  { name: 'Olive oil', cat: 'pantry' }, { name: 'Garlic', cat: 'fridge' }, { name: 'Onions', cat: 'pantry' },
  { name: 'Salt', cat: 'spices' }, { name: 'Pepper', cat: 'spices' }, { name: 'Bread', cat: 'pantry' },
  { name: 'Cheese', cat: 'fridge' }, { name: 'Tomatoes', cat: 'fridge' }, { name: 'Frozen veggies', cat: 'freezer' }
];

// ============ DOM ============
const $ = id => document.getElementById(id);
const pages = document.querySelectorAll('.page');
const navBtns = document.querySelectorAll('.nav-btn');

// ============ Toast Notifications ============
function toast(message, type = 'info') {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const container = $('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ============ Onboarding ============
function showOnboarding() {
  if (localStorage.getItem('onboarded')) return;
  $('onboarding').classList.add('active');
  let step = 0;
  $('onboard-next').addEventListener('click', () => {
    $(`onboard-step-${step}`).style.display = 'none';
    document.querySelectorAll('.onboard-dot').forEach(d => d.classList.remove('active'));
    step++;
    if (step > 3) {
      $('onboarding').classList.remove('active');
      localStorage.setItem('onboarded', 'true');
      return;
    }
    $(`onboard-step-${step}`).style.display = 'block';
    document.querySelector(`.onboard-dot[data-step="${step}"]`).classList.add('active');
    $('onboard-next').textContent = step === 3 ? "Let's Go!" : 'Next';
  });
}

// ============ Navigation ============
function switchPage(pageId) {
  pages.forEach(p => p.classList.remove('active'));
  navBtns.forEach(b => b.classList.remove('active'));
  $(pageId).classList.add('active');
  document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
}
navBtns.forEach(btn => btn.addEventListener('click', () => switchPage(btn.dataset.page)));

// Sub-tabs (Saved / History)
document.querySelectorAll('.sub-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    $(tab.dataset.subtab).classList.add('active');
  });
});

// ============ Theme ============
function loadTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  $('theme-toggle').textContent = saved === 'dark' ? '☀️' : '🌙';
}
$('theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  $('theme-toggle').textContent = next === 'dark' ? '☀️' : '🌙';
});

// ============ Pantry (Categorized) ============
function savePantry() {
  localStorage.setItem('pantry_v2', JSON.stringify(pantryItems));
  renderPantry();
  updatePantryCount();
  renderQuickAdd();
}

function addPantryItem(name, category = 'pantry') {
  name = name.trim();
  if (!name || pantryItems.some(i => i.name.toLowerCase() === name.toLowerCase())) return;
  pantryItems.push({ name, category });
  savePantry();
  toast(`Added "${name}"`, 'success');
}

function removePantryItem(index) {
  const name = pantryItems[index].name;
  pantryItems.splice(index, 1);
  savePantry();
  toast(`Removed "${name}"`, 'info');
}

function clearPantry() {
  if (confirm('Remove all pantry items?')) { pantryItems = []; savePantry(); toast('Pantry cleared', 'info'); }
}

function getPantryNames() { return pantryItems.map(i => i.name); }

function renderPantry() {
  const container = $('pantry-categories');
  const query = pantrySearchQuery.toLowerCase();

  if (pantryItems.length === 0) {
    container.innerHTML = `<div class="pantry-empty"><div class="pantry-empty-icon">🛒</div><p>Your pantry is empty.<br>Add items above or load your saved list.</p></div>`;
    return;
  }

  const grouped = {};
  for (const cat of Object.keys(CATEGORIES)) grouped[cat] = [];
  pantryItems.forEach((item, idx) => {
    if (query && !item.name.toLowerCase().includes(query)) return;
    const cat = item.category || 'pantry';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ ...item, idx });
  });

  const html = Object.entries(CATEGORIES).map(([key, { icon, label }]) => {
    const items = grouped[key] || [];
    if (items.length === 0) return '';
    return `
      <div class="pantry-category">
        <div class="category-header">
          <span class="category-icon">${icon}</span>
          <span class="category-name">${label}</span>
          <span class="category-count">${items.length}</span>
        </div>
        <div class="pantry-list">
          ${items.map(item => `
            <div class="pantry-item">
              <span>${item.name}</span>
              <button class="remove-btn" onclick="removePantryItem(${item.idx})">&times;</button>
            </div>
          `).join('')}
        </div>
      </div>`;
  }).join('');

  container.innerHTML = html || `<div class="pantry-empty"><p>No items match "${pantrySearchQuery}"</p></div>`;
}

function updatePantryCount() {
  $('pantry-count').textContent = `${pantryItems.length} item${pantryItems.length !== 1 ? 's' : ''}`;
}

// Quick Add
function renderQuickAdd() {
  const existing = new Set(pantryItems.map(i => i.name.toLowerCase()));
  const suggestions = QUICK_ADD_ITEMS.filter(i => !existing.has(i.name.toLowerCase()));
  const container = $('quick-add');
  if (suggestions.length === 0) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  $('quick-add-chips').innerHTML = suggestions.slice(0, 8).map(s =>
    `<button class="quick-add-chip" onclick="addPantryItem('${s.name}','${s.cat}')">+ ${s.name}</button>`
  ).join('');
}

// Pantry search
$('pantry-search').addEventListener('input', e => {
  pantrySearchQuery = e.target.value;
  renderPantry();
});

$('add-item-input').addEventListener('keypress', e => {
  if (e.key === 'Enter') { addPantryItem(e.target.value, $('add-item-category').value); e.target.value = ''; }
});
$('add-item-btn').addEventListener('click', () => {
  addPantryItem($('add-item-input').value, $('add-item-category').value);
  $('add-item-input').value = '';
});

function guessCategory(name) {
  const n = name.toLowerCase();
  if (['frozen', 'freeze', 'ice cream', 'fries'].some(w => n.includes(w))) return 'freezer';
  if (['milk', 'cheese', 'cream', 'eggs', 'juice', 'mayo', 'yogurt', 'butter', 'kiwi', 'tomato', 'orange', 'onion', 'ginger', 'garlic', 'hummus', 'bacon', 'sausage', 'steak', 'chicken', 'kebab', 'meatball', 'broth', 'olives', 'ponzu', 'ketchup'].some(w => n.includes(w))) return 'fridge';
  if (['spice', 'seasoning', 'curry leaves', 'pepper', 'salt', 'cumin', 'turmeric', 'paprika', 'cinnamon', 'gochujang', 'sriracha', 'sauce', 'soy sauce', 'hoisin', 'oyster sauce', 'vinegar', 'mustard', 'chili', 'oil', 'spray'].some(w => n.includes(w))) return 'spices';
  return 'pantry';
}

$('load-default-btn').addEventListener('click', async () => {
  try {
    const resp = await fetch('pantry_items.txt');
    const text = await resp.text();
    pantryItems = text.split('\n').map(l => l.trim()).filter(l => l.length > 0).map(name => ({ name, category: guessCategory(name) }));
    savePantry();
    toast(`Loaded ${pantryItems.length} items!`, 'success');
  } catch { toast('Could not load file', 'error'); }
});

$('clear-pantry-btn').addEventListener('click', clearPantry);

$('export-pantry-btn').addEventListener('click', () => {
  const blob = new Blob([pantryItems.map(i => i.name).join('\n')], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'my_pantry.txt'; a.click();
  toast('Pantry exported!', 'success');
});

$('import-pantry-btn').addEventListener('click', () => {
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.txt';
  input.onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    const items = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const existing = new Set(pantryItems.map(i => i.name.toLowerCase()));
    let count = 0;
    items.forEach(name => { if (!existing.has(name.toLowerCase())) { pantryItems.push({ name, category: guessCategory(name) }); count++; } });
    savePantry();
    toast(`Imported ${count} new items`, 'success');
  };
  input.click();
});

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
    if (activeFilters.dietary.includes(diet)) activeFilters.dietary = activeFilters.dietary.filter(d => d !== diet);
    else activeFilters.dietary.push(diet);
  });
});

// ============ Generate Meals ============
$('generate-btn').addEventListener('click', generateMeals);
$('more-ideas-btn').addEventListener('click', generateMeals);

function showSkeletonLoading() {
  $('meals-container').innerHTML = Array(3).fill(`
    <div class="skeleton-card">
      <div class="skeleton-line w60 h20"></div>
      <div class="skeleton-line w80"></div>
      <div class="skeleton-line w40"></div>
      <div class="skeleton-pills">
        <div class="skeleton-pill"></div>
        <div class="skeleton-pill"></div>
        <div class="skeleton-pill"></div>
        <div class="skeleton-pill"></div>
      </div>
    </div>
  `).join('');
}

async function generateMeals() {
  if (pantryItems.length === 0) { toast('Add items to your pantry first!', 'error'); switchPage('page-pantry'); return; }
  const btn = $('generate-btn');
  const moreBtn = $('more-ideas-btn');
  btn.disabled = true; moreBtn.disabled = true;
  btn.innerHTML = '<span class="loading-dots">Cooking up ideas</span>';
  showSkeletonLoading();

  try {
    const meals = await generateMealIdeas(getPantryNames(), {
      mealType: activeFilters.mealType,
      dietaryPrefs: activeFilters.dietary,
      allowMissing: parseInt($('missing-tolerance').value),
      count: 5,
      excludeMeals: excludedMeals,
      dietaryProfile
    });
    currentMeals = meals;
    excludedMeals.push(...meals.map(m => m.name));
    if (excludedMeals.length > 20) excludedMeals = excludedMeals.slice(-10);
    renderMeals(meals);
    toast(`Generated ${meals.length} meal ideas!`, 'success');
  } catch (err) {
    $('meals-container').innerHTML = `<div class="no-meals"><div class="no-meals-icon">😕</div><p>${err.message}</p></div>`;
    toast('Failed to generate meals', 'error');
  } finally {
    btn.disabled = false; moreBtn.disabled = false;
    btn.innerHTML = 'Generate Meal Ideas';
  }
}

// ============ Render Meals ============
function renderMeals(meals) {
  if (!meals || meals.length === 0) {
    $('meals-container').innerHTML = `<div class="no-meals"><div class="no-meals-icon">🤷</div><p>No meal ideas found. Try adjusting your filters.</p></div>`;
    return;
  }
  $('meals-container').innerHTML = meals.map((meal, idx) => renderMealCard(meal, idx, 'generated')).join('');
}

function renderMealCard(meal, idx, context) {
  const prefix = context === 'saved' ? 'saved' : 'gen';
  const badgeClass = `badge-${meal.type}`;
  const macros = meal.macros || {};
  const ingredients = meal.ingredients || [];
  const pantryIng = ingredients.filter(i => i.fromPantry);
  const missingIng = ingredients.filter(i => !i.fromPantry);
  const steps = meal.steps || [];
  const total = ingredients.length;
  const pct = total > 0 ? Math.round((pantryIng.length / total) * 100) : 0;
  const isSaved = savedRecipes.some(r => r.name === meal.name);
  const origServings = meal.servings || 2;

  return `
  <div class="meal-card" onclick="toggleRecipe('${prefix}-${idx}')">
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
    <div class="meal-macros-inline" id="${prefix}-macros-${idx}">
      <span class="macro-pill pill-cal">${macros.calories || '?'} cal</span>
      <span class="macro-pill pill-protein">${macros.protein || '?'}g protein</span>
      <span class="macro-pill pill-carbs">${macros.carbs || '?'}g carbs</span>
      <span class="macro-pill pill-fat">${macros.fat || '?'}g fat</span>
    </div>
    ${context === 'generated' ? `
    <div class="match-bar"><div class="match-bar-fill ${missingIng.length === 0 ? 'match-100' : missingIng.length <= 1 ? 'match-high' : 'match-low'}" style="width:${pct}%"></div></div>
    <div class="match-label">
      <span>${pantryIng.length}/${total} in pantry ${missingIng.length > 0 ? `<span class="to-buy"> · ${missingIng.length} to buy</span>` : '<span class="ready"> · Ready to cook</span>'}</span>
      <span class="tap-hint">tap for recipe</span>
    </div>` : `<div class="match-label" style="margin-top:10px;"><span></span><span class="tap-hint">tap for recipe</span></div>`}
    <div class="recipe-detail" id="${prefix}-${idx}" style="display:none;">
      <div class="serving-adjuster">
        <label>Servings</label>
        <div class="serving-adjuster-btns">
          <button class="serving-adj-btn" onclick="event.stopPropagation(); adjustServings('${prefix}', ${idx}, -1, ${origServings})">−</button>
          <span class="serving-count" id="${prefix}-serving-count-${idx}">${origServings}</span>
          <button class="serving-adj-btn" onclick="event.stopPropagation(); adjustServings('${prefix}', ${idx}, 1, ${origServings})">+</button>
        </div>
      </div>
      <div class="recipe-ingredients" id="${prefix}-ingredients-${idx}">
        <h4>Ingredients</h4>
        <ul>${ingredients.map(ing => `
          <li class="${ing.fromPantry ? 'have' : 'missing-ing'}" data-qty="${ing.quantity}">
            <span class="ing-quantity">${ing.quantity}</span> ${ing.item}
            ${!ing.fromPantry ? '<span class="buy-tag">NEED</span>' : ''}
          </li>`).join('')}</ul>
      </div>
      <div class="recipe-steps"><h4>Instructions</h4><ol>${steps.map(step => `<li>${step}</li>`).join('')}</ol></div>
      ${macros.calories ? `
      <div class="recipe-macro-breakdown"><h4>Nutrition per serving</h4>
        <div class="macro-grid" id="${prefix}-macro-grid-${idx}">
          <div class="macro-cell"><div class="macro-cell-value macro-cal">${macros.calories}</div><div class="macro-cell-label">Cal</div></div>
          <div class="macro-cell"><div class="macro-cell-value macro-protein">${macros.protein}g</div><div class="macro-cell-label">Protein</div></div>
          <div class="macro-cell"><div class="macro-cell-value macro-carbs">${macros.carbs}g</div><div class="macro-cell-label">Carbs</div></div>
          <div class="macro-cell"><div class="macro-cell-value macro-fat">${macros.fat}g</div><div class="macro-cell-label">Fat</div></div>
        </div></div>` : ''}
      <div class="recipe-actions">
        ${context === 'generated' ? `<button class="recipe-action-btn ${isSaved ? 'saved' : ''}" id="save-btn-${idx}" onclick="event.stopPropagation(); saveRecipe(${idx})">${isSaved ? '♥ Saved' : '♡ Save'}</button>` : `<button class="recipe-action-btn" onclick="event.stopPropagation(); removeSavedRecipe(${idx})">Remove</button>`}
        <button class="recipe-action-btn" onclick="event.stopPropagation(); startCookMode(${idx}, '${context}')">👨‍🍳 Cook</button>
        <button class="recipe-action-btn" onclick="event.stopPropagation(); markCooked(${idx}, '${context}')">✅ Cooked It</button>
        <button class="recipe-action-btn" onclick="event.stopPropagation(); shareRecipe(${idx}, '${context}')">📤 Share</button>
        ${context === 'generated' ? `<button class="recipe-action-btn" onclick="event.stopPropagation(); addToPlanner(${idx})">📅 Plan</button>` : ''}
      </div>
    </div>
  </div>`;
}

function toggleRecipe(id) {
  const el = $(id);
  if (el.style.display === 'none') { el.style.display = 'block'; el.style.animation = 'fadeIn 0.3s ease'; }
  else { el.style.display = 'none'; }
}

// ============ Serving Adjuster ============
function adjustServings(prefix, idx, delta, origServings) {
  const countEl = $(`${prefix}-serving-count-${idx}`);
  let current = Math.max(1, parseInt(countEl.textContent) + delta);
  countEl.textContent = current;
  const ratio = current / origServings;
  const ingContainer = $(`${prefix}-ingredients-${idx}`);
  if (ingContainer) ingContainer.querySelectorAll('li').forEach(li => {
    li.querySelector('.ing-quantity').textContent = scaleQuantity(li.dataset.qty, ratio);
  });
  const meal = prefix === 'saved' ? savedRecipes[idx] : currentMeals[idx];
  if (meal?.macros) {
    const grid = $(`${prefix}-macro-grid-${idx}`);
    if (grid) {
      const m = meal.macros, cells = grid.querySelectorAll('.macro-cell-value');
      cells[0].textContent = Math.round(m.calories * ratio);
      cells[1].textContent = Math.round(m.protein * ratio) + 'g';
      cells[2].textContent = Math.round(m.carbs * ratio) + 'g';
      cells[3].textContent = Math.round(m.fat * ratio) + 'g';
    }
  }
}

function scaleQuantity(qtyStr, ratio) {
  const match = qtyStr.match(/^([\d.\/]+)\s*(.*)/);
  if (!match) return qtyStr;
  let num = match[1]; const unit = match[2];
  num = num.includes('/') ? parseFloat(num.split('/')[0]) / parseFloat(num.split('/')[1]) : parseFloat(num);
  const scaled = num * ratio;
  const rounded = scaled % 1 === 0 ? scaled : Math.round(scaled * 10) / 10;
  return `${rounded} ${unit}`.trim();
}

// ============ Cook Mode ============
let cookModeData = { steps: [], current: 0, title: '' };
function startCookMode(idx, context) {
  const meal = context === 'saved' ? savedRecipes[idx] : currentMeals[idx];
  if (!meal?.steps?.length) return;
  cookModeData = { steps: meal.steps, current: 0, title: meal.name };
  updateCookMode();
  $('cook-mode').classList.add('active');
  if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {});
}
function updateCookMode() {
  $('cook-mode-title').textContent = cookModeData.title;
  $('cook-mode-progress').textContent = `Step ${cookModeData.current + 1} of ${cookModeData.steps.length}`;
  $('cook-mode-step').textContent = cookModeData.steps[cookModeData.current];
  $('cook-prev').disabled = cookModeData.current === 0;
  $('cook-next').textContent = cookModeData.current === cookModeData.steps.length - 1 ? 'Done' : 'Next Step';
}
$('cook-mode-close').addEventListener('click', () => $('cook-mode').classList.remove('active'));
$('cook-prev').addEventListener('click', () => { if (cookModeData.current > 0) { cookModeData.current--; updateCookMode(); } });
$('cook-next').addEventListener('click', () => {
  if (cookModeData.current < cookModeData.steps.length - 1) { cookModeData.current++; updateCookMode(); }
  else { $('cook-mode').classList.remove('active'); }
});

// ============ Cooked It (History) ============
function markCooked(idx, context) {
  const meal = context === 'saved' ? savedRecipes[idx] : currentMeals[idx];
  if (!meal) return;
  cookHistory.unshift({
    name: meal.name,
    type: meal.type,
    macros: meal.macros || {},
    cookedAt: new Date().toISOString()
  });
  localStorage.setItem('cook_history', JSON.stringify(cookHistory));
  toast(`"${meal.name}" added to history!`, 'success');
  renderHistory();
}

function renderHistory() {
  // Stats
  const thisWeek = cookHistory.filter(h => {
    const d = new Date(h.cookedAt);
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    return d >= weekAgo;
  });
  const totalMeals = thisWeek.length;
  const totalCal = thisWeek.reduce((s, h) => s + (h.macros.calories || 0), 0);
  const totalProtein = thisWeek.reduce((s, h) => s + (h.macros.protein || 0), 0);
  const avgCal = totalMeals > 0 ? Math.round(totalCal / totalMeals) : 0;

  $('history-stats').innerHTML = totalMeals > 0 ? `
    <div class="history-stats-card">
      <h4>This Week</h4>
      <div class="history-stats-grid">
        <div class="history-stat"><div class="history-stat-value">${totalMeals}</div><div class="history-stat-label">Meals Cooked</div></div>
        <div class="history-stat"><div class="history-stat-value" style="color:var(--green)">${totalProtein}g</div><div class="history-stat-label">Total Protein</div></div>
        <div class="history-stat"><div class="history-stat-value">${totalCal}</div><div class="history-stat-label">Total Calories</div></div>
        <div class="history-stat"><div class="history-stat-value" style="color:var(--purple)">${avgCal}</div><div class="history-stat-label">Avg Cal/Meal</div></div>
      </div>
    </div>` : '';

  // List
  if (cookHistory.length === 0) {
    $('history-container').innerHTML = `<div class="no-meals"><div class="no-meals-icon">📝</div><p>No cooking history yet. Tap "Cooked It" on a recipe after you make it.</p></div>`;
    return;
  }
  $('history-container').innerHTML = cookHistory.slice(0, 50).map(h => {
    const d = new Date(h.cookedAt);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `
      <div class="history-item">
        <div class="history-item-info">
          <div class="history-item-name">${h.name}</div>
          <div class="history-item-meta">${dateStr} at ${timeStr} · ${h.macros.calories || '?'} cal · ${h.macros.protein || '?'}g protein</div>
        </div>
        <span class="history-item-badge badge-${h.type}">${h.type}</span>
      </div>`;
  }).join('');
}

// ============ Share Recipe ============
function shareRecipe(idx, context) {
  const meal = context === 'saved' ? savedRecipes[idx] : currentMeals[idx];
  if (!meal) return;
  const ingredients = (meal.ingredients || []).map(i => `  ${i.quantity} ${i.item}`).join('\n');
  const steps = (meal.steps || []).map((s, i) => `  ${i + 1}. ${s}`).join('\n');
  const m = meal.macros || {};
  const text = `${meal.name}\n${meal.type} · ${meal.servings || '?'} servings\n\nIngredients:\n${ingredients}\n\nInstructions:\n${steps}\n\nMacros per serving: ${m.calories} cal | ${m.protein}g protein | ${m.carbs}g carbs | ${m.fat}g fat`;
  if (navigator.share) navigator.share({ title: meal.name, text }).catch(() => {});
  else navigator.clipboard.writeText(text).then(() => toast('Recipe copied!', 'success'));
}

// ============ Add to Planner ============
function addToPlanner(idx) {
  const meal = currentMeals[idx]; if (!meal) return;
  const day = prompt('Which day? (Monday, Tuesday, etc.)'); if (!day) return;
  const slot = meal.type === 'dessert' || meal.type === 'drink' ? 'snack' : (SLOT_TYPES.includes(meal.type) ? meal.type : 'lunch');
  const weekKey = getWeekKey(plannerWeekOffset);
  if (!weeklyPlan[weekKey]) weeklyPlan[weekKey] = {};
  if (!weeklyPlan[weekKey][day.toLowerCase()]) weeklyPlan[weekKey][day.toLowerCase()] = {};
  weeklyPlan[weekKey][day.toLowerCase()][slot] = meal;
  localStorage.setItem('weekly_plan', JSON.stringify(weeklyPlan));
  toast(`Added "${meal.name}" to ${day}`, 'success');
  renderPlanner();
}

// ============ Saved Recipes ============
function saveRecipe(idx) {
  const meal = currentMeals[idx]; if (!meal) return;
  if (savedRecipes.some(r => r.name === meal.name)) {
    savedRecipes = savedRecipes.filter(r => r.name !== meal.name);
    toast('Recipe removed from saved', 'info');
  } else {
    savedRecipes.push({ ...meal, savedAt: new Date().toISOString() });
    toast(`"${meal.name}" saved!`, 'success');
  }
  localStorage.setItem('saved_recipes', JSON.stringify(savedRecipes));
  const btn = document.getElementById(`save-btn-${idx}`);
  if (btn) {
    const isSaved = savedRecipes.some(r => r.name === meal.name);
    btn.className = `recipe-action-btn ${isSaved ? 'saved' : ''}`;
    btn.textContent = isSaved ? '♥ Saved' : '♡ Save';
  }
  renderSavedRecipes();
}

function removeSavedRecipe(idx) {
  const name = savedRecipes[idx].name;
  savedRecipes.splice(idx, 1);
  localStorage.setItem('saved_recipes', JSON.stringify(savedRecipes));
  renderSavedRecipes();
  toast(`"${name}" removed`, 'info');
}

function renderSavedRecipes() {
  const container = $('saved-container');
  if (savedRecipes.length === 0) {
    container.innerHTML = `<div class="no-meals"><div class="no-meals-icon">📌</div><p>No saved recipes yet. Generate meals and save the ones you like.</p></div>`;
    return;
  }
  container.innerHTML = savedRecipes.map((meal, idx) => renderMealCard(meal, idx, 'saved')).join('');
}

// ============ Weekly Planner ============
function getWeekKey(offset) {
  const now = new Date(); now.setDate(now.getDate() + offset * 7);
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return monday.toISOString().split('T')[0];
}
function getWeekDays(offset) {
  const now = new Date(); now.setDate(now.getDate() + offset * 7);
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const days = [], names = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'], labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    days.push({ key: names[i], label: labels[i], date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), isToday: d.toDateString() === new Date().toDateString() });
  }
  return days;
}

function renderPlanner() {
  const weekKey = getWeekKey(plannerWeekOffset);
  const days = getWeekDays(plannerWeekOffset);
  const plan = weeklyPlan[weekKey] || {};
  $('planner-week-label').textContent = plannerWeekOffset === 0 ? 'This Week' : plannerWeekOffset === 1 ? 'Next Week' : plannerWeekOffset === -1 ? 'Last Week' : `Week of ${days[0].date}`;
  $('planner-days').innerHTML = days.map(day => {
    const dayPlan = plan[day.key] || {};
    const dm = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const slots = SLOT_TYPES.map(slot => {
      const meal = dayPlan[slot];
      if (meal?.macros) { dm.calories += meal.macros.calories||0; dm.protein += meal.macros.protein||0; dm.carbs += meal.macros.carbs||0; dm.fat += meal.macros.fat||0; }
      return `<div class="planner-slot"><span class="slot-type">${slot}</span><span class="slot-meal ${meal?'':'empty'}">${meal?meal.name:'—'}</span>${meal?`<span class="slot-macros">${meal.macros?.calories||0} cal</span><button class="slot-remove" onclick="removePlannerMeal('${weekKey}','${day.key}','${slot}')">&times;</button>`:''}
      </div>`;
    }).join('');
    const hasMeals = Object.keys(dayPlan).length > 0;
    return `<div class="planner-day ${day.isToday?'today':''}"><div class="planner-day-header">${day.label} <span class="day-date">${day.date}</span></div><div class="planner-slots">${slots}</div>${hasMeals?`<div class="planner-day-macros"><span style="color:var(--accent)">${dm.calories} cal</span><span style="color:var(--green)">${dm.protein}g P</span><span style="color:var(--yellow)">${dm.carbs}g C</span><span style="color:var(--purple)">${dm.fat}g F</span></div>`:''}</div>`;
  }).join('');
}

function removePlannerMeal(weekKey, day, slot) {
  if (weeklyPlan[weekKey]?.[day]) {
    delete weeklyPlan[weekKey][day][slot];
    if (Object.keys(weeklyPlan[weekKey][day]).length === 0) delete weeklyPlan[weekKey][day];
    localStorage.setItem('weekly_plan', JSON.stringify(weeklyPlan));
    renderPlanner();
    toast('Meal removed from planner', 'info');
  }
}

$('planner-prev').addEventListener('click', () => { plannerWeekOffset--; renderPlanner(); });
$('planner-next').addEventListener('click', () => { plannerWeekOffset++; renderPlanner(); });

// ============ Shopping List ============
$('view-shopping-list').addEventListener('click', () => {
  const weekKey = getWeekKey(plannerWeekOffset);
  const plan = weeklyPlan[weekKey] || {};
  const items = {};
  Object.values(plan).forEach(dayPlan => {
    Object.values(dayPlan).forEach(meal => {
      (meal.ingredients || []).forEach(ing => {
        if (!ing.fromPantry) { const key = ing.item.toLowerCase(); if (!items[key]) items[key] = { item: ing.item, quantity: ing.quantity }; }
      });
    });
  });
  const container = $('shopping-list-content');
  const itemList = Object.values(items);
  container.innerHTML = itemList.length === 0
    ? `<div class="no-meals" style="padding:30px 20px;"><div class="no-meals-icon">✅</div><p>No missing ingredients for this week!</p></div>`
    : `<div class="shopping-category"><h4>Items to buy (${itemList.length})</h4>${itemList.map((item, i) => `<div class="shopping-item" id="shop-item-${i}" onclick="toggleShopItem(${i})"><input type="checkbox" onclick="event.stopPropagation(); toggleShopItem(${i})"><span>${item.quantity} ${item.item}</span></div>`).join('')}</div>`;
  $('shopping-overlay').classList.add('active');
});

function toggleShopItem(i) {
  const el = $(`shop-item-${i}`), cb = el.querySelector('input');
  cb.checked = !cb.checked;
  el.classList.toggle('checked', cb.checked);
}

$('shopping-close').addEventListener('click', () => $('shopping-overlay').classList.remove('active'));
$('copy-shopping-list').addEventListener('click', () => {
  const items = document.querySelectorAll('.shopping-item:not(.checked) span');
  navigator.clipboard.writeText('Shopping List:\n' + Array.from(items).map(s => '• ' + s.textContent).join('\n')).then(() => toast('Copied!', 'success'));
});
$('share-shopping-list').addEventListener('click', () => {
  const items = document.querySelectorAll('.shopping-item:not(.checked) span');
  const text = 'Shopping List:\n' + Array.from(items).map(s => '• ' + s.textContent).join('\n');
  if (navigator.share) navigator.share({ title: 'Shopping List', text }).catch(() => {});
  else navigator.clipboard.writeText(text).then(() => toast('Copied!', 'success'));
});

// ============ Dietary Profile ============
function loadProfile() {
  document.querySelectorAll('#dietary-restrictions input').forEach(cb => {
    cb.checked = dietaryProfile.restrictions.includes(cb.value);
    cb.addEventListener('change', saveProfile);
  });
  renderCustomRestrictions();
  if (dietaryProfile.goals.calories) $('goal-calories').value = dietaryProfile.goals.calories;
  if (dietaryProfile.goals.protein) $('goal-protein').value = dietaryProfile.goals.protein;
  if (dietaryProfile.goals.carbs) $('goal-carbs').value = dietaryProfile.goals.carbs;
  if (dietaryProfile.goals.fat) $('goal-fat').value = dietaryProfile.goals.fat;
}
function saveProfile() {
  dietaryProfile.restrictions = Array.from(document.querySelectorAll('#dietary-restrictions input')).filter(cb => cb.checked).map(cb => cb.value);
  localStorage.setItem('dietary_profile', JSON.stringify(dietaryProfile));
}
$('add-restriction-btn').addEventListener('click', () => {
  const val = $('custom-restriction-input').value.trim();
  if (val && !dietaryProfile.customRestrictions.includes(val)) {
    dietaryProfile.customRestrictions.push(val);
    localStorage.setItem('dietary_profile', JSON.stringify(dietaryProfile));
    $('custom-restriction-input').value = '';
    renderCustomRestrictions();
    toast(`Added "${val}"`, 'success');
  }
});
function removeCustomRestriction(idx) {
  dietaryProfile.customRestrictions.splice(idx, 1);
  localStorage.setItem('dietary_profile', JSON.stringify(dietaryProfile));
  renderCustomRestrictions();
}
function renderCustomRestrictions() {
  $('custom-restrictions-list').innerHTML = dietaryProfile.customRestrictions.map((r, i) =>
    `<span class="custom-restriction-tag">${r}<button onclick="removeCustomRestriction(${i})">&times;</button></span>`
  ).join('');
}
$('save-goals-btn').addEventListener('click', () => {
  dietaryProfile.goals = {
    calories: parseInt($('goal-calories').value) || null,
    protein: parseInt($('goal-protein').value) || null,
    carbs: parseInt($('goal-carbs').value) || null,
    fat: parseInt($('goal-fat').value) || null
  };
  localStorage.setItem('dietary_profile', JSON.stringify(dietaryProfile));
  toast('Macro goals saved!', 'success');
});

// ============ Init ============
loadTheme();
renderPantry();
updatePantryCount();
renderQuickAdd();
renderSavedRecipes();
renderPlanner();
renderHistory();
loadProfile();
showOnboarding();
document.querySelector('.filter-chip[data-type="all"]')?.classList.add('active');
