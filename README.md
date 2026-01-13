# gitbruv

A GitHub clone built with Next.js, featuring real Git repository support with Cloudflare R2 storage.

## Tech Stack

### Frontend
- **Web**: TanStack Router (React) + shadcn/ui + Tailwind CSS
- **Mobile**: React Native / Expo
- **Data Fetching**: TanStack React Query

### Backend
- **API**: Rust (Axum) - High-performance business logic & Git operations
- **Auth**: better-auth (TypeScript) - Authentication & session management
- **Database**: PostgreSQL + Drizzle ORM
- **Storage**: Cloudflare R2 (S3-compatible)
- **Git**: Rust (gix) + Git HTTP Smart Protocol


## Getting Started

### Prerequisites

- **Node.js 18+** or **Bun** (for web/mobile apps)
- **Rust** (latest stable) + **Cargo** (for API)
- **PostgreSQL** database
- **Git** installed on your system
- **Cloudflare account** with R2 enabled

### Cloudflare R2 Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2
2. Create a bucket named `gitbruv-repos`
3. Go to R2 → Manage R2 API Tokens → Create API Token
4. Select "Object Read & Write" permissions
5. Copy the Account ID, Access Key ID, and Secret Access Key

### Setup

1. Clone and install dependencies:

```bash
bun install
```

2. Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/gitbruv

# Authentication
BETTER_AUTH_SECRET=your-secret-key-here-at-least-32-characters
BETTER_AUTH_URL=http://localhost:3000

# Cloudflare R2 Storage
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=gitbruv-repos

# API URLs
API_URL=http://localhost:3001
VITE_API_URL=http://localhost:3001

# Web App URLs (optional)
RAILWAY_PUBLIC_DOMAIN=localhost:3000
VITE_RAILWAY_PUBLIC_DOMAIN=localhost:3000

# Mobile App URLs (optional)
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_AUTH_URL=http://localhost:3000

# Rust API Port (optional, defaults to 3001)
PORT=3001
```

3. Push the database schema:

```bash
bun run db:push
```

4. Start the services:

```bash
# Terminal 1: Start Rust API (port 3001)
cd apps/api
cargo run

# Terminal 2: Start Web App (port 3000)
bun run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Features

- User authentication (sign up, sign in, sign out)
- Create public/private repositories
- Browse repository files
- View file contents with syntax highlighting
- Clone repositories via HTTP
- Push to repositories via HTTP (with authentication)
- Markdown README rendering
- Cloud storage with Cloudflare R2 (zero egress fees)

## Project Structure

```
gitbruv/
├── apps/
│   ├── api/              # Rust API (Axum) - Port 3001
│   │   └── src/
│   │       ├── auth.rs   # Session caching & validation
│   │       ├── routes/   # API endpoints
│   │       └── git/      # Git HTTP Smart Protocol
│   ├── web/              # Web App (TanStack Router) - Port 3000
│   │   ├── app/          # Routes & pages
│   │   └── lib/          # API client, auth client
│   └── mobile/           # Mobile App (React Native/Expo)
├── packages/
│   ├── auth/             # better-auth configuration
│   └── db/               # Database schema (Drizzle ORM)
```

## Git Operations

Clone a repository:

```bash
git clone http://localhost:3001/username/repo.git
```

Push to a repository (requires auth):

```bash
git push origin main
# Enter your email and password when prompted
```

## Architecture

### Authentication Flow
- **better-auth** (web app) handles login/signup and creates sessions in PostgreSQL
- **Rust API** validates sessions via in-memory cache with database fallback
- Both services share the same PostgreSQL database as the source of truth

### Git Storage
Git repositories are stored in Cloudflare R2 as bare repos. When git operations occur:

1. Repository files are synced from R2 to a temp directory
2. Git commands execute against the temp directory using Rust (gix)
3. For push operations, changes are synced back to R2
4. Temp directory is cleaned up

This allows serverless deployment while maintaining full Git compatibility.
