# iSide Shorts Studio

A no-key, browser-first Shorts/Reels tool.

## Current workflow

1. Upload one long video from your device.
2. Press **Create 4 Shorts**.
3. The browser uses FFmpeg WASM locally to create four separate 9:16 MP4 files.
4. Review or edit each clip's start/end time.
5. Pick one posting date and four separate time slots.
6. Share each MP4 to Instagram or Facebook.

## No API keys

This project does not require:

- YouTube API
- Groq/OpenAI API
- Instagram Graph API
- Facebook Graph API
- Supabase
- Any server secret

There is no required `.env` setup.

## Sharing and scheduling

On supported phones, the Share button passes the actual rendered MP4 to the operating-system share sheet, where Instagram or Facebook can be chosen.

On desktop, the site downloads the MP4 and opens Instagram/Facebook in a new tab.

Because there is no Meta API/account integration, the browser cannot programmatically fill Instagram/Facebook's upload field or press their future-schedule control. The website therefore keeps the chosen date/time visible for each reel so the final schedule can be set inside Instagram, Facebook, or Meta Business Suite.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
