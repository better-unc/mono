# gitbruv

A GitHub alternative built with modern web technologies, featuring real Git repository support with S3-compatible storage. Available on web and mobile platforms.

## Tech Stack

### Frontend (Web)
- **Framework**: TanStack Start
- **UI**: shadcn/ui + Tailwind CSS
- **Data Fetching**: TanStack React Query
- **Icons**: Hugeicons
- **Code Highlighting**: Shiki
- **Diff Viewing**: Diffs by Pierre Computer Co.

### Backend
- **Runtime**: Bun
- **Framework**: Hono
- **Auth**: better-auth (email/password + passkeys)
- **Database**: PostgreSQL + Drizzle ORM
- **Storage**: Railway S3-compatible storage
- **Caching**: Redis (optional)
- **Git**: isomorphic-git + Git HTTP Smart Protocol

### Mobile
- **Framework**: Expo + React Native
- **Router**: Expo Router
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Auth**: better-auth with Expo support

### Infrastructure
- **Monorepo**: Turbo
- **Package Manager**: Bun
- **Hosting**: Railway

## Project Structure

```
gitbruv/
├── apps/
│   ├── web/              # TanStack Start web application
│   │   ├── app/          # Routes and pages
│   │   ├── components/   # React components
│   │   └── lib/          # Utilities and API client
│   ├── api/              # Hono API server
│   │   └── src/
│   │       ├── routes/   # API endpoints
│   │       ├── git/      # Git protocol handlers
│   │       └── middleware/
│   └── mobile/           # Expo React Native app
│       ├── app/          # Expo Router routes
│       └── components/   # React Native components
└── packages/
    ├── db/               # Drizzle ORM schema
    ├── hooks/            # Shared React hooks
    └── lib/              # Shared utilities
```

## Features

### Core Functionality
- **User Authentication**: Email/password and passkey (WebAuthn) support
- **Repository Management**: Create, fork, and manage public/private repositories
- **Git Operations**: Full Git HTTP Smart Protocol support (clone, push, pull)
- **File Browsing**: Navigate repository trees with syntax highlighting
- **Code Viewing**: View file contents with syntax highlighting and diff support
- **Commit History**: Browse commits by branch with detailed commit information

### Collaboration Features
- **Issues**: Create, manage, and track issues with labels, assignees, and comments
- **Issue Reactions**: React to issues and comments with emojis
- **Stars**: Star repositories to show appreciation
- **Forks**: Fork repositories to create your own copy

### User Features
- **Profiles**: Customizable user profiles with bio, location, and social links
- **Settings**: Manage account settings, email, password, and preferences
- **API Keys**: Generate and manage API keys for programmatic access
- **Passkeys**: Manage WebAuthn passkeys for passwordless authentication

### Mobile Support
- Native mobile app built with Expo
- Full feature parity with web application
- Optimized mobile UI with glass morphism effects

## Getting Started

### Prerequisites

- **Bun** 1.3.5+ (recommended) or Node.js 18+
- **PostgreSQL** database
- **Redis** (optional, for caching)
- **S3-compatible storage** (Railway, AWS S3, or compatible service)

### Setup

1. **Clone the repository**:

```bash
git clone <repository-url>
cd gitbruv
```

2. **Install dependencies**:

```bash
bun install
```

3. **Set up environment variables**:

Create a `.env` file in the root directory:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/gitbruv
BETTER_AUTH_SECRET=your-secret-key-here-at-least-32-characters

S3_ACCESS_KEY_ID=your-s3-access-key-id
S3_SECRET_ACCESS_KEY=your-s3-secret-access-key
S3_BUCKET_NAME=gitbruv-repos

REDIS_URL=redis://localhost:6379

EXPO_PUBLIC_API_URL=http://localhost:3001
```

4. **Set up the database**:

```bash
bun run db:push
```

5. **Start the development servers**:

For web development:
```bash
bun run dev:web
```

For mobile development:
```bash
bun run dev:mobile
```

This will start:
- API server on `http://localhost:3001`
- Web app on `http://localhost:3000`
- Mobile app (via Expo) on `http://localhost:8081`

## Git Operations

### Clone a Repository

```bash
git clone http://localhost:3001/api/git/username/repo.git
```

### Push to a Repository

```bash
cd your-repo
git push origin main
```

When prompted, enter your email and password (or use an API key).

### Using API Keys

You can generate API keys in your account settings and use them for authentication:

```bash
git config credential.helper store
git push origin main
# Enter your API key as the password
```

## Database Schema

The project uses Drizzle ORM with PostgreSQL. Key tables include:

- `users` - User accounts and profiles
- `repositories` - Git repositories
- `issues` - Issue tracking
- `labels` - Repository labels
- `issue_comments` - Issue comments
- `issue_reactions` - Reactions on issues and comments
- `stars` - Repository stars
- `api_keys` - API key management
- `passkeys` - WebAuthn passkeys

## Development

### Available Scripts

- `bun run dev:web` - Start web app and API server
- `bun run dev:mobile` - Start mobile app and API server
- `bun run build` - Build all applications
- `bun run lint` - Lint all packages
- `bun run db:push` - Push database schema changes
- `bun run db:studio` - Open Drizzle Studio

### Architecture

Git repositories are stored in S3-compatible storage as bare repositories. When Git operations occur:

1. Repository files are synced from S3 to a temporary directory
2. Git commands execute against the temporary directory using isomorphic-git
3. For push operations, changes are synced back to S3
4. Temporary directory is cleaned up

This architecture allows for serverless-compatible deployment while maintaining full Git compatibility.

### API Endpoints

The API server exposes the following main routes:

- `/api/auth/*` - Authentication endpoints (handled by better-auth)
- `/api/repositories/*` - Repository management
- `/api/git/*` - Git HTTP Smart Protocol
- `/api/issues/*` - Issue management
- `/api/users/*` - User management
- `/api/settings/*` - User settings
- `/api/file/*` - File operations

## Deployment

### Backend (API + Database + Storage)

Deploy to Railway:
1. Connect your repository to Railway
2. Set environment variables in Railway dashboard
3. Railway will automatically detect and deploy the API service

### Frontend (Web)

Deploy to Vercel:
1. Connect your repository to Vercel
2. Set the root directory to `apps/web`
3. Configure environment variables
4. Deploy

### Mobile

Build and deploy using Expo:
```bash
cd apps/mobile
bun run build:ios    # For iOS
bun run build:android # For Android
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.