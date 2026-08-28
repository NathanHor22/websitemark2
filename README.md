# Nathan Hor — Creative Technologist

A tactile portfolio interface inspired by modular IBM hardware, phosphor terminals, and low-fi industrial control rooms. The experience keeps the typography and layout modern while treating every section like a physical server module.

## Interface

- Mechanical section drive with drag, keyboard, wheel, and touch navigation
- Recessed sections that mechanically pop forward as they become active
- Canvas radar that transforms Nathan's portrait into a playable Snake game
- Project carousel with six records and an expanding technical drawer
- Photography arranged as clipped physical stacks with swipe and button controls
- Reactive server backplane, status lights, phosphor glow, and restrained sound
- Reduced-motion, forced-colors, keyboard, and screen-reader support

## Architecture

The site deliberately uses a hybrid rendering approach:

- HTML and CSS 3D transforms for readable, responsive interface panels
- Canvas 2D for the radar, pixel portrait, and Snake game
- Motion One for small interface transitions
- Tailwind CSS for utilities and the compiled production stylesheet

This keeps interaction smooth on laptops and phones without making the full site dependent on a WebGL scene.

## Development

```bash
npm install
npm run build
npm test
```

Open `index.html` through a local static server after building.

## Live site

[nathanhor.com](https://nathanhor.com/)

## License

MIT License, copyright 2026 Nathan Hor.
