# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Telegram Mini App (app.dghostmarket.uz, opened from @dghostmarketbot) plus the same app in a regular browser; marketing site at dghostmarket.uz (separate repo `dghostmarket-site`).

## Users

**Primary: buyers of CS2 skins in Uzbekistan.** Players, mostly on a phone, inside Telegram. They want to buy a skin for sum quickly and without getting scammed: see the exact item, its price against the market, pay with their own bank card, and receive it in Steam.

Secondary (served, but buyer decisions win on conflict):
- **Sellers** — players and resellers listing their Steam inventory; want a fast sale and money on their card.
- **PRO sellers and guarantors** — channel owners and shops on paid tiers (Старт / PRO / Бизнес / Гарант) who publish lots, run auctions and free raffles in their own channels; guarantors also buy skins instantly from sellers («Продать гаранту»).
- **Admins and support staff** — moderate KYC, payments, withdrawals, disputes and support tickets from the same app (admin panel behind 2FA).

## Product Purpose

A peer-to-peer CS2 skin marketplace where the platform acts as escrow. Items move directly between users' Steam accounts; the platform holds the money, enforces deadlines and pays the seller only after the trade can no longer be reversed. Success: a first-time buyer completes a purchase without fear, and sellers come back to list again.

## Positioning

What a chat deal or a foreign marketplace cannot truthfully claim together:
- **Escrow + 8-day hold.** The buyer's payment stays with the platform until the skin arrives; the seller is paid 8 days after payment — longer than Steam's 7-day trade-reversal window. Not delivered within 24 hours → automatic refund.
- **Sum and local cards.** Prices and payments in Uzbek sum, by transfer from the buyer's own card (with receipt) or from balance; no dollars, no crypto.
- **Entirely inside Telegram.** Mini app + bot, login with Telegram, no separate registration.
- **Own 3D/AR render of the actual lot.** Models built from game files, showing the listing's float, pattern and stickers; AR places the item at real size on a desk.

## Operating Context

- Buyer flow: catalog (filters by weapon, quality, float, price) → lot → pay by card transfer or balance → seller sends a Steam trade within 24 h → buyer accepts and taps «Получил» or opens a dispute.
- Seller flow: one-time verification (phone via Telegram, ID photo, selfie) → list from Steam inventory (photo, float, stickers pulled automatically, market-price hint; «Все по рынку −3%») → send the trade within 24 h → money on balance after 8 days → withdrawal to own card.
- «Продать гаранту»: a seller picks a guarantor and sends a request; the guarantor accepts and buys instantly at a discount; no passport needed for this path.
- Steam trade bans are shown as a countdown on the lot; the lot becomes buyable when it ends.
- Lots are shared to chats via the bot's inline mode (lot cards) and to channels by PRO sellers.
- Languages: Russian, Uzbek, English — every user-facing string exists in all three.

## Capabilities and Constraints

- Fees: buyer 0%; seller 5% of the sale (the platform's only income per deal; personal rates possible); withdrawal 0%, minimum 50 000 сум. A move to 3.5% is planned when the LLC launches — not live.
- Rules/offer are accepted before the first deal (purchase, listing, top-up, withdrawal), enforced by the server; browsing is open.
- Admin money actions require TOTP 2FA; admin web actions additionally require a fresh login.
- New accounts have purchase limits; large purchases may require identity verification.
- Payment and auth contracts are not changed without the owner's approval.
- Static front end on GitHub Pages (plain HTML/CSS/JS, no framework, no build step); `?v=` cache-busting on every changed asset (`tools/version-check.js`); lazily loaded `app-3d.js` / `app-admin.js`. Backend: Python bot + API on Railway (separate repo).
- Raffles are always free to enter; no gambling, cases or betting — a legal requirement (NAPP), not a style choice.
- Operator: ИП Ахмадбеков Нодирбек Сардорбек угли (свидетельство № 8026051, ИНН 633585243), Tashkent; legal documents served by the bot at api.dghostmarket.uz/legal.
- Undecided: LLC launch date, the 3.5% fee date, any online payment provider (none active).

## Brand Commitments

- Name: **DGhostMarket** (bot @dghostmarketbot, channel @dghostmarket, support @dghostmarketsupportbot, support@dghostmarket.uz).
- Logo: the hooded ghost with headphones pushing a cart with a case, knife and rifle, «DGhost MARKET» lettering — `logo.webp` / `logo.PNG` here, `logo-h120.webp` / `logo-h240.webp` on the site. Use the real logo, not a typed wordmark.
- Voice: direct, plain, «ты» in the app; trust claims stay factual (escrow, 24 h, 8 days, 5%).
- Not affiliated with Valve; the disclaimer stays on public pages.

## Evidence on Hand

- Live listings and market prices (API `/api/skins`), PRO tiers (`/api/pro/tiers`).
- 3D/AR renderer and models (3d.dghostmarket.com, `app-3d.js`, embeddable `embed.html`).
- Logo and icons in this repo; training videos exist for some flows.
- **No testimonials, reviews, deal counts, press or partner logos are available** — do not invent them. Lot count is currently small (single digits); avoid surfacing it as social proof until it grows.

## Product Principles

1. **Safety is the product.** Every buying screen answers «where is my money and what happens if the seller fails» before asking for payment.
2. **Phone-first, Telegram-native.** Design for one hand, a mid-range Android and mobile data first; desktop browser is secondary.
3. **The real item, honestly priced.** Show the actual lot (3D, float, pattern) and its price next to the market — never fake urgency or proof.
4. **No barrier before value.** Visitors see the market immediately; rules and verification appear only when an action needs them.
5. **Three languages are first-class.** No screen ships with a missing RU/UZ/EN string.

## Accessibility & Inclusion

- Works on low-end Android and slow connections (3G in the regions): heavy assets load lazily, motion respects «reduce motion» and data-saver.
- Readable in Russian, Uzbek (Latin) and English with long-word layouts in mind.
