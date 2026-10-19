const casing = {
  face: '#c7bea3',
  edge: '#aba18a',
  light: '#e1d9c2',
  line: '#766f60',
  ink: '#49473e',
  cable: '#4b4b40',
  amber: '#a45b35'
};

function fastener(context, x, y) {
  context.fillStyle = casing.edge;
  context.beginPath();
  context.arc(x, y, 4.5, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = casing.line;
  context.lineWidth = 1;
  context.stroke();
  context.beginPath();
  context.moveTo(x - 2, y + 1.5);
  context.lineTo(x + 2, y - 1.5);
  context.stroke();
}

function socket(context, x, y, horizontal = false) {
  context.fillStyle = casing.ink;
  context.fillRect(x - 5, y - 7, 10, 14);
  context.fillStyle = casing.edge;
  if (horizontal) {
    context.fillRect(x - 7, y - 5, 14, 10);
    context.fillStyle = casing.line;
    context.fillRect(x - 4, y - 3, 8, 6);
  } else {
    context.fillRect(x - 3, y - 9, 6, 18);
  }
}

export function initMachineScene(options = {}) {
  const canvas = document.querySelector('[data-machine-environment]');
  const shell = document.querySelector('.machine-shell');
  if (!canvas || !shell) return () => {};

  let context;
  try {
    context = canvas.getContext('2d', { alpha: true });
  } catch {
    canvas.hidden = true;
    return () => {};
  }
  if (!context) {
    canvas.hidden = true;
    return () => {};
  }

  const sections = [...document.querySelectorAll('.rack-section')];
  let selectedIndex = Math.max(0, sections.findIndex(section => section.classList.contains('is-active')));
  let pendingDraw = 0;
  let disposed = false;

  // A fixed service assembly, not a moving backdrop. Reduced motion uses this
  // same stationary drawing; the option remains part of the scene API.
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 1.5);

  const draw = () => {
    pendingDraw = 0;
    if (disposed) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const visible = width > 900;
    canvas.hidden = !visible;
    if (!visible) return;

    const ratio = pixelRatio();
    const backingWidth = Math.round(width * ratio);
    const backingHeight = Math.round(height * ratio);
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const bounds = shell.getBoundingClientRect();
    // All artwork stays outside the readable panel, even if its width changes.
    const margin = Math.max(0, bounds.left);
    if (margin < 48 || height < 280) return;

    context.save();
    context.beginPath();
    context.rect(0, 0, margin, height);
    context.clip();

    const plateWidth = Math.min(52, margin - 32);
    const x = Math.round(margin - plateWidth - 22) + 0.5;
    const top = 24.5;
    const bottom = height - 24.5;
    const middle = x + plateWidth / 2;
    const join = top + 69;

    // The end caps and screws share the same joins as the service cover.
    context.fillStyle = 'rgba(68, 61, 44, 0.09)';
    context.fillRect(x + 3, top + 3, plateWidth + 2, bottom - top);
    context.fillStyle = casing.face;
    context.fillRect(x, top, plateWidth, bottom - top);
    context.strokeStyle = casing.line;
    context.lineWidth = 1;
    context.strokeRect(x, top, plateWidth, bottom - top);
    context.strokeStyle = casing.light;
    context.beginPath();
    context.moveTo(x + 1, bottom - 1);
    context.lineTo(x + 1, top + 1);
    context.lineTo(x + plateWidth - 1, top + 1);
    context.stroke();

    context.strokeStyle = casing.line;
    context.beginPath();
    context.moveTo(x, join);
    context.lineTo(x + plateWidth, join);
    context.moveTo(x, bottom - 28);
    context.lineTo(x + plateWidth, bottom - 28);
    context.stroke();
    fastener(context, middle, top + 13);
    fastener(context, middle, bottom - 13);

    // One status lamp and the mounted section number share a small faceplate.
    context.fillStyle = casing.ink;
    context.beginPath();
    context.arc(middle, top + 36, 4.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = casing.amber;
    context.beginPath();
    context.arc(middle, top + 36, 2.5, 0, Math.PI * 2);
    context.fill();
    context.font = '10px "Courier New", monospace';
    context.textAlign = 'center';
    context.fillStyle = casing.ink;
    const code = sections[selectedIndex]?.dataset.sectionCode || String(selectedIndex).padStart(2, '0');
    context.fillText(code, middle, top + 57);

    // A single cable visibly plugs into the cover and the chassis inlet.
    const startY = Math.round(top + (bottom - top) * 0.43);
    const endY = Math.min(bottom - 58, startY + Math.min(170, height * 0.21));
    const inletX = margin - 2;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(middle, startY);
    context.bezierCurveTo(middle, startY + 48, x + plateWidth + 14, endY + 26, inletX, endY);
    context.strokeStyle = 'rgba(48, 44, 35, 0.16)';
    context.lineWidth = 6;
    context.stroke();
    context.strokeStyle = casing.cable;
    context.lineWidth = 3.5;
    context.stroke();
    socket(context, middle, startY);
    socket(context, inletX, endY, true);

    context.restore();
  };

  const scheduleDraw = () => {
    if (!pendingDraw && !disposed) pendingDraw = window.requestAnimationFrame(draw);
  };

  const onSectionChange = event => {
    const nextIndex = Number(event.detail?.index);
    if (Number.isFinite(nextIndex)) {
      selectedIndex = Math.min(Math.max(0, Math.trunc(nextIndex)), Math.max(0, sections.length - 1));
    }
    scheduleDraw();
  };

  window.addEventListener('resize', scheduleDraw);
  document.addEventListener('machine:sectionchange', onSectionChange);
  draw();

  return () => {
    disposed = true;
    window.cancelAnimationFrame(pendingDraw);
    window.removeEventListener('resize', scheduleDraw);
    document.removeEventListener('machine:sectionchange', onSectionChange);
    context.clearRect(0, 0, canvas.width, canvas.height);
  };
}
