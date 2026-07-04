# My Cellar v0.3 — Bottle Photo Upload

## Files changed
- App.jsx
- PhotoUploader.jsx
- style.css

## Supabase setup
Run `supabase-storage-setup.sql` in Supabase SQL Editor before testing photo uploads.

## Acceptance test
- Open a wine detail page
- Tap Upload photo
- Take/select a bottle photo
- Photo uploads to Supabase Storage
- `wines.photo_url` updates
- Photo appears immediately on the detail page
