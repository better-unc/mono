# gitbruv

A GitHub clone built with Next.js, featuring real Git repository support with Cloudflare R2 storage.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Auth**: better-auth (email/password)
- **Database**: PostgreSQL + Drizzle ORM
- **Storage**: Cloudflare R2 (S3-compatible)
- **UI**: shadcn/ui + Tailwind CSS
- **Data Fetching**: TanStack React Query
- **Git**: isomorphic-git + Git HTTP Smart Protocol

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL database
- Git installed on your system
- Cloudflare account with R2 enabled

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

2. Create a `.env` file with the following variables:

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/gitbruv
BETTER_AUTH_SECRET=your-secret-key-here-at-least-32-characters
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
INTERNAL_AUTH_URL=http://localhost:3000/api/auth/verify-credentials
BETTER_AUTH_SECRET=your-internal-auth-secret

# Cloudflare R2 Configuration
AWS_ACCOUNT_ID=your-cloudflare-account-id
AWS_ACCESS_KEY_ID=your-r2-access-key-id
AWS_SECRET_ACCESS_KEY=your-r2-secret-access-key
AWS_BUCKET_NAME=gitbruv-repos
```

3. Push the database schema:

```bash
bun run db:push
```

4. Start the development server:

```bash
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
app/
├── (auth)/          # Auth pages (login, register)
├── (main)/          # Main app pages
│   ├── [username]/  # User profile & repos
│   └── new/         # Create repository
├── api/
│   ├── auth/        # better-auth API
│   └── git/         # Git HTTP Smart Protocol
actions/             # Server actions
components/          # React components
db/                  # Database schema & connection
lib/                 # Utilities, auth config, R2 integration
```

## Git Operations

Clone a repository:

```bash
git clone http://localhost:3000/api/git/username/repo.git
```

Push to a repository (requires auth):

```bash
git push origin main
# Enter your email and password when prompted
```

## Architecture

Git repositories are stored in Cloudflare R2 as bare repos. When git operations occur:

1. Repository files are synced from R2 to a temp directory
2. Git commands execute against the temp directory
3. For push operations, changes are synced back to R2
4. Temp directory is cleaned up

This allows serverless deployment while maintaining full Git compatibility.
