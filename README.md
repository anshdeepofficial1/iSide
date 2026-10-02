# iSide Shorts Studio

A Vercel-ready Next.js app that turns one original long-form video into four vertical Punjabi-captioned shorts. It **does not auto-post** to Instagram or Facebook: the user always performs the final share/post action.

## What works

- Fetch the latest public upload from a YouTube channel URL or `@handle`.
- Upload the matching original master video locally in the browser.
- Browser-side FFmpeg extracts small audio chunks, so the full video is not uploaded to the app server.
- Groq Whisper transcribes Punjabi audio.
- Groq text model cleans Gurmukhi captions and picks four high-retention 25–55 second clips.
- Browser-side FFmpeg renders each clip as a 1080×1920 MP4 with a blurred 9:16 background and burned Punjabi captions.
- Mobile: uses the Web Share API to hand the MP4 + caption to the device share sheet; the user chooses Instagram/Facebook and presses the final Post button.
- Desktop fallback: downloads the MP4, copies the caption, and opens Instagram/Facebook in a new tab.
- No Instagram/Facebook access token is required because there is no automatic publishing.

## Vercel setup

Add these environment variables in **Vercel → Project → Settings → Environment Variables**:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_TEXT_MODEL=llama-3.3-70b-versatile
NEXT_PUBLIC_SITE_URL=https://your-project.vercel.app
```

Then redeploy once. Future pushes to `main` deploy automatically when the GitHub repo is connected to Vercel.

## Local development

```bash
npm install
npm run dev
```

## Important implementation notes

- The original video stays client-side; only compressed ~3-minute audio chunks are sent to the app API for transcription.
- FFmpeg WASM is loaded on demand from jsDelivr.
- Punjabi font data is loaded at render time from the Google Fonts GitHub repository.
- Large source files can require significant browser RAM because FFmpeg WASM has to access the source locally. Desktop Chrome/Edge is recommended for long videos.
- Browser security does not allow a website to open Instagram.com in a new tab with an arbitrary local video file already inserted into Instagram's file input. The mobile Web Share flow is the closest supported handoff: it passes the actual media file into the OS share sheet, then the user chooses the target app.

## Privacy

No social account password is stored. No Meta publishing token is used. The final post remains a user action.
