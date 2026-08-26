# Mooni Landing Page

One-page marketing/site for Mooni, built with [Next.js](https://nextjs.org)
(App Router, TypeScript, no Tailwind). Styled after the mobile app's dark
theme - the CSS custom properties in `app/globals.css` mirror
`mobile/src/context/ThemeContext.tsx`.

## Develop

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

## Build

```bash
npm run build
npm start
```

## Structure

```
app/
  layout.tsx         metadata (title/description/OpenGraph)
  page.tsx           navbar + hero + features + setup steps + footer
  globals.css        theme tokens from the app's dark palette
public/
  mooni-hero.jpg     app screenshot shown in the hero
  mooni.apk          drop your release APK here - the Download button links to it
```

Buttons point at `/mooni.apk` (download) and
`github.com/hideffrand/mooni` (source).
