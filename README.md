# Hono Checkout Flow

A full-stack e-commerce checkout API and frontend, built as a learning project exploring Hono, Drizzle ORM, JWT authentication, RabbitMQ messaging, and a React/Vite frontend — all within a pnpm workspace monorepo.

## Tech Stack

**Backend** (`backend/`)

- [Hono](https://hono.dev/) — lightweight TypeScript web framework
- [Drizzle ORM](https://orm.drizzle.team/) + PostgreSQL 16
- [Zod](https://zod.dev/) — schema validation
- JWT authentication (`jsonwebtoken`) with role-based authorization (customer / admin)
- [bcryptjs](https://www.npmjs.com/package/bcryptjs) — password hashing
- [RabbitMQ](https://www.rabbitmq.com/) (`amqplib`) — order-placed event queue, with a standalone consumer process
- [Vitest](https://vitest.dev/) — unit/integration tests

**Frontend** (`frontend/`)

- React + [Vite](https://vitejs.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (Radix primitives)
- [React Router](https://reactrouter.com/) v7 (declarative mode)
- [TanStack Query](https://tanstack.com/query) — server state
- [Zustand](https://zustand-demo.pmnd.rs/) — client state (auth, cart), persisted to `localStorage`
- [React Hook Form](https://react-hook-form.com/) + Zod resolvers
- [Axios](https://axios-http.com/) — with an interceptor that auto-attaches the JWT to every request
- [Playwright](https://playwright.dev/) — end-to-end tests, run against Chromium, Firefox, and WebKit

## Features

- Full CRUD on customers, addresses, products, discounts, orders, payments, and shipments
- JWT auth with two roles: `customer` (scoped to their own data) and `admin` (full access)
- Guest checkout support (orders can be placed without an account)
- Server-side order total calculation (tax, shipping, discount) — never trusted from the client
- Discount codes with live validation on the checkout page
- Order status state machine (`pending` → `paid` → `fulfilling` → `shipped` → `delivered`, plus `cancelled`/`refunded`), including customer self-service cancellation
- RabbitMQ event published on every order placement, consumed by a separate process
- 137 backend tests (Vitest) and 30 end-to-end scenarios (Playwright, 3 browsers)

## Prerequisites

- Node.js 24+ (managed via [nvm-windows](https://github.com/coreybutler/nvm-windows) or your platform's equivalent)
- [pnpm](https://pnpm.io/)
- Docker Desktop (for PostgreSQL and RabbitMQ)

## Setup

1. **Clone and install:**

git clone https://github.com/bbornino/hono_checkout_flow.git
cd hono_checkout_flow
pnpm install

2. **Start PostgreSQL and RabbitMQ** (via Docker — see `docker ps` for existing containers, or create new ones):

docker start pg16-hono rabbitmq-hono

3. **Environment variables** — create `backend/.env`:

DATABASE_URL=postgres://postgres:postgres@localhost:5433/hono_checkout_flow
RABBITMQ_URL=amqp://guest:guest@localhost:5672
JWT_SECRET=your-dev-secret-here
TEST_BASE_URL=http://localhost:3000

and `frontend/.env`:

VITE_API_URL=http://localhost:3000

4. **Run migrations and seed the database:**

cd backend
pnpm drizzle-kit migrate
pnpm seed

## Running the App

This is a two-server setup — run each in its own terminal:
Terminal 1 — backend (http://localhost:3000)

cd backend
pnpm dev

Terminal 2 — frontend (http://localhost:5173)

cd frontend
pnpm dev

Optionally, run the RabbitMQ consumer in a third terminal to see order-placed events logged in real time:

cd backend
pnpm consumer

## Seeded Test Accounts

| Role     | Email                | Password   |
| -------- | -------------------- | ---------- |
| Admin    | `admin@hono.test`    | `admin`    |
| Customer | `customer@hono.test` | `customer` |

## Testing

Backend unit/integration tests

cd backend
pnpm test

Frontend end-to-end tests (requires both dev servers running)

cd frontend
pnpm exec playwright test

## Project Structure

hono_checkout_flow/
backend/
src/
features/ # one router per resource (customers, orders, etc.)
middleware/ # requireAuth, requireAdmin, cors
db/ # Drizzle schema and connection
scripts/ # health-check scripts (server, database, RabbitMQ)
frontend/
src/
pages/ # route-level components
components/ # shared UI (Navbar, shadcn components)
stores/ # Zustand stores (auth, cart)
lib/ # Axios client
tests/ # Playwright E2E specs

## Author

[Brian Bornino](https://github.com/bbornino)
