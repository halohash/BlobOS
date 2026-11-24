BrowserBlob
===========

Upload index.html, style.css, app.js, manifest.webmanifest and sw.js to the same folder on your HTTPS site.

The site directory is fetched from:
  /blobbrowsesites/sites.json

Example:
{
  "new-tab": {"html":"<div>new tab page</div>"},
  "test.com": {"html":"<div>hello</div>"},
  "againtest.com": {"iframe":"https://example.com"},
  "err-not-found": {"htmlurl":"anything.html"}
}

Supported entry properties:
- html: HTML rendered in an isolated srcdoc iframe.
- iframe: URL loaded in the page iframe. Some websites block embedding.
- htmlurl: HTML fetched from /blobbrowsesites/<value>, then rendered in an isolated srcdoc iframe.

Address bar examples:
  test.com
  https://test.com
  againtest.com

Important:
- This is a site-directory browser, not a general-purpose browser engine. It opens keys listed in sites.json.
- Unknown hostnames show a not-found page. The err-not-found entry is reserved for your own optional not-found page; it is not automatically executed in this starter.
- Serve the app over HTTPS (or localhost) for service workers and PWA installation.
- iOS: open the HTTPS app in Safari, tap Share, then Add to Home Screen. iOS does not use the Android install prompt.
- Android/Desktop: use the browser's Install app / Add to Home Screen option.
- The external icon URL is used as requested. For best PWA install compatibility, also host 192x192 and 512x512 PNG copies on the same origin and update manifest.webmanifest.
