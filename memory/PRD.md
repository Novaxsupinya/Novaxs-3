# Novaxs E-commerce Platform PRD

## Overview
Hands-free e-commerce platform built with React + FastAPI + MongoDB, featuring automated dropshipping fulfillment via CJ Dropshipping.

## Core Architecture
- **Frontend**: React SPA with Tailwind CSS + Shadcn UI
- **Backend**: FastAPI with async MongoDB (motor)
- **Database**: MongoDB
- **Payments**: Stripe Checkout (sole payment method)
- **Fulfillment**: CJ Dropshipping API (auto-order on payment)
- **Emails**: Resend API

## Implemented Features (Complete)
- [x] User authentication (JWT)
- [x] Product catalog (138 items synced from CJ)
- [x] Shopping cart
- [x] Checkout flow with Stripe
- [x] Order management
- [x] Admin dashboard
- [x] Contact form with email
- [x] Auto product sync from CJ (every 6 hours)
- [x] Auto tracking sync (every 30 minutes)
- [x] Background CJ order creation on payment

## Payment Flow
1. Customer completes checkout form
2. Order created in DB (pending)
3. Redirect to Stripe hosted checkout
4. On success, Stripe webhook triggers:
   - Order status → paid/processing
   - CJ Dropshipping order created
   - Confirmation email sent
5. Tracking synced from CJ automatically

## API Endpoints
- `POST /api/checkout/stripe` - Create Stripe session
- `GET /api/checkout/status/{session_id}` - Poll payment status
- `POST /api/webhook/stripe` - Stripe webhook (triggers CJ fulfillment)
- `POST /api/orders` - Create order
- `GET /api/products` - Product catalog
- `GET /api/admin/orders` - Admin order management

## Environment Variables
- `STRIPE_API_KEY` - Stripe test/live key
- `CJ_API_KEY` - CJ Dropshipping API key
- `RESEND_API_KEY` - Email service key
- `MONGO_URL`, `DB_NAME` - Database config

## Credentials
- Admin: novaxs6969@gmail.com / NovaxsAdmin2024!

## Session Log (Dec 2025)
- PayPal fully removed from codebase
- Stripe integrated as sole payment method
- Stripe webhook triggers CJ fulfillment directly
- No wallet top-up dependency on user side

## Upcoming
- [ ] Production deployment to novaxs.com
- [ ] Advanced admin analytics
