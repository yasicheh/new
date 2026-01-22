// DOM Elements
const addForm = document.getElementById('add-form');
const itemInput = document.getElementById('item-input');
const suggestionsEl = document.getElementById('suggestions');
const activeList = document.getElementById('active-list');
const checkedList = document.getElementById('checked-list');
const activeSection = document.getElementById('active-section');
const checkedSection = document.getElementById('checked-section');

// State
let items = [];
let suggestions = [];
let selectedSuggestionIndex = -1;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadItems();
});

// Load all items from API
async function loadItems() {
  try {
    const response = await fetch('/api/items');
    if (response.status === 401) {
      window.location.href = '/login';
      return;
    }
    items = await response.json();
    renderItems();
  } catch (error) {
    console.error('Error loading items:', error);
    activeList.innerHTML = '<li class="loading">Error loading items. Please refresh.</li>';
  }
}

// Render items to the lists
function renderItems() {
  const activeItems = items.filter(item => !item.checked);
  const checkedItems = items.filter(item => item.checked);

  // Render active items
  if (activeItems.length === 0) {
    activeSection.classList.add('empty');
    activeList.innerHTML = '';
  } else {
    activeSection.classList.remove('empty');
    activeList.innerHTML = activeItems.map(item => createItemHTML(item)).join('');
  }

  // Render checked items
  if (checkedItems.length === 0) {
    checkedSection.classList.remove('has-items');
    checkedList.innerHTML = '';
  } else {
    checkedSection.classList.add('has-items');
    checkedList.innerHTML = checkedItems.map(item => createItemHTML(item)).join('');
  }

  // Add event listeners
  document.querySelectorAll('.item').forEach(itemEl => {
    const id = parseInt(itemEl.dataset.id, 10);

    // Toggle on click
    itemEl.querySelector('.item-content').addEventListener('click', () => toggleItem(id));

    // Delete button
    itemEl.querySelector('.item-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(id);
    });
  });
}

// Create HTML for a single item
function createItemHTML(item) {
  return `
    <li class="item" data-id="${item.id}">
      <div class="item-content">
        <span class="item-checkbox"></span>
        <span class="item-name">${escapeHTML(item.name)}</span>
      </div>
      <button class="item-delete" title="Delete">×</button>
    </li>
  `;
}

// Escape HTML to prevent XSS
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Add new item
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = itemInput.value.trim();
  if (!name) return;

  try {
    const response = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (response.status === 401) {
      window.location.href = '/login';
      return;
    }

    const newItem = await response.json();
    items.unshift(newItem);
    renderItems();

    // Highlight new item
    const newItemEl = document.querySelector(`[data-id="${newItem.id}"]`);
    if (newItemEl) {
      newItemEl.classList.add('new');
    }

    // Clear input
    itemInput.value = '';
    hideSuggestions();
  } catch (error) {
    console.error('Error adding item:', error);
  }
});

// Toggle item checked state
async function toggleItem(id) {
  try {
    const response = await fetch(`/api/items/${id}/toggle`, {
      method: 'PATCH'
    });

    if (response.status === 401) {
      window.location.href = '/login';
      return;
    }

    const updatedItem = await response.json();

    // Update local state
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = updatedItem;
    }

    renderItems();
  } catch (error) {
    console.error('Error toggling item:', error);
  }
}

// Delete item
async function deleteItem(id) {
  try {
    const response = await fetch(`/api/items/${id}`, {
      method: 'DELETE'
    });

    if (response.status === 401) {
      window.location.href = '/login';
      return;
    }

    // Remove from local state
    items = items.filter(item => item.id !== id);
    renderItems();
  } catch (error) {
    console.error('Error deleting item:', error);
  }
}

// Autocomplete functionality
let debounceTimer;

itemInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const query = itemInput.value.trim();

  if (query.length === 0) {
    hideSuggestions();
    return;
  }

  debounceTimer = setTimeout(() => {
    fetchSuggestions(query);
  }, 150);
});

async function fetchSuggestions(query) {
  try {
    const response = await fetch(`/api/suggestions?q=${encodeURIComponent(query)}`);
    if (!response.ok) return;

    suggestions = await response.json();
    selectedSuggestionIndex = -1;

    if (suggestions.length > 0) {
      showSuggestions();
    } else {
      hideSuggestions();
    }
  } catch (error) {
    console.error('Error fetching suggestions:', error);
  }
}

function showSuggestions() {
  suggestionsEl.innerHTML = suggestions.map((s, i) => `
    <li class="${i === selectedSuggestionIndex ? 'selected' : ''}">${escapeHTML(s)}</li>
  `).join('');

  suggestionsEl.classList.add('active');

  // Add click handlers
  suggestionsEl.querySelectorAll('li').forEach((li, index) => {
    li.addEventListener('click', () => {
      selectSuggestion(index);
    });
  });
}

function hideSuggestions() {
  suggestionsEl.classList.remove('active');
  suggestions = [];
  selectedSuggestionIndex = -1;
}

function selectSuggestion(index) {
  if (index >= 0 && index < suggestions.length) {
    itemInput.value = suggestions[index];
    hideSuggestions();
    itemInput.focus();
  }
}

// Keyboard navigation for suggestions
itemInput.addEventListener('keydown', (e) => {
  if (!suggestionsEl.classList.contains('active')) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
      showSuggestions();
      break;
    case 'ArrowUp':
      e.preventDefault();
      selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
      showSuggestions();
      break;
    case 'Enter':
      if (selectedSuggestionIndex >= 0) {
        e.preventDefault();
        selectSuggestion(selectedSuggestionIndex);
      }
      break;
    case 'Escape':
      hideSuggestions();
      break;
  }
});

// Hide suggestions when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.input-wrapper')) {
    hideSuggestions();
  }
});

// Focus input when clicking anywhere on form area
addForm.addEventListener('click', (e) => {
  if (e.target === addForm) {
    itemInput.focus();
  }
});
