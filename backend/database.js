const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_URL || path.join(__dirname, '..', 'grocery.db');

let db = null;

// Initialize database
async function initializeDatabase() {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  try {
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }
  } catch (err) {
    console.log('Creating new database');
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      checked INTEGER DEFAULT 0,
      checked_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS item_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      last_used_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_items_checked ON items(checked)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_history_name ON item_history(name)`);

  saveDatabase();
  return db;
}

// Save database to file
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Get all items, unchecked first then checked
function getAllItems() {
  const results = db.exec(`
    SELECT id, name, checked, checked_at, created_at
    FROM items
    ORDER BY checked ASC, created_at DESC
  `);

  if (results.length === 0) return [];

  const columns = results[0].columns;
  return results[0].values.map(row => {
    const item = {};
    columns.forEach((col, i) => {
      item[col] = row[i];
    });
    return item;
  });
}

// Add a new item to the list
function addItem(name) {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

  // Add to active items
  db.run(`INSERT INTO items (name, created_at) VALUES (?, datetime('now'))`, [trimmedName]);

  // Get the inserted id
  const result = db.exec(`SELECT last_insert_rowid() as id`);
  const id = result[0].values[0][0];

  // Add/update history
  db.run(`
    INSERT INTO item_history (name, last_used_at)
    VALUES (?, datetime('now'))
    ON CONFLICT(name) DO UPDATE SET last_used_at = datetime('now')
  `, [trimmedName]);

  saveDatabase();

  return {
    id: id,
    name: trimmedName,
    checked: 0,
    checked_at: null,
    created_at: new Date().toISOString()
  };
}

// Toggle item checked state
function toggleItem(id) {
  const results = db.exec(`SELECT * FROM items WHERE id = ?`, [id]);

  if (results.length === 0 || results[0].values.length === 0) return null;

  const columns = results[0].columns;
  const row = results[0].values[0];
  const item = {};
  columns.forEach((col, i) => {
    item[col] = row[i];
  });

  const newChecked = item.checked ? 0 : 1;
  const checkedAt = newChecked ? new Date().toISOString() : null;

  db.run(`UPDATE items SET checked = ?, checked_at = ? WHERE id = ?`, [newChecked, checkedAt, id]);

  saveDatabase();

  return {
    ...item,
    checked: newChecked,
    checked_at: checkedAt
  };
}

// Delete an item
function deleteItem(id) {
  db.run(`DELETE FROM items WHERE id = ?`, [id]);
  saveDatabase();
}

// Get history items for autocomplete (matching prefix)
function getHistorySuggestions(prefix) {
  const pattern = `${prefix}%`;
  const results = db.exec(`
    SELECT name FROM item_history
    WHERE name LIKE ?
    ORDER BY last_used_at DESC
    LIMIT 10
  `, [pattern]);

  if (results.length === 0) return [];

  return results[0].values.map(row => ({ name: row[0] }));
}

// Auto-clear checked items older than 30 days
function clearOldCheckedItems() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffDate = thirtyDaysAgo.toISOString();

  db.run(`DELETE FROM items WHERE checked = 1 AND checked_at < ?`, [cutoffDate]);

  // Get changes count
  const result = db.exec(`SELECT changes()`);
  const changes = result[0]?.values[0]?.[0] || 0;

  if (changes > 0) {
    saveDatabase();
  }

  return changes;
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
