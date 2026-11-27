
# BlobOS

**BlobOS** is an HTML5-based desktop environment inspired by Android, featuring a Holo-style interface, customizable wallpapers, apps, notifications, and screensavers.

## Features

- **Home screen** — Android-inspired desktop with app shortcuts.
- **App launcher** — Browse and search installed apps.
- **App support** — Load apps using inline HTML, external HTML files, or iframes.
- **Settings** — Configure display, network, wallpaper, and system options.
- **Static wallpapers** — Choose from a collection of wallpapers.
- **Live wallpapers** — Animated backgrounds, videos, and custom HTML wallpapers.
- **Screensavers** — Digital clocks, animated bubbles, slideshows, videos, and custom HTML.
- **Notification shade** — Notifications, quick settings, and brightness controls.
- **Lock screen** — Clock, notifications, swipe-to-unlock, and optional PIN.
- **Recent apps** — Quickly return to recently opened applications.
- **Navigation bar** — Back, Home, and Recent Apps controls.
- **Responsive layout** — Designed for desktop, tablet, and mobile browsers.

## Getting Started

### Requirements

- A modern web browser
- A web server or static hosting service

BlobOS uses browser features such as `fetch`, `localStorage`, and modern JavaScript. It should be served over HTTP or HTTPS rather than opened directly using `file://`.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/halohash/BlobOS.git
   ```

2. Enter the project directory:

   ```bash
   cd BlobOS
   ```

3. Start a local web server.

   For example, using Python:

   ```bash
   python -m http.server 8000
   ```

4. Open BlobOS in your browser:

   ```text
   http://localhost:8000
   ```

You can also deploy the project using GitHub Pages, Cloudflare Pages, or another static hosting provider.

## Project Structure

```text
BlobOS/
├── index.html
├── style.css
├── style-system.css
├── app.js
├── blobos-system.js
├── apps.json
├── wallpapers.json
├── livewallpapers.json
├── screensavers.json
├── manifest.webmanifest
├── wallpapers/
│   ├── live.mp4
│   └── daydream.mp4
└── screensavers/
    └── custom.html
```

Additional images, icons, wallpapers, and app resources can be added as needed.

## Configuration

### Apps

Apps are defined in `apps.json`.

Example:

```json
{
  "com.example.app": {
    "name": "Example App",
    "icon": "icon.png",
    "htmlurl": "example.html"
  },
  "com.example.website": {
    "name": "Example Website",
    "icon": "website.png",
    "iframe": "https://example.com"
  },
  "com.example.inline": {
    "name": "Inline App",
    "icon": "inline.png",
    "html": "<div>Hello from BlobOS!</div>"
  },
  "com.example.service": {
    "name": "Example Service",
    "icon": "service.png",
    "script": "https://example.com/script.js"
  }
}
```

Supported app properties:

| Property | Description |
|---|---|
| `name` | App display name |
| `icon` | App icon URL |
| `htmlurl` | Loads an external HTML file |
| `iframe` | Loads a website in an iframe |
| `html` | Displays inline HTML |
| `service` | an app that runs on boot and is not seen in the launcher or app tray. |


BlobOS includes built-in apps.

### Static Wallpapers

Wallpapers are configured in `wallpapers.json`.

Example:

```json
[
  "1.png",
  "2.png",
  "3.png"
]
```

### Live Wallpapers

Live wallpapers are configured in `livewallpapers.json`.

Example:

```json
[
  {
    "id": "bubbles",
    "name": "Bubbles",
    "type": "bubbles"
  },
  {
    "id": "video",
    "name": "Video Wallpaper",
    "type": "video",
    "src": "wallpapers/live.mp4"
  },
  {
    "id": "custom",
    "name": "Custom HTML Wallpaper",
    "type": "html",
    "src": "wallpapers/live.html"
  }
]
```

Available wallpaper types depend on the system implementation.

### Screensavers

Screensavers are configured in `screensavers.json`.

Example:

```json
[
  {
    "id": "clock",
    "name": "Digital Clock",
    "type": "clock"
  },
  {
    "id": "bubbles",
    "name": "Bubbles",
    "type": "bubbles"
  },
  {
    "id": "slideshow",
    "name": "Photo Slideshow",
    "type": "slideshow",
    "interval": 8000,
    "images": [
      "1.png",
      "2.png",
      "3.png"
    ]
  },
  {
    "id": "video",
    "name": "Video Daydream",
    "type": "video",
    "src": "wallpapers/daydream.mp4"
  },
  {
    "id": "custom",
    "name": "Custom Daydream",
    "type": "html",
    "src": "screensavers/custom.html"
  }
]
```

Screensavers can be previewed from:

**Settings → System → Screensavers**

The automatic screensaver activates after the configured idle timeout.

## Dialogs

Dialogs have been added since Nov 24, 2026.

```js
// confirmation dialog
async function promptReboot() {
  const choice = await holoDialog({
    title: 'Phone options',
    message: 'Your phone will shut down.',
    negativeText: 'Cancel',
    positiveText: 'OK'
  });

  if (choice === 'positive') {
    console.log('Shutting down...');
  }
}

// simple alert
holoDialog({
  title: 'Force close',
  message: 'Unfortunately, System UI has stopped.',
  positiveText: 'OK'
});
```

## Customization

You can customize BlobOS by editing:

- `style.css` — Main interface styling.
- `style-system.css` — System overlays, notifications, lock screen, and live wallpaper styling.
- `apps.json` — Installed applications.
- `wallpapers.json` — Static wallpapers.
- `livewallpapers.json` — Live wallpapers.
- `screensavers.json` — Screensavers.
- `app.js` — Main desktop and application functionality.
- `blobos-system.js` — System features and overlays.

## Technologies

- HTML5
- CSS3
- JavaScript
- JSON
- Google Roboto
- Google Material Icons
- Browser Local Storage

## String System

Added Since Nov 26, 2026.

```js
window.getString(key, ...args)
```


```html
<div>@string/example</div> <!-- for strings without args-->
<div>@string/exampleargs|ab|cd</div> <!-- for strings with args-->
```

## Notes

- Wi-Fi, airplane mode, brightness, and rotation controls are simulated interface settings. They do not directly control the device's hardware.
- The lock screen PIN is a local browser feature, not secure operating-system authentication.
- Apps loaded through iframes may be restricted by the external website's embedding policies.
- Custom HTML wallpapers and screensavers should only be loaded from trusted sources.

## Credits

- **Roboto** — Google Fonts
- **Material Icons** — Google
- **BlobOS icons and assets** — Their respective creators

## License

Roboto font by Google Fonts (Apache 2.0), Material Icons by Google (Apache 2.0), and BlobOS icons and assets by their respective creators.

## Noticements 
- Packages can have something else other than 'com.blobos'
- Do not use Google AI Overview as long code breaks.
- there should not be duplicate packages.