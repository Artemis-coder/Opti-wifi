# Opti Wifi

A **React + Vite** based Wi‑Fi management SaaS prototype.

## Features
- State‑of‑the‑art UI built with TailwindCSS and modern React patterns.
- Uses **Neon** managed PostgreSQL as the backend database.
- Includes a `.env` file (ignored by git) with the `DATABASE_URL` for connecting to Neon.
- Basic scripts for development, building and previewing.

## Prerequisites
- Node.js (>=18)
- pnpm / yarn / npm (any package manager works)
- A Neon account and a project. You will need the connection string.

## Setup
```bash
# Clone the repo (if you haven't already)
git clone https://github.com/Artemis-coder/Opti-Wifi.git
cd Opti-Wifi

# Install dependencies
npm install   # or pnpm install / yarn install

# Create a .env file (it is already ignored by .gitignore)
# Replace the placeholder with your Neon connection string
echo "DATABASE_URL=postgres://<USER>:<PASSWORD>@<HOST>.neon.tech/<DB>?sslmode=require&channel_binding=require" > .env
```

## Development
```bash
npm run dev   # Starts Vite dev server
```

## Build
```bash
npm run build   # Produces production assets in the `dist/` folder
```

## Preview
```bash
npm run preview   # Serves the built assets locally
```

## Database Schema
The database schema is defined in `neon-schema.sql`. After creating the Neon database, you can apply the schema with:
```bash
psql $DATABASE_URL < neon-schema.sql
```

## Contributing
Feel free to open issues or submit pull requests. Ensure your changes are tested locally and follow the existing code style.

---
*Generated automatically by the AI assistant.*
