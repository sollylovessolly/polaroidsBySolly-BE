# PolaroidsBySolly API

Backend for the PolaroidsBySolly customer storefront and future administration application. It owns catalogue pricing, fulfillment validation, inventory, payments, delivery, tracking, costs, profit, and business reporting. No frontend code lives in this repository.

## Stack and architecture

- NestJS 11 and TypeScript
- Prisma 7 with PostgreSQL/Neon
- Paystack transaction initialization, server verification, and signed webhooks
- Supabase private object storage behind backend download URLs
- Optional Meta WhatsApp, Resend email, and Shipbubble delivery providers
- Global DTO validation, admin bearer authentication, rate limiting, Helmet, restricted CORS, and safe production errors

Business functionality is split into Nest modules. Prisma transactions protect order creation, inventory movements, purchases, payment finalization, and cancellation returns. External notification and shipment calls run only after database payment transactions commit.

## Installation

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run start:dev
```

Swagger is served at `http://localhost:4000/api/docs`. Health endpoints are `GET /api/health` and `GET /api/health/ready`.

## Configuration

Use [.env.example](./.env.example) as the authoritative variable list. Never commit `.env` or provider secrets.

Critical production values are `DATABASE_URL`, `DIRECT_URL`, `FRONTEND_URL`, `JWT_SECRET`, and `PAYSTACK_SECRET_KEY`. `JWT_SECRET` must contain at least 32 characters. Production frontend origins must use HTTPS. `ADMIN_EMAIL` and `ADMIN_PASSWORD` are consumed by the idempotent seed to bootstrap or rotate the owner account.

Provider configuration is optional during local development:

- Paystack: keep `PAYSTACK_SECRET_KEY=sk_test_...` until business live activation. Switching later is an environment-only change to `sk_live_...`.
- Shipbubble: start with an `sb_sandbox_...` key. Without a key, payment remains operational and shipment creation reports `PROVIDER_DISABLED`.
- Supabase: configure the service-role key only on the backend and keep the bucket private.
- Email: set `RESEND_API_KEY`, `EMAIL_FROM`, and optionally
  `OWNER_NOTIFICATION_EMAIL` (falls back to `ADMIN_EMAIL`).
- Discord: set `DISCORD_WEBHOOK_URL` to notify the owner about paid orders.
- Telegram: set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_OWNER_CHAT_ID`.
- SMS: set the Termii API key, approved sender ID, channel, and owner phone.
- WhatsApp: set Meta Cloud API token, phone-number ID, and owner phone.

## Database operations

Development and production-safe migration command:

```bash
npx prisma migrate deploy
```

Never run `prisma migrate reset` against production. The seed is idempotent and ensures catalogue master data, variants, resources, consumption rules, Lagos delivery, inactive example discount codes, and an optional admin account.

## Core workflows

Upload limits are 2 MB for previews, 15 MB for production PNGs, and 20 MB
for production PDFs. Order customization accepts only opaque references issued
by the matching backend upload purpose.

### Website order

Catalogue and backend availability → private production-file references → website order → authoritative delivery and discount pricing → Paystack test checkout → server verification/webhook → inventory and frozen profit transaction → notifications and Shipbubble attempt → secure tracking.

Website clients must send a stable `checkoutKey`. A repeated key returns the
same order, and the returned unguessable `checkoutToken` can recover an unpaid
checkout at `GET /api/orders/checkout/:token`. Paystack initialization reuses a
pending authorization for 30 minutes. Shipbubble selections are bound to the
quoted customer/address/cart and expire after 30 minutes. The current pricing
policy intentionally charges the configured state delivery fee; courier quote
totals are displayed for selection and the actual courier fee is frozen after
shipment creation.

The client submits a discount code, never a discount amount. `POST /api/shipping/rates` validates the recipient address and returns customer-safe Shipbubble choices. The selected opaque `requestToken`, `serviceCode`, and `courierId` are submitted with the order; Shipbubble remains the authority for the charged courier cost.

### Manual order

Admin creates a `WHATSAPP`, `INSTAGRAM`, or `MANUAL` order → records trusted `TRANSFER` or `OPAY` payment → the same inventory, profit, notification, and shipment finalization path runs.

### Restock

Purchase → purchase items converted to base units → weighted-average cost → resource balance → linked `PURCHASE` resource movements.

### Profit

`grossProfitSnapshot = revenueSnapshot - materialCostSnapshot - packagingCostSnapshot - outsourceCostSnapshot - deliveryCostSnapshot`.

`deliveryFee` is charged to the customer; `actualDeliveryCost` is the courier charge. Owner withdrawals are cash distributions and do not reduce business profit.

### Cancellation

Cancellation never initiates an automatic refund. Paid orders remain financially paid. Inventory is restored only after explicit admin confirmation and uses exact historical `ORDER_USAGE` movements to create positive `RETURN` movements.

## Authentication and API conventions

Login with `POST /api/auth/admin/login`, then send `Authorization: Bearer <token>`. Routes are default-deny unless explicitly marked public. Admin list endpoints use `page` and `limit` (maximum 100) and return:

```json
{
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

Public routes cover health, active catalogue, checkout delivery reads, website order creation, Paystack checkout/verification/webhook, uploads, and customer-safe tracking. Swagger contains request DTOs and endpoint authorization behavior.

## Shipbubble

The implementation follows Shipbubble's current API contract: Bearer authentication and `POST /v1/shipping/labels` using a Rates API `request_token`, `service_code`, and `courier_id`. Successful labels persist the Shipbubble order ID, status, tracking URL, and `payment.shipping_fee`. The fee refreshes only courier-cost and gross-profit snapshots; material costs are never recalculated.

Failed shipment creation does not affect payment or inventory. Admin retry: `POST /api/orders/:id/shipment/retry`. One active shipment is allowed per order.

## Commands

```bash
npm run start:dev
npm run lint
npx tsc --noEmit
npm test -- --runInBand
npm run test:e2e
npm run build
npm run start:prod
```

`npm run start:prod` expects a prior successful build. Deployment should run dependency installation, `npx prisma migrate deploy`, `npm run build`, then `npm run start:prod`, and use `/api/health/ready` as the readiness check.

## Deployment checklist

1. Provision Neon/PostgreSQL and set pooled/direct URLs.
2. Configure HTTPS storefront/admin origins and a strong JWT secret.
3. Keep Paystack in test mode until live activation; configure signed webhook URL.
4. Configure private storage and optional notification/shipping sandbox providers.
5. Run migrations, idempotent seed, build, tests, and readiness check.
6. Log in with the bootstrapped admin and rotate/remove bootstrap password from runtime configuration where supported by the host.
