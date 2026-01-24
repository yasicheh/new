# Shared Grocery List App

A simple web app for two partners to maintain a shared grocery list. Both people can add items, check them off, and see updates when they refresh.

## Features

- **Shared list** - Single list accessible by anyone with the password
- **Add items** - Quick input with autocomplete from history
- **Check/uncheck items** - Tap to mark items as done
- **Item history** - Autocomplete suggestions from previously added items
- **Auto-clear** - Checked items automatically removed after 30 days
- **Mobile-first** - Designed for use on phones at the store
- **Password protected** - Simple shared password authentication

## Quick Start

### Prerequisites

- Node.js 18+

### Installation

```bash
# Install dependencies
npm install

# Create your .env file (or use defaults)
cp .env.example .env

# Edit .env to set your password
# PASSWORD=your_shared_password

# Start the server
npm start
```

The app will be running at `http://localhost:3000`

### Default credentials

- **Password**: `groceries123` (change this in `.env`)

## Deployment

### Railway

1. Push your code to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Connect your GitHub repo
4. Add environment variable: `PASSWORD=your_secure_password`
5. Deploy!

### Fly.io

```bash
# Install flyctl and login
fly launch

# Set the password secret
fly secrets set PASSWORD=your_secure_password

# Deploy
fly deploy
```

Create a `fly.toml`:

```toml
app = "your-grocery-app"
primary_region = "iad"

[http_service]
  internal_port = 3000
  force_https = true

[env]
  PORT = "3000"
```

### Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your GitHub repo
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variable: `PASSWORD=your_secure_password`

### Vercel

Note: Vercel works best with serverless, but this app uses SQLite. For Vercel, consider switching to a hosted database like Turso or PlanetScale.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/items` | Get all grocery items |
| POST | `/api/items` | Add a new item |
| PATCH | `/api/items/:id/toggle` | Toggle item checked state |
| DELETE | `/api/items/:id` | Delete an item |
| GET | `/api/suggestions?q=` | Get autocomplete suggestions |

## Project Structure

```
/grocery-app
  /frontend
    index.html      # Main app page
    styles.css      # Mobile-first styles
    app.js          # Frontend JavaScript
  /backend
    server.js       # Express server & API
    database.js     # SQLite database layer
  .env              # Environment variables (not in git)
  .env.example      # Example environment file
  package.json      # Dependencies
  README.md         # This file
```

## Data Storage

The app uses SQLite stored in `grocery.db`. The database is created automatically on first run.

**Tables:**
- `items` - Active grocery list items
- `item_history` - All items ever added (for autocomplete)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PASSWORD` | Shared password for access | `grocery` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | Path to SQLite database | `./grocery.db` |

## License

MIT
