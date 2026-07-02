# HealthAge Admin

HealthAge Admin is a Next.js admin console for managing platform admins, workspaces, workspace members, and workspace access entitlements.

## Requirements

- Node.js 20 or newer
- pnpm, npm, yarn, or bun
- A running HealthAge backend API

The lockfile in this repository is `pnpm-lock.yaml`, so pnpm is the preferred package manager.

## Setup

Install dependencies:

```bash
pnpm install
```

Create `.env.local` in the project root and add the values below.

## Environment Variables

```env
BACKEND_API_BASE_URL=http://localhost:8091/api/v1
NEXT_PUBLIC_APP_ENV=development
```

`BACKEND_API_BASE_URL` points to the backend API. It can be either the backend root, such as `http://localhost:8091`, or the versioned API root, such as `http://localhost:8091/api/v1`. The proxy normalizes both forms.

`NEXT_PUBLIC_APP_ENV=development` enables the development-only first-admin bootstrap and promote-to-admin tools. These tools are hidden and blocked client-side outside development.

## Running Locally

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Common alternatives:

```bash
npm run dev
yarn dev
bun dev
```

## Build and Production

Create a production build:

```bash
pnpm build
```

Run the production server after building:

```bash
pnpm start
```

## Available Scripts

- `pnpm dev` starts the Next.js development server.
- `pnpm build` builds the app for production.
- `pnpm start` starts the production server.

## App Routes

- `/` is the admin login and dashboard route.
- `/workspace-admin` lets a workspace admin register for approval.
- `/forgot-password` handles OTP-based password reset.
- `/api/proxy/[...path]` proxies frontend API calls to the backend.

## Authentication and Access

The frontend stores the signed-in user's access token and user details in `localStorage` using:

- `healthage.admin.token`
- `healthage.admin.user`

On login, the app fetches `entitlements/me` and allows access only when the user is a platform admin or an active workspace owner/admin member.

## API Proxy

Client-side API calls use `src/lib/admin/api.ts`, which sends requests to the local Next.js proxy at `/api/proxy/*`.

The proxy route in `src/app/api/proxy/[...path]/route.ts` forwards requests to the backend and passes through these headers when present:

- `Content-Type`
- `Authorization`
- `x-bootstrap-token`

This keeps backend URLs and bootstrap tokens out of direct browser API targets.

## Development Bootstrap

When `NEXT_PUBLIC_APP_ENV=development`, the app exposes development tools for:

- creating the first platform admin
- promoting an existing user to platform admin

Both flows require the backend bootstrap token in the `x-bootstrap-token` header.

## Project Structure

- `src/app` contains Next.js routes and route handlers.
- `src/components/admin` contains the admin login and dashboard UI.
- `src/components/workspaces` contains workspace admin signup UI.
- `src/components/ui` contains reusable UI pieces.
- `src/lib/admin` contains API, environment, storage, and entitlement helpers.
- `src/types/admin.ts` contains admin API response and UI state types.

## Notes

- The backend must be running before login, dashboard loading, workspace management, and password reset flows will work.
- There are no test scripts configured in `package.json` yet.
- Use development bootstrap tools only for local development or controlled non-production setup.
