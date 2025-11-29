# Progressive Web App (PWA) Setup

Your Menu Planning App is now configured as a Progressive Web App (PWA), which means users can install it on their mobile devices and use it like a native app!

## What's Been Set Up

1. **PWA Configuration**: Added `next-pwa` package for service worker and offline support
2. **Web Manifest**: Created `public/manifest.json` with app metadata
3. **App Icons**: Generated 192x192 and 512x512 icons
4. **Meta Tags**: Added PWA meta tags to the root layout

## How to Install on Mobile Devices

### iOS (iPhone/iPad)

1. Open Safari browser (Chrome won't work for PWA installation on iOS)
2. Navigate to your app URL
3. Tap the Share button (square with arrow)
4. Scroll down and tap "Add to Home Screen"
5. Customize the name if desired
6. Tap "Add"

### Android

1. Open Chrome browser
2. Navigate to your app URL
3. Tap the menu (three dots) in the top right
4. Tap "Add to Home screen" or "Install app"
5. Tap "Install" or "Add"

## Building for Production

The PWA features are **disabled in development mode** to avoid caching issues during development.

To build for production:

```bash
npm run build
npm start
```

The service worker will be generated automatically during the build process.

## Customizing Icons

If you want to replace the default icons:

1. Create new icons:
   - `icon-192.png` (192x192 pixels)
   - `icon-512.png` (512x512 pixels)

2. Place them in the `public/` directory

3. You can use online tools like:
   - [RealFaviconGenerator](https://realfavicongenerator.net/)
   - [PWA Builder Image Generator](https://www.pwabuilder.com/imageGenerator)

## Testing PWA Features

1. **Build the app**: `npm run build && npm start`
2. **Open in browser**: Navigate to your app
3. **Check manifest**: Visit `http://localhost:3000/manifest.json`
4. **Test installation**: Try installing on a mobile device
5. **Test offline**: Once installed, turn off WiFi and see if the app still works (basic pages will be cached)

## Features Enabled

- ✅ Installable on mobile devices
- ✅ Standalone app experience (no browser UI)
- ✅ Offline support (cached pages)
- ✅ App icons on home screen
- ✅ Splash screen on launch
- ✅ Theme color matching your app

## Troubleshooting

### Icons not showing
- Make sure icons are in the `public/` directory
- Clear browser cache
- Rebuild the app: `npm run build`

### Installation prompt not appearing
- Make sure you're using HTTPS (or localhost for development)
- Check that manifest.json is accessible
- Try a different browser (Chrome for Android, Safari for iOS)

### Service worker not working
- Service workers are disabled in development mode
- Build for production: `npm run build`
- Check browser console for service worker errors

