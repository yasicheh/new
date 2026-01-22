require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.PASSWORD || 'grocery';

// Generate a session secret for signing cookies
const SESSION_SECRET = crypto.randomBytes(32).toString('hex');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(SESSION_SECRET));

// Generate auth token from password
function generateAuthToken(password) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(password).digest('hex');
}

// Auth middleware
function requireAuth(req, res, next) {
  const authToken = req.signedCookies.auth;
  const expectedToken = generateAuthToken(PASSWORD);

  if (authToken === expectedToken) {
    return next();
  }

  // For API requests, return 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // For page requests, redirect to login
  res.redirect('/login');
}

// Login page
app.get('/login', (req, res) => {
  const error = req.query.error ? '<p class="error">Incorrect password</p>' : '';
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Grocery List - Login</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f5f5f5;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .login-container {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          width: 100%;
          max-width: 320px;
        }
        h1 {
          text-align: center;
          margin-bottom: 8px;
          font-size: 24px;
        }
        .subtitle {
          text-align: center;
          color: #666;
          margin-bottom: 24px;
          font-size: 14px;
        }
        input[type="password"] {
          width: 100%;
          padding: 14px;
          font-size: 16px;
          border: 2px solid #ddd;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        input[type="password"]:focus {
          outline: none;
          border-color: #4CAF50;
        }
        button {
          width: 100%;
          padding: 14px;
          font-size: 16px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }
        button:hover { background: #45a049; }
        .error {
          color: #d32f2f;
          text-align: center;
          margin-bottom: 16px;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <h1>🛒 Grocery List</h1>
        <p class="subtitle">Enter the shared password</p>
        ${error}
        <form method="POST" action="/login">
          <input type="password" name="password" placeholder="Password" required autofocus>
          <button type="submit">Enter</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// Handle login
app.post('/login', (req, res) => {
  const { password } = req.body;

  if (password === PASSWORD) {
    const token = generateAuthToken(password);
    res.cookie('auth', token, {
      signed: true,
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax'
    });
    return res.redirect('/');
  }

  res.redirect('/login?error=1');
});

// Logout
app.get('/logout', (req, res) => {
  res.clearCookie('auth');
  res.redirect('/login');
});

// Serve static frontend files (protected)
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.use('/styles.css', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'styles.css'));
});

app.use('/app.js', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'app.js'));
});

// API Routes (all protected)

// Get all items
app.get('/api/items', requireAuth, (req, res) => {
  try {
    // Clear old items on each load
    db.clearOldCheckedItems();
    const items = db.getAllItems();
    res.json(items);
  } catch (error) {
    console.error('Error getting items:', error);
    res.status(500).json({ error: 'Failed to get items' });
  }
});

// Add new item
app.post('/api/items', requireAuth, (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Item name is required' });
    }
    const item = db.addItem(name);
    res.status(201).json(item);
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Toggle item checked state
app.patch('/api/items/:id/toggle', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const item = db.toggleItem(parseInt(id, 10));
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Error toggling item:', error);
    res.status(500).json({ error: 'Failed to toggle item' });
  }
});

// Delete item
app.delete('/api/items/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    db.deleteItem(parseInt(id, 10));
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Get autocomplete suggestions
app.get('/api/suggestions', requireAuth, (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }
    const suggestions = db.getHistorySuggestions(q);
    res.json(suggestions.map(s => s.name));
  } catch (error) {
    console.error('Error getting suggestions:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// Start server
async function start() {
  await db.initializeDatabase();

  // Clear old checked items on startup
  const cleared = db.clearOldCheckedItems();
  if (cleared > 0) {
    console.log(`Cleared ${cleared} checked items older than 30 days`);
  }

  app.listen(PORT, () => {
    console.log(`Grocery List app running at http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
