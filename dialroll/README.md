# Dial Roll

A small, Mario-inspired rolling platform game built with plain HTML, CSS, and JavaScript.

## Run it

1. Keep `index.html`, `style.css`, `game.js`, and `worlds.json` in the same folder.
2. Keep the icon assets at the paths shown below, relative to your site root:
   - `/icons/dial.png`
   - `/icons/headphones.png`
   - `/icons/phone.png`
   - `/icons/downloads.png`
   - `/icons/chicken.png`
   - `/icons/browser.png`
3. Serve the folder from a web server (for example, GitHub Pages or `python -m http.server`). `worlds.json` is loaded with `fetch`, so opening `index.html` directly as a `file://` URL may prevent custom worlds from loading.

The game draws fallback symbols if an image is missing. The requested assets are expected under `/icons/` (not `/icon/`).

## Controls

- Desktop: Left / Right arrows (or A / D) to roll; Space, Up, or W to jump; Esc to pause.
- Mobile: use the on-screen left, right, and jump buttons.

## Worlds and themes

- Each world has five stages. The fifth stage uses Dark Holo by default.
- Holitas appears every third stage unless a theme override is selected.
- The first stages use a hand-arranged, classic platform-game layout. Chicken-heavy stages and later seed-generated stages add more chicken encounters.
- Level select accepts any text as a deterministic world seed. The `browser` seed unlocks the Globe skin after collecting three phones.
- Automatic themes can be overridden in Level Select with Light Holo, Dark Holo, or Holitas.

## Map editor and `worlds.json`

The Map Editor lets you paint a small grid, test it, or export a JSON file. Replace your existing `worlds.json` with the exported file (or merge its top-level world entry into the existing file).

A world entry has this shape:

```json
{
  "my-world": {
    "name": "My World",
    "width": 30,
    "height": 9,
    "theme": "light",
    "solids": [
      { "x": 0, "y": 8, "type": "ground" },
      { "x": 4, "y": 6, "type": "question" }
    ],
    "entities": [
      { "x": 7, "y": 7, "type": "phone" },
      { "x": 10, "y": 7, "type": "chicken" }
    ]
  }
}
```

Supported solid types: `ground`, `brick`, `question`.

Supported entity types: `phone`, `headphone`, `chicken`, `download`.

The top-level JSON property name is the name/seed players type in Level Select. Coordinates are grid cells, with `(0, 0)` at the top-left.

## Gameplay notes

- Phones use square collision and fall under gravity.
- The Dial uses circular collision against solid tiles.
- Chickens award two phones when touched.
- Question blocks release a phone when hit from below.
- The Download power-up grows the Dial to 1.5×. Taking a hit shrinks it back to 1×.
- The player can retry after a hit; lives are intentionally not displayed.
- The 2× crush state can defeat headphones and other enemies for 30 seconds. (The current Download pickup is 1.5×; the 2× state is reserved for future power-up extensions.)
- Best score is stored in browser local storage.

## Customization

Change the icon paths in the `ASSET` object near the top of `game.js` if your site stores the files elsewhere. Tune movement and physics with `TILE`, `GRAVITY`, `MOVE`, and `JUMP`.
