# Keystone — Design System

Reference: Stessa (stessa.com) — clean, trustworthy fintech-for-landlords look.

## Color
- Primary blue `#2F6EB5` (hover `#245A96`), navy `#1B3A5C`, soft blue tint `#E8F0FB`
- Ink `#1A2433` (headings), body `#3D4A5C`, muted `#6B7789`
- Surface `#FFFFFF`, app background `#F4F6F9`, borders `#E1E6ED`
- Success `#1E8E5A` / tint `#E5F5EC`; Warning `#B7791F` / tint `#FDF3E1`; Danger `#C53030` / tint `#FBE9E9`
- Marketing hero: deep navy `#0B1F3A` with blue accent.

## Typography
- Font: "Noto Sans" (Google, matches Stessa) for everything; headings 700–800, body 400/600.
- Page title 28px/800, section title 18px/700, body 14–15px, table 14px, labels 12px uppercase tracking-wide muted.

## Layout
- App shell: top bar (64px, logo + "Manage / Reports / Plans" tabs + portfolio selector + user menu) and a left icon rail (72px collapsed / 248px expanded) with grouped sections:
  Dashboard, Manage Users · Properties (Properties, Listings, Maintenance) · Transactions (Rent Collection, Cash Management, Invoices) · Tenants (Screening, Leases, Tenants) · Resources (Documents, Reports) · Plans & Billing.
- Page header: square tinted icon tile (44px) + title + right-aligned filter/actions (like Stessa "Dashboard [All Properties]").
- Cards: white, 1px border, 8px radius, header row with title + info icon, divider, body.
- Tables: zebra-free, row dividers, 48px rows, status pills.
- Setup Guide floating card bottom-left of dashboard with progress bar and expandable steps.

## Components
- Buttons: primary solid blue, secondary outlined blue (white bg, blue 1px border, blue text — "Track Rental Income" style), ghost.
- Status pills: rounded-full, tint bg + strong text.
- Plan gates: lock icon + "Upgrade to Manage/Pro" inline card.

## Motion
- Subtle fade/slide-up on page mount (motion), staggered on dashboard cards. No gratuitous animation.
