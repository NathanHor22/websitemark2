const colors = {
  paper: '#c7c1a9',
  paperLight: '#ddd7bf',
  graphite: '#292824',
  graphiteSoft: '#5f5b50',
  grid: 'rgba(41, 40, 36, 0.17)',
  amber: '#a96543'
};

const GRID = 28;
const START_SPEED = 118;
const MIN_SPEED = 68;

export function initDiagnosticSnake(options = {}) {
  const canvas = document.querySelector('#radar-canvas');
  const terminal = document.querySelector('.identity-terminal');
  const portrait = terminal?.querySelector('.identity-terminal__screen > img');
  const startButton = document.querySelector('[data-diagnostic-start]');
  const exitButton = document.querySelector('[data-diagnostic-exit]');
  const screenLabel = terminal?.querySelector('.identity-terminal__screen-label span');
  const screenValue = terminal?.querySelector('.identity-terminal__screen-label b');
  const frequencyReadout = terminal?.querySelector('[data-diagnostic-frequency]');
  if (!canvas || !terminal || !portrait || !startButton || !exitButton) return () => {};

  const context = canvas.getContext('2d', { alpha: false });
  const reducedMotion = Boolean(options.reducedMotion);
  const portraitSource = canvas.dataset.portraitSource || portrait.currentSrc || portrait.src;
  const portraitImage = new Image();
  portraitImage.decoding = 'async';
  portraitImage.src = portraitSource;

  let portraitPixels = [];
  let state = 'idle';
  let snake = [];
  let direction = { x: 1, y: 0 };
  let queuedDirection = { x: 1, y: 0 };
  let food = { x: 20, y: 14 };
  let score = 0;
  let speed = START_SPEED;
  let lastStep = 0;
  let animationFrame = 0;
  let morphStart = 0;
  let touchStart = null;
  let canvasWidth = 0;
  let canvasHeight = 0;
  let returnFocusAfterExit = false;

  const loadPortraitPixels = () => {
    const source = document.createElement('canvas');
    source.width = GRID;
    source.height = GRID;
    const sourceContext = source.getContext('2d', { willReadFrequently: true });

    try {
      sourceContext.drawImage(portraitImage, 0, 0, GRID, GRID);
      const data = sourceContext.getImageData(0, 0, GRID, GRID).data;
      portraitPixels = [];

      for (let y = 0; y < GRID; y += 1) {
        for (let x = 0; x < GRID; x += 1) {
          const offset = (y * GRID + x) * 4;
          const alpha = data[offset + 3] / 255;
          const lightness = (data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722) / 255;
          const strength = Math.max(0, (1 - lightness) * alpha);
          if (strength > 0.16) {
            portraitPixels.push({
              x,
              y,
              strength,
              seed: ((x * 37 + y * 17 + portraitPixels.length * 11) % 101) / 100
            });
          }
        }
      }
    } catch {
      portraitPixels = [];
    }
  };

  if (portraitImage.complete) loadPortraitPixels();
  else portraitImage.addEventListener('load', loadPortraitPixels, { once: true });

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvasWidth = Math.max(1, Math.round(rect.width * ratio));
    canvasHeight = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }
    draw();
  };

  const cellMetrics = () => {
    const size = Math.min(canvasWidth, canvasHeight);
    const cell = size / GRID;
    return {
      cell,
      offsetX: (canvasWidth - size) / 2,
      offsetY: (canvasHeight - size) / 2
    };
  };

  const drawGrid = () => {
    const { cell, offsetX, offsetY } = cellMetrics();
    context.fillStyle = colors.paper;
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    context.strokeStyle = colors.grid;
    context.lineWidth = Math.max(1, canvasWidth / 900);
    context.beginPath();

    for (let index = 0; index <= GRID; index += 1) {
      const coordinate = index * cell;
      context.moveTo(offsetX + coordinate, offsetY);
      context.lineTo(offsetX + coordinate, offsetY + cell * GRID);
      context.moveTo(offsetX, offsetY + coordinate);
      context.lineTo(offsetX + cell * GRID, offsetY + coordinate);
    }
    context.stroke();

    context.strokeStyle = colors.graphiteSoft;
    context.strokeRect(offsetX + 0.5, offsetY + 0.5, cell * GRID - 1, cell * GRID - 1);
  };

  const drawPortrait = (visibility = 1) => {
    drawGrid();
    const { cell, offsetX, offsetY } = cellMetrics();

    if (!portraitPixels.length) {
      context.fillStyle = colors.graphite;
      context.globalAlpha = visibility * 0.72;
      context.beginPath();
      context.arc(offsetX + cell * 14, offsetY + cell * 11.2, cell * 6.2, 0, Math.PI * 2);
      context.fill();
      context.fillRect(offsetX + cell * 8.5, offsetY + cell * 16, cell * 11, cell * 9);
      context.globalAlpha = 1;
      return;
    }

    portraitPixels.forEach((pixel, index) => {
      const threshold = 0.21 + ((pixel.x * 7 + pixel.y * 13 + index) % 9) * 0.055;
      if (pixel.strength < threshold) return;
      context.globalAlpha = Math.min(0.94, pixel.strength + 0.16) * visibility;
      context.fillStyle = index % 19 === 0 ? colors.amber : colors.graphite;
      const inset = cell * (pixel.strength > 0.62 ? 0.08 : 0.18);
      context.fillRect(
        offsetX + pixel.x * cell + inset,
        offsetY + pixel.y * cell + inset,
        cell - inset * 2,
        cell - inset * 2
      );
    });
    context.globalAlpha = 1;
  };

  const drawSnake = (visibility = 1) => {
    const { cell, offsetX, offsetY } = cellMetrics();
    context.globalAlpha = visibility;

    snake.forEach((segment, index) => {
      const inset = index === 0 ? cell * 0.08 : cell * 0.13;
      context.fillStyle = index === 0 ? colors.amber : colors.graphite;
      context.fillRect(
        offsetX + segment.x * cell + inset,
        offsetY + segment.y * cell + inset,
        cell - inset * 2,
        cell - inset * 2
      );
    });

    const pulse = state === 'running' ? 0.75 + Math.sin(performance.now() / 120) * 0.18 : 0.9;
    context.globalAlpha = visibility * pulse;
    context.fillStyle = colors.amber;
    context.beginPath();
    context.arc(
      offsetX + (food.x + 0.5) * cell,
      offsetY + (food.y + 0.5) * cell,
      cell * 0.28,
      0,
      Math.PI * 2
    );
    context.fill();
    context.globalAlpha = 1;
  };

  const clamp = value => Math.min(1, Math.max(0, value));
  const ease = value => {
    const amount = clamp(value);
    return 1 - Math.pow(1 - amount, 3);
  };

  const drawReconstruction = progress => {
    drawGrid();
    const { cell, offsetX, offsetY } = cellMetrics();
    const snakeFade = 1 - clamp((progress - 0.08) / 0.62);
    drawSnake(snakeFade);

    portraitPixels.forEach((pixel, pixelIndex) => {
      const threshold = 0.21 + ((pixel.x * 7 + pixel.y * 13 + pixelIndex) % 9) * 0.055;
      if (pixel.strength < threshold) return;

      const delay = pixel.seed * 0.26;
      const local = ease((progress - delay) / 0.74);
      if (local <= 0) return;

      const segment = snake.length ? snake[(pixelIndex * 7) % snake.length] : null;
      const angle = pixel.seed * Math.PI * 2 + pixelIndex * 0.031;
      const originX = segment ? segment.x + 0.5 + Math.cos(angle) * (1.2 + pixel.seed * 2.4) : GRID / 2 + Math.cos(angle) * GRID * 0.34;
      const originY = segment ? segment.y + 0.5 + Math.sin(angle) * (1.2 + pixel.seed * 2.4) : GRID / 2 + Math.sin(angle) * GRID * 0.34;
      const targetX = pixel.x + 0.5;
      const targetY = pixel.y + 0.5;
      const x = originX + (targetX - originX) * local;
      const y = originY + (targetY - originY) * local;
      const size = cell * (0.18 + local * (pixel.strength > 0.62 ? 0.74 : 0.58));

      context.globalAlpha = Math.min(0.96, pixel.strength + 0.2) * clamp(local * 1.45);
      context.fillStyle = pixelIndex % 23 === 0 ? colors.amber : colors.graphite;
      context.fillRect(offsetX + x * cell - size / 2, offsetY + y * cell - size / 2, size, size);
    });

    if (progress < 0.18) {
      context.globalAlpha = (0.18 - progress) * 1.9;
      context.fillStyle = colors.graphite;
      for (let index = 0; index < 72; index += 1) {
        const x = (Math.sin(index * 91.7 + progress * 800) * 0.5 + 0.5) * canvasWidth;
        const y = (Math.cos(index * 47.3 + progress * 530) * 0.5 + 0.5) * canvasHeight;
        context.fillRect(x, y, Math.max(2, cell * 0.32), Math.max(1, cell * 0.13));
      }
    }

    if (progress > 0.82) {
      const band = clamp((progress - 0.82) / 0.18);
      context.globalAlpha = Math.sin(band * Math.PI) * 0.32;
      context.fillStyle = colors.paperLight;
      context.fillRect(0, canvasHeight * band - cell, canvasWidth, cell * 1.5);
    }
    context.globalAlpha = 1;
  };

  const drawGameOver = () => {
    drawGrid();
    drawSnake(0.34);
    context.fillStyle = 'rgba(216, 210, 185, 0.91)';
    context.fillRect(canvasWidth * 0.12, canvasHeight * 0.38, canvasWidth * 0.76, canvasHeight * 0.24);
    context.strokeStyle = colors.graphite;
    context.strokeRect(canvasWidth * 0.12, canvasHeight * 0.38, canvasWidth * 0.76, canvasHeight * 0.24);
    context.fillStyle = colors.graphite;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '700 ' + Math.max(12, canvasWidth * 0.041) + 'px "IBM Plex Mono", monospace';
    context.fillText('DIAGNOSTIC HALTED', canvasWidth / 2, canvasHeight * 0.47);
    context.font = '400 ' + Math.max(9, canvasWidth * 0.022) + 'px "IBM Plex Mono", monospace';
    context.fillText('SCORE ' + String(score).padStart(3, '0') + ' / RESTART OR EXIT', canvasWidth / 2, canvasHeight * 0.55);
  };

  const draw = () => {
    if (!canvasWidth || !canvasHeight) return;
    if (state === 'morph-in') {
      const progress = Math.min(1, (performance.now() - morphStart) / (reducedMotion ? 1 : 470));
      drawPortrait(1 - progress);
      drawSnake(progress);
    } else if (state === 'morph-out') {
      const progress = Math.min(1, (performance.now() - morphStart) / (reducedMotion ? 1 : 790));
      drawReconstruction(progress);
      if (screenValue) screenValue.textContent = 'FRAME-' + String(Math.round(progress * 100)).padStart(3, '0') + '%';
      if (frequencyReadout) frequencyReadout.textContent = 'SYNC ' + String(Math.round(progress * 100)).padStart(3, '0') + '%';
    } else if (state === 'running' || state === 'paused') {
      drawGrid();
      drawSnake();
    } else if (state === 'gameover') {
      drawGameOver();
    } else {
      drawPortrait();
    }
  };

  const placeFood = () => {
    let candidate;
    do {
      candidate = {
        x: Math.floor(Math.random() * GRID),
        y: Math.floor(Math.random() * GRID)
      };
    } while (snake.some(segment => segment.x === candidate.x && segment.y === candidate.y));
    food = candidate;
  };

  const resetGame = () => {
    snake = [
      { x: 14, y: 14 },
      { x: 13, y: 14 },
      { x: 12, y: 14 },
      { x: 11, y: 14 },
      { x: 10, y: 14 }
    ];
    direction = { x: 1, y: 0 };
    queuedDirection = { x: 1, y: 0 };
    score = 0;
    speed = START_SPEED;
    lastStep = 0;
    placeFood();
  };

  const syncControls = () => {
    const active = state !== 'idle';
    terminal.classList.toggle('is-diagnostic', active);
    terminal.classList.toggle('is-reconstructing', state === 'morph-out');
    canvas.hidden = !active;
    portrait.hidden = active;
    exitButton.hidden = !active;
    exitButton.disabled = state === 'morph-out';
    startButton.disabled = state === 'morph-out';

    if (state === 'running' || state === 'morph-in' || state === 'morph-out' || state === 'paused') {
      startButton.hidden = true;
    } else if (state === 'gameover') {
      startButton.hidden = false;
      startButton.textContent = 'Restart diagnostic';
    } else {
      startButton.hidden = false;
      startButton.textContent = 'Run diagnostic';
    }

    if (screenLabel) {
      screenLabel.textContent = state === 'morph-out' ? 'Reconstructing video memory' : (active ? 'Snake diagnostic' : 'Subject acquired');
    }
    if (screenValue) {
      screenValue.textContent = state === 'morph-out' ? 'FRAME-000%' : (active ? 'SCORE-' + String(score).padStart(3, '0') : 'NH-0201');
    }
    if (frequencyReadout && state !== 'morph-out') frequencyReadout.textContent = active ? String(11.82 + score * 0.17).padStart(6, '0') + ' kHz' : '02.010 MHz';
  };

  const gameOver = () => {
    state = 'gameover';
    syncControls();
    drawGameOver();
  };

  const step = () => {
    direction = queuedDirection;
    const head = {
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y
    };

    const hitsWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
    const hitsSelf = snake.some(segment => segment.x === head.x && segment.y === head.y);
    if (hitsWall || hitsSelf) {
      gameOver();
      return;
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 1;
      speed = Math.max(MIN_SPEED, START_SPEED - score * 4);
      placeFood();
      if (screenValue) screenValue.textContent = 'SCORE-' + String(score).padStart(3, '0');
      if (frequencyReadout) frequencyReadout.textContent = String(11.82 + score * 0.17).padStart(6, '0') + ' kHz';
    } else {
      snake.pop();
    }
  };

  const loop = timestamp => {
    if (state === 'morph-in') {
      const progress = (timestamp - morphStart) / (reducedMotion ? 1 : 470);
      draw();
      if (progress >= 1) {
        state = 'running';
        lastStep = timestamp;
        syncControls();
      }
    } else if (state === 'morph-out') {
      const progress = (timestamp - morphStart) / (reducedMotion ? 1 : 790);
      draw();
      if (progress >= 1) {
        state = 'idle';
        syncControls();
        terminal.classList.add('is-video-restored');
        window.setTimeout(() => terminal.classList.remove('is-video-restored'), 180);
        if (returnFocusAfterExit) startButton.focus({ preventScroll: true });
        returnFocusAfterExit = false;
      }
    } else if (state === 'running') {
      if (timestamp - lastStep >= speed) {
        step();
        lastStep = timestamp;
      }
      draw();
    } else if (state === 'paused') {
      draw();
    }

    if (state === 'morph-in' || state === 'morph-out' || state === 'running') {
      animationFrame = window.requestAnimationFrame(loop);
    }
  };

  const start = () => {
    window.cancelAnimationFrame(animationFrame);
    resetGame();
    state = reducedMotion ? 'running' : 'morph-in';
    morphStart = performance.now();
    canvas.hidden = false;
    portrait.hidden = true;
    resize();
    syncControls();
    lastStep = performance.now();
    animationFrame = window.requestAnimationFrame(loop);
    canvas.focus({ preventScroll: true });
  };

  const exit = (restoreFocus = true, immediate = false) => {
    if (state === 'idle') return;
    window.cancelAnimationFrame(animationFrame);
    returnFocusAfterExit = restoreFocus;
    state = reducedMotion || immediate ? 'idle' : 'morph-out';
    morphStart = performance.now();
    syncControls();
    if (state === 'idle') {
      if (restoreFocus) startButton.focus({ preventScroll: true });
      returnFocusAfterExit = false;
    } else {
      animationFrame = window.requestAnimationFrame(loop);
    }
  };

  const queue = next => {
    if (state !== 'running') return;
    if (next.x === -direction.x && next.y === -direction.y) return;
    queuedDirection = next;
  };

  const onKeyDown = event => {
    if (state === 'idle') return;
    if (state === 'morph-out') {
      if (event.key === 'Escape') event.preventDefault();
      return;
    }
    const directions = {
      ArrowUp: { x: 0, y: -1 },
      w: { x: 0, y: -1 },
      W: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      s: { x: 0, y: 1 },
      S: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      a: { x: -1, y: 0 },
      A: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      d: { x: 1, y: 0 },
      D: { x: 1, y: 0 }
    };

    if (event.key === 'Escape') {
      event.preventDefault();
      exit();
      return;
    }

    if (event.key === ' ' && (state === 'running' || state === 'paused')) {
      event.preventDefault();
      state = state === 'running' ? 'paused' : 'running';
      if (state === 'running') {
        if (screenLabel) screenLabel.textContent = 'Snake diagnostic';
        lastStep = performance.now();
        animationFrame = window.requestAnimationFrame(loop);
      } else {
        if (screenLabel) screenLabel.textContent = 'Diagnostic paused';
        window.cancelAnimationFrame(animationFrame);
        draw();
      }
      return;
    }

    const next = directions[event.key];
    if (!next) return;
    event.preventDefault();
    queue(next);
  };

  const onTouchStart = event => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = event => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) queue({ x: Math.sign(dx), y: 0 });
    else queue({ x: 0, y: Math.sign(dy) });
  };

  const onVisibility = () => {
    if (document.hidden && state === 'running') {
      state = 'paused';
      window.cancelAnimationFrame(animationFrame);
    } else if (!document.hidden && state === 'paused') {
      state = 'running';
      lastStep = performance.now();
      animationFrame = window.requestAnimationFrame(loop);
    }
  };

  const onSectionChange = event => {
    if (event.detail?.id !== 'hero') exit(false, true);
  };

  const onDiagnosticRequest = () => start();
  const onExitClick = () => exit();

  canvas.tabIndex = 0;
  exitButton.addEventListener('click', onExitClick);
  document.addEventListener('machine:diagnosticrequest', onDiagnosticRequest);
  document.addEventListener('machine:sectionchange', onSectionChange);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('resize', resize);
  syncControls();

  return () => {
    exit(false, true);
    exitButton.removeEventListener('click', onExitClick);
    document.removeEventListener('machine:diagnosticrequest', onDiagnosticRequest);
    document.removeEventListener('machine:sectionchange', onSectionChange);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('resize', resize);
  };
}
