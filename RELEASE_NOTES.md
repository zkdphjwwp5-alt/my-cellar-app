# My Cellar v0.5 — AI Label Recognition

## Replace
- App.jsx

## Add
- supabase/functions/analyze-wine-label/index.ts

## Supabase setup
Deploy the Edge Function named `analyze-wine-label`.
Add a Supabase secret called `OPENAI_API_KEY`.

## Result
- Scan Bottle opens the camera.
- Photo is sent to the Edge Function.
- AI extracts producer, wine name and vintage.
- Existing wine opens if there is a strong match.
- Otherwise, the new wine form is pre-filled.
