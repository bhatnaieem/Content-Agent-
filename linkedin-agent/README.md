# LinkedIn Weekend Agent

A small Next.js/Vercel agent that connects to a personal LinkedIn account, generates one original LinkedIn post with Gemini, generates a supporting image with Pollinations, uploads the image to LinkedIn, and publishes the post every Sunday.

## Stack
- Next.js 14 + Vercel Cron
- Gemini API for post generation
- Pollinations for image generation
- LinkedIn OAuth + Posts API + Images API
- Supabase for encrypted LinkedIn tokens and post history

## Setup
1. In Supabase, run `supabase/schema.sql`.
2. Create a LinkedIn developer app and configure the OAuth redirect URI to `/api/auth/linkedin/callback`. Request `openid`, `profile`, and `w_member_social`.
3. Add all values from `.env.example` to the Vercel project.
4. Set the Vercel project root directory to `linkedin-agent`.
5. Deploy the `linkedin-agent` branch.
6. Open the deployment and click **Connect LinkedIn** once.
7. The production Vercel Cron invokes `/api/cron` every Sunday at 04:30 UTC (10:00 AM IST, subject to Vercel Hobby's scheduling window).

## Content controls
Set `LINKEDIN_PROFILE_CONTEXT`, `LINKEDIN_TOPICS`, and `LINKEDIN_TONE` to shape the agent's voice.

## Image note
Gemini's current native image models are not included in the Gemini API free tier. This build therefore keeps Gemini for free text generation and uses Pollinations for the image. If you later want Gemini to generate the image too, swap `generateImage()` for a paid Gemini image model.

## Security
- LinkedIn tokens are encrypted before being stored in Supabase.
- `CRON_SECRET` protects manual/cron execution.
- Never commit `.env` or API keys.
