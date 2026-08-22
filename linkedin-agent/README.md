# LinkedIn Weekend Agent

A deliberately simple standalone Next.js/Vercel agent. After one-time LinkedIn connection, it automatically publishes one AI-written LinkedIn post with an AI-generated image every Sunday.

## Content
The agent is restricted to **marketing, entrepreneurship and business in India**. Gemini chooses a fresh angle each week from Indian startups, D2C, MSMEs, consumer behaviour, advertising, branding, digital marketing, AI in business, founders, distribution, sales, business models and market opportunities.

## Flow
Sunday cron → Gemini writes post + image prompt → image generated → image uploaded to LinkedIn → post published → history recorded.

No weekly approval, manual run or research workflow is required.

## Setup
1. Run `supabase/schema.sql` in Supabase.
2. Create a LinkedIn developer app and configure the OAuth callback `/api/auth/linkedin/callback` with `openid`, `profile`, and `w_member_social`.
3. Add the variables in `.env.example` to Vercel.
4. Deploy this directory as a standalone Vercel project with Root Directory `linkedin-agent`.
5. Open the deployed site and click **Connect LinkedIn** once.
6. The configured Sunday cron runs automatically.

Gemini is used for text generation. Pollinations is used for images so the text workflow can remain on the free Gemini API tier.
