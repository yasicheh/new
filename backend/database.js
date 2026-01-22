const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_URL || path.join(__dirname, '..', 'grocery.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Initialize database schema
function initializeDatabase() {
  // Create items table (active grocery list)
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      checked INTEGER DEFAULT 0,
      checked_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create item_history table (for autocomplete)
  db.exec(`
    CREATE TABLE IF NOT EXISTS item_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      last_used_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create index for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_items_checked ON items(checked);
    CREATE INDEX IF NOT EXISTS idx_history_name ON item_history(name);
  `);
}

// Get all items, unchecked first then checked
function getAllItems() {
  return db.prepare(`
    SELECT id, name, checked, checked_at, created_at
    FROM items
    ORDER BY checked ASC, created_at DESC
  `).all();
}

// Add a new item to the list
function addItem(name) {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

  // Add to active items
  const result = db.prepare(`
    INSERT INTO items (name) VALUES (?)
  `).run(trimmedName);

  // Add/update history
  db.prepare(`
    INSERT INTO item_history (name, last_used_at)
    VALUES (?, datetime('now'))
    ON CONFLICT(name) DO UPDATE SET last_used_at = datetime('now')
  `).run(trimmedName);

  return {
    id: result.lastInsertRowid,
    name: trimmedName,
    checked: 0,
    checked_at: null,
    created_at: new Date().toISOString()
  };
}

// Toggle item checked state
function toggleItem(id) {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!item) return null;

  const newChecked = item.checked ? 0 : 1;
  const checkedAt = newChecked ? new Date().toISOString() : null;

  db.prepare(`
    UPDATE items
    SET checked = ?, checked_at = ?
    WHERE id = ?
  `).run(newChecked, checkedAt, id);

  return {
    ...item,
    checked: newChecked,
    checked_at: checkedAt
  };
}

// Delete an item
function deleteItem(id) {
  return db.prepare('DELETE FROM items WHERE id = ?').run(id);
}

// Get history items for autocomplete (matching prefix)
function getHistorySuggestions(prefix) {
  const pattern = `${prefix}%`;
  return db.prepare(`
    SELECT name FROM item_history
    WHERE name LIKE ?
    ORDER BY last_used_at DESC
    LIMIT 10
  `).all(pattern);
}

// Auto-clear checked items older than 30 days
function clearOldCheckedItems() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffDate = thirtyDaysAgo.toISOString();

  const result = db.prepare(`
    DELETE FROM items
    WHERE checked = 1 AND checked_at < ?
  `).run(cutoffDate);

  return result.changes;
}

module.exports = {
  initializeDatabase,
  getAllItems,
  addItem,
  toggleItem,
  deleteItem,
  getHistorySuggestions,
  clearOldCheckedItems
};
