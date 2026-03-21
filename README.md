# EvenBetter Weather Test

A text-only weather app for Even G2 glasses, designed to test the EvenBetter JS plugin system.

## Features

- Fetches real weather data from [Open-Meteo API](https://open-meteo.com/) (free, no API key)
- 3 screens: 7-day forecast, current conditions, hourly forecast
- Swipe forward/backward to cycle screens
- Double-tap to refresh weather data
- Auto-refreshes every 15 minutes
- No DOM dependencies — runs in QuickJS/JavaScriptCore

## Installation in EvenBetter

1. Open the EvenBetter app
2. Go to the **Apps** tab
3. Tap **Install App**
4. Paste this repo URL: `https://github.com/JulianBeaulieu/evenbetter-weather-test`
5. Tap **Install**

## How it works

The app uses the `@evenrealities/even_hub_sdk` API to communicate with the G2 glasses:
- `waitForEvenAppBridge()` to connect
- `createStartUpPageContainer()` / `rebuildPageContainer()` to render text
- `onEvenHubEvent()` to handle tap/swipe gestures

The pre-bundled `dist/index.js` is a self-contained IIFE with no external dependencies.
