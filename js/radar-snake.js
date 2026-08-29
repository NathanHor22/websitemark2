(function () {
  'use strict';

  var canvas = document.getElementById('radar-canvas');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d', { alpha: false });
  var consoleRoot = canvas.closest('.radar-console');
  var startButton = document.getElementById('radar-start');
  var pauseButton = document.getElementById('radar-pause');
  var exitButton = document.getElementById('radar-exit');
  var soundButton = document.getElementById('sound-toggle');
  var statusNode = document.getElementById('radar-status');
  var modeNode = document.getElementById('radar-mode');
  var scoreNode = document.getElementById('radar-score');
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var size = canvas.width;
  var center = size / 2;
  var radius = size * 0.43;
  var sampleSize = 96;
  var state = 'idle';
  var visible = true;
  var frameId = 0;
  var lastFrame = 0;
  var lastTick = 0;
  var transitionStart = 0;
  var transitionDuration = 680;
  var portraitReady = false;
  var portraitPixels = [];
  var portraitPalette = ['#12391e', '#1b5c2a', '#2f9544', '#65dd76', '#b9ffbb'];
  var portraitLayer = document.createElement('canvas');
  portraitLayer.width = size;
  portraitLayer.height = size;
  var portraitLayerCtx = portraitLayer.getContext('2d');
  var portraitLayerReady = false;
  var audioContext = null;
  var soundEnabled = false;
  var score = 0;
  var gridSize = 24;
  var cellSize = size / gridSize;
  var direction = { x: 1, y: 0 };
  var nextDirection = { x: 1, y: 0 };
  var snake = [];
  var food = { x: 17, y: 12 };
  var touchStart = null;
  var touchPointerId = null;
  var returnFocusAfterExit = false;

  try {
    soundEnabled = localStorage.getItem('nh-machine-sound') === 'on';
  } catch (error) {}

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function ease(value) {
    value = clamp(value, 0, 1);
    return 1 - Math.pow(1 - value, 3);
  }

  function setText(node, value) {
    if (node) node.textContent = value;
  }

  function syncControls() {
    if (consoleRoot) consoleRoot.setAttribute('data-radar-state', state);
    if (soundButton) {
      soundButton.textContent = soundEnabled ? 'SND ON' : 'SND OFF';
      soundButton.setAttribute('aria-pressed', String(soundEnabled));
    }

    if (state === 'idle') {
      setText(modeNode, 'PORTRAIT');
      setText(statusNode, portraitReady ? 'SIGNAL LOCKED' : 'SCANNING');
      if (startButton) {
        startButton.textContent = 'EXEC SNAKE.BIN';
        startButton.disabled = false;
      }
      if (pauseButton) {
        pauseButton.textContent = 'PAUSE';
        pauseButton.disabled = true;
      }
    } else if (state === 'morph-in') {
      setText(modeNode, 'MOUNTING');
      setText(statusNode, 'REWRITING PIXELS');
      if (startButton) {
        startButton.textContent = 'ABORT LOAD';
        startButton.disabled = false;
      }
      if (pauseButton) pauseButton.disabled = true;
    } else if (state === 'running') {
      setText(modeNode, 'SNAKE');
      setText(statusNode, 'CHANNEL OPEN');
      if (startButton) {
        startButton.textContent = 'RESTART SNAKE';
        startButton.disabled = false;
      }
      if (pauseButton) {
        pauseButton.textContent = 'PAUSE';
        pauseButton.disabled = false;
      }
    } else if (state === 'paused') {
      setText(modeNode, 'PAUSED');
      setText(statusNode, 'CLOCK HALTED');
      if (startButton) {
        startButton.textContent = 'RESTART SNAKE';
        startButton.disabled = false;
      }
      if (pauseButton) {
        pauseButton.textContent = 'RESUME';
        pauseButton.disabled = false;
      }
    } else if (state === 'gameover') {
      setText(modeNode, 'FAULT');
      setText(statusNode, 'SIGNAL LOST');
      if (startButton) {
        startButton.textContent = 'REBOOT SNAKE';
        startButton.disabled = false;
      }
      if (pauseButton) pauseButton.disabled = true;
    } else if (state === 'morph-out') {
      setText(modeNode, 'RESTORING');
      setText(statusNode, 'REASSEMBLING BIO.SCAN');
      if (startButton) {
        startButton.textContent = 'RESTORING';
        startButton.disabled = true;
      }
      if (pauseButton) pauseButton.disabled = true;
    }
    if (exitButton) exitButton.disabled = state === 'idle' || state === 'morph-out';
    canvas.tabIndex = state === 'idle' ? -1 : 0;
    canvas.setAttribute('aria-label', state === 'idle'
      ? 'Detailed pixel radar portrait of Nathan Hor. Use the Execute Snake button to start the game.'
      : 'Snake game. Use arrow keys or WASD to steer, and Escape or Return Portrait to close the program.');
    setText(scoreNode, String(score).padStart(3, '0'));
  }

  function ensureAudio() {
    if (!soundEnabled || !audioContext) return null;
    if (audioContext && audioContext.state === 'suspended') audioContext.resume().catch(function () {});
    return audioContext;
  }

  function unlockAudio() {
    if (!soundEnabled) return null;
    if (!audioContext) {
      var AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) audioContext = new AudioCtor();
    }
    return ensureAudio();
  }

  function beep(frequency, duration, volume, type) {
    var audio = ensureAudio();
    if (!audio) return;
    var oscillator = audio.createOscillator();
    var gain = audio.createGain();
    var now = audio.currentTime;
    oscillator.type = type || 'square';
    oscillator.frequency.setValueAtTime(frequency || 440, now);
    gain.gain.setValueAtTime(volume || 0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (duration || 0.055));
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + (duration || 0.055));
  }

  function drawRadarBase(time) {
    ctx.fillStyle = '#031107';
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.clip();

    var glow = ctx.createRadialGradient(center, center, 0, center, center, radius);
    glow.addColorStop(0, '#0a3d16');
    glow.addColorStop(0.76, '#06240d');
    glow.addColorStop(1, '#021006');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(116,255,139,0.19)';
    ctx.lineWidth = 1;
    for (var r = radius / 4; r < radius; r += radius / 4) {
      ctx.beginPath();
      ctx.arc(center, center, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (var i = -10; i <= 10; i += 2) {
      var line = i * (radius / 10);
      ctx.beginPath();
      ctx.moveTo(center - radius, center + line);
      ctx.lineTo(center + radius, center + line);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(center + line, center - radius);
      ctx.lineTo(center + line, center + radius);
      ctx.stroke();
    }

    if (!reducedMotion && state === 'idle') {
      var angle = (time * 0.00048) % (Math.PI * 2);
      var sweep = ctx.createRadialGradient(center, center, 0, center, center, radius);
      sweep.addColorStop(0, 'rgba(126,255,147,0.2)');
      sweep.addColorStop(1, 'rgba(126,255,147,0)');
      ctx.fillStyle = sweep;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, angle - 0.23, angle);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(151,255,167,0.86)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius);
      ctx.stroke();
    }

    var blips = [[0.67, 0.31], [0.28, 0.69], [0.74, 0.66]];
    blips.forEach(function (point, index) {
      var pulse = reducedMotion ? 0.7 : 0.45 + Math.sin(time * 0.004 + index * 2) * 0.3;
      ctx.fillStyle = 'rgba(241,182,74,' + clamp(pulse, 0.12, 0.9) + ')';
      ctx.beginPath();
      ctx.arc(size * point[0], size * point[1], 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
    ctx.strokeStyle = '#7a836f';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(center, center, radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(128,255,145,0.46)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center, center, radius - 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  function processPortrait(image) {
    var source = document.createElement('canvas');
    source.width = sampleSize;
    source.height = sampleSize;
    var sourceCtx = source.getContext('2d', { willReadFrequently: true });
    var crop = Math.min(image.naturalWidth, image.naturalHeight * 0.76);
    var sx = (image.naturalWidth - crop) / 2;
    var sy = Math.max(0, image.naturalHeight * 0.012);
    sourceCtx.imageSmoothingEnabled = true;
    sourceCtx.imageSmoothingQuality = 'high';
    sourceCtx.clearRect(0, 0, sampleSize, sampleSize);
    sourceCtx.drawImage(image, sx, sy, crop, crop, 0, 0, sampleSize, sampleSize);
    var data = sourceCtx.getImageData(0, 0, sampleSize, sampleSize).data;
    var bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    var luminanceMap = new Float32Array(sampleSize * sampleSize);
    var subjectMap = new Uint8Array(sampleSize * sampleSize);
    portraitPixels = [];
    var span = radius * 1.62;
    var origin = center - span / 2;
    var pixelSize = span / sampleSize;

    for (var mapY = 0; mapY < sampleSize; mapY += 1) {
      for (var mapX = 0; mapX < sampleSize; mapX += 1) {
        var mapIndex = mapY * sampleSize + mapX;
        var mapOffset = mapIndex * 4;
        var red = data[mapOffset];
        var green = data[mapOffset + 1];
        var blue = data[mapOffset + 2];
        var alpha = data[mapOffset + 3];
        var nearWhite = red > 248 && green > 248 && blue > 248;
        luminanceMap[mapIndex] = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
        subjectMap[mapIndex] = alpha > 18 && !nearWhite ? 1 : 0;
      }
    }

    function sampledLuminance(x, y, fallback) {
      if (x < 0 || y < 0 || x >= sampleSize || y >= sampleSize) return fallback;
      var mapIndex = y * sampleSize + x;
      return subjectMap[mapIndex] ? luminanceMap[mapIndex] : fallback;
    }

    for (var y = 0; y < sampleSize; y += 1) {
      for (var x = 0; x < sampleSize; x += 1) {
        var dx = x - sampleSize / 2;
        var dy = y - sampleSize / 2;
        if (Math.sqrt(dx * dx + dy * dy) > sampleSize * 0.49) continue;
        var subjectIndex = y * sampleSize + x;
        if (!subjectMap[subjectIndex]) continue;
        var luminance = luminanceMap[subjectIndex];
        var edge = Math.abs(sampledLuminance(x + 1, y, luminance) - sampledLuminance(x - 1, y, luminance))
          + Math.abs(sampledLuminance(x, y + 1, luminance) - sampledLuminance(x, y - 1, luminance));
        var dither = (bayer[y % 4][x % 4] - 7.5) / 15;
        var signal = 0.14 + luminance * 0.58 + Math.min(0.3, edge * 0.72) + dither * 0.08;
        var level = Math.floor(clamp(signal, 0, 0.999) * portraitPalette.length);
        portraitPixels.push({
          x: origin + x * pixelSize,
          y: origin + y * pixelSize,
          size: Math.max(2, pixelSize * 0.84),
          level: level,
          seed: ((x * 73 + y * 151) % 997) / 997
        });
      }
    }
    renderPortraitLayer();
    portraitReady = true;
    syncControls();
    requestRender();
  }

  function renderPortraitLayer() {
    if (!portraitLayerCtx) return;
    portraitLayerCtx.clearRect(0, 0, size, size);
    portraitPixels.forEach(function (pixel) {
      portraitLayerCtx.globalAlpha = 0.9;
      portraitLayerCtx.fillStyle = portraitPalette[pixel.level];
      portraitLayerCtx.fillRect(pixel.x, pixel.y, pixel.size, pixel.size);
    });
    portraitLayerCtx.globalAlpha = 1;
    portraitLayerReady = true;
  }

  function targetForPixel(index) {
    if (!snake.length) return { x: center, y: center };
    var segment = snake[index % snake.length];
    var ring = Math.floor(index / snake.length) % 5;
    var angle = (index * 2.399963) % (Math.PI * 2);
    return {
      x: (segment.x + 0.5) * cellSize + Math.cos(angle) * ring * 0.75,
      y: (segment.y + 0.5) * cellSize + Math.sin(angle) * ring * 0.75
    };
  }

  function drawPortrait(morphAmount) {
    if (!portraitReady) {
      ctx.fillStyle = '#72ff88';
      ctx.font = '700 52px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('N.H', center, center + 18);
      return;
    }
    var amount = clamp(morphAmount || 0, 0, 1);
    if (amount === 0 && portraitLayerReady) {
      ctx.drawImage(portraitLayer, 0, 0);
      return;
    }
    portraitPixels.forEach(function (pixel, index) {
      var target = targetForPixel(index);
      var x = pixel.x + (target.x - pixel.x) * amount;
      var y = pixel.y + (target.y - pixel.y) * amount;
      var fadeStart = 0.5 + pixel.seed * 0.3;
      var alpha = amount > fadeStart ? 1 - ((amount - fadeStart) / (1 - fadeStart)) : 1;
      ctx.globalAlpha = clamp(alpha, 0, 1) * 0.82;
      ctx.fillStyle = portraitPalette[pixel.level];
      ctx.fillRect(x, y, Math.max(2, pixel.size * (1 - amount * 0.38)), Math.max(2, pixel.size * (1 - amount * 0.38)));
    });
    ctx.globalAlpha = 1;
  }

  function cellIsInside(x, y) {
    var dx = x + 0.5 - gridSize / 2;
    var dy = y + 0.5 - gridSize / 2;
    return Math.sqrt(dx * dx + dy * dy) < gridSize * 0.43;
  }

  function resetSnake() {
    snake = [];
    for (var i = 0; i < 7; i += 1) snake.push({ x: 12 - i, y: 12 });
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    spawnFood();
    syncControls();
  }

  function spawnFood() {
    var attempts = 0;
    do {
      food = {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize)
      };
      attempts += 1;
    } while (attempts < 400 && (!cellIsInside(food.x, food.y) || snake.some(function (segment) { return segment.x === food.x && segment.y === food.y; })));
  }

  function startGame() {
    var shouldMount = state === 'idle' || state === 'morph-out';
    unlockAudio();
    resetSnake();
    state = reducedMotion || !shouldMount ? 'running' : 'morph-in';
    transitionStart = performance.now();
    lastTick = transitionStart;
    returnFocusAfterExit = false;
    syncControls();
    beep(180, 0.08, 0.03, 'sawtooth');
    window.setTimeout(function () { beep(360, 0.08, 0.025, 'square'); }, 85);
    canvas.focus();
    requestRender();
  }

  function exitGame(options) {
    options = options || {};
    if (state === 'idle' || (state === 'morph-out' && !options.immediate)) return;
    touchStart = null;
    touchPointerId = null;
    returnFocusAfterExit = Boolean(options.restoreFocus);
    state = reducedMotion || options.immediate ? 'idle' : 'morph-out';
    transitionStart = performance.now();
    syncControls();
    if (!options.silent) beep(220, 0.06, 0.02, 'square');
    if (state === 'idle' && returnFocusAfterExit && startButton) {
      returnFocusAfterExit = false;
      startButton.focus({ preventScroll: true });
    }
    requestRender();
  }

  function tickGame(now) {
    var speed = Math.max(68, 126 - score * 2.2);
    if (now - lastTick < speed) return;
    lastTick = now;
    direction = nextDirection;
    var head = {
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y
    };
    var collision = !cellIsInside(head.x, head.y) || snake.some(function (segment) { return segment.x === head.x && segment.y === head.y; });
    if (collision) {
      state = 'gameover';
      syncControls();
      beep(96, 0.22, 0.045, 'sawtooth');
      return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 1;
      setText(scoreNode, String(score).padStart(3, '0'));
      beep(620 + score * 16, 0.055, 0.028, 'square');
      spawnFood();
    } else {
      snake.pop();
    }
  }

  function drawGame() {
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#f1b64a';
    ctx.shadowColor = '#f1b64a';
    ctx.shadowBlur = 12;
    ctx.fillRect(food.x * cellSize + cellSize * 0.31, food.y * cellSize + cellSize * 0.31, cellSize * 0.38, cellSize * 0.38);
    ctx.shadowBlur = 0;

    snake.forEach(function (segment, index) {
      var inset = index === 0 ? 2 : 3.5;
      ctx.fillStyle = index === 0 ? '#c1ffbf' : (index % 2 ? '#63e978' : '#3fbe5a');
      ctx.fillRect(segment.x * cellSize + inset, segment.y * cellSize + inset, cellSize - inset * 2, cellSize - inset * 2);
      if (index === 0) {
        ctx.fillStyle = '#06240d';
        ctx.fillRect(segment.x * cellSize + cellSize * 0.62, segment.y * cellSize + cellSize * 0.28, 3, 3);
      }
    });
    ctx.restore();

    if (state === 'paused' || state === 'gameover') {
      ctx.fillStyle = 'rgba(1,10,4,0.74)';
      ctx.fillRect(82, center - 42, size - 164, 84);
      ctx.strokeStyle = state === 'gameover' ? '#c85d42' : '#f1b64a';
      ctx.strokeRect(82, center - 42, size - 164, 84);
      ctx.fillStyle = state === 'gameover' ? '#ff896d' : '#f1c977';
      ctx.font = '700 21px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(state === 'gameover' ? 'SIGNAL LOST' : 'CLOCK HALTED', center, center + 1);
      if (state === 'gameover') {
        ctx.fillStyle = '#b7d9b9';
        ctx.font = '700 10px monospace';
        ctx.fillText('RETURN PORTRAIT / ESC TO CLOSE', center, center + 24);
      }
    }
  }

  function render(time) {
    frameId = 0;
    if (!visible || document.hidden) return;
    lastFrame = time;
    drawRadarBase(time);

    if (state === 'idle') {
      drawPortrait(0);
    } else if (state === 'morph-in') {
      var inAmount = ease((time - transitionStart) / transitionDuration);
      drawPortrait(inAmount);
      if (inAmount >= 1) {
        state = 'running';
        lastTick = time;
        syncControls();
      }
    } else if (state === 'morph-out') {
      var outAmount = 1 - ease((time - transitionStart) / transitionDuration);
      drawPortrait(outAmount);
      if (outAmount <= 0) {
        state = 'idle';
        syncControls();
        if (returnFocusAfterExit && startButton) {
          returnFocusAfterExit = false;
          startButton.focus({ preventScroll: true });
        }
      }
    } else {
      if (state === 'running') tickGame(time);
      drawGame();
    }

    if (!reducedMotion || state !== 'idle') requestRender();
  }

  function requestRender() {
    if (!frameId && visible && !document.hidden) frameId = requestAnimationFrame(render);
  }

  function setDirection(x, y) {
    if (state !== 'running') return;
    if (x === -direction.x && y === -direction.y) return;
    nextDirection = { x: x, y: y };
  }

  canvas.addEventListener('keydown', function (event) {
    var handled = false;
    var key = event.key.toLowerCase();
    if (state === 'running' && (event.key === 'ArrowUp' || key === 'w')) {
      setDirection(0, -1);
      handled = true;
    } else if (state === 'running' && (event.key === 'ArrowDown' || key === 's')) {
      setDirection(0, 1);
      handled = true;
    } else if (state === 'running' && (event.key === 'ArrowLeft' || key === 'a')) {
      setDirection(-1, 0);
      handled = true;
    } else if (state === 'running' && (event.key === 'ArrowRight' || key === 'd')) {
      setDirection(1, 0);
      handled = true;
    } else if (event.key === ' ' && (state === 'running' || state === 'paused')) {
      togglePause();
      handled = true;
    }
    if (handled) event.preventDefault();
  });

  canvas.addEventListener('pointerdown', function (event) {
    if (state !== 'running' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    touchStart = { x: event.clientX, y: event.clientY };
    touchPointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    canvas.focus();
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener('pointerup', function (event) {
    if (event.pointerId !== touchPointerId) return;
    var start = touchStart;
    touchStart = null;
    touchPointerId = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!start || state !== 'running') return;
    var dx = event.clientX - start.x;
    var dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? 1 : -1, 0);
    else setDirection(0, dy > 0 ? 1 : -1);
  }, { passive: true });

  function clearPointer(event) {
    if (touchPointerId === null || (event && event.pointerId !== touchPointerId)) return;
    touchStart = null;
    touchPointerId = null;
  }

  canvas.addEventListener('pointercancel', clearPointer);
  canvas.addEventListener('lostpointercapture', clearPointer);

  function togglePause() {
    if (state === 'running') state = 'paused';
    else if (state === 'paused') {
      state = 'running';
      lastTick = performance.now();
    } else return;
    syncControls();
    beep(state === 'paused' ? 190 : 420, 0.05, 0.02, 'square');
    requestRender();
  }

  if (startButton) {
    startButton.addEventListener('click', function () {
      if (state === 'morph-in') exitGame({ restoreFocus: true });
      else if (state !== 'morph-out') startGame();
    });
  }

  if (pauseButton) pauseButton.addEventListener('click', togglePause);
  if (exitButton) {
    exitButton.addEventListener('click', function () {
      exitGame({ restoreFocus: true });
    });
  }

  if (soundButton) {
    soundButton.addEventListener('click', function () {
      soundEnabled = !soundEnabled;
      try { localStorage.setItem('nh-machine-sound', soundEnabled ? 'on' : 'off'); } catch (error) {}
      syncControls();
      if (soundEnabled) {
        unlockAudio();
        beep(520, 0.07, 0.025, 'square');
      }
    });
  }

  document.addEventListener('machine:sectionchange', function (event) {
    if (soundEnabled) beep(260 + event.detail.index * 56, 0.045, 0.014, 'square');
    if (event.detail.index !== 0 && state !== 'idle') exitGame({ immediate: true, silent: true });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || state === 'idle') return;
    event.preventDefault();
    exitGame({ restoreFocus: true });
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
      if (state === 'running') {
        state = 'paused';
        syncControls();
      }
    } else {
      requestRender();
    }
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (!visible && state !== 'idle') exitGame({ immediate: true, silent: true });
      if (visible) requestRender();
      else if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
    }, { threshold: 0.02 }).observe(canvas);
  }

  var portrait = new Image();
  portrait.onload = function () { processPortrait(portrait); };
  portrait.onerror = function () {
    portraitReady = false;
    syncControls();
    requestRender();
  };
  portrait.src = document.querySelector('img[alt="Nathan Hor"]')?.src || './img/hor.png';

  syncControls();
  requestRender();
}());
