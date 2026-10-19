# Nathan Hor — Creative Technologist

A tactile portfolio interface inspired by modular IBM hardware, phosphor terminals, and low-fi industrial control rooms. The experience keeps the typography and layout modern while treating every section like a physical server module.

## Interface

- Tactile section keys with original engraved glyphs and extending index tabs
- One interruptible 400 ms content-plate handoff with keyboard and touch navigation
- Canvas radar that transforms Nathan's portrait into a playable Snake game
- Project carousel with six records and an expanding technical drawer
- Photography arranged as clipped physical stacks with swipe and button controls
- Static service spine with a connected cable, mounted section readout, and restrained sound
- Reduced-motion, forced-colors, keyboard, and screen-reader support

## Architecture

The site deliberately uses a hybrid rendering approach:

- HTML and CSS 3D transforms for readable, responsive interface panels
- Canvas 2D for the radar, pixel portrait, and Snake game
- Native Web Animations for coordinated section travel and project feedback
- Tailwind CSS for utilities and the compiled production stylesheet

This keeps interaction smooth on laptops and phones without making the full site dependent on a WebGL scene.

## Development

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5186/ for this portfolio. The dev server uses a fixed port
and stops with an error if it is occupied instead of silently changing URLs.

To check the production build:

```bash
npm run build
npm test
```

Open `index.html` through a local static server after building.

## Live site

[nathanhor.com](https://nathanhor.com/)

## License

MIT License, copyright 2026 Nathan Hor.
