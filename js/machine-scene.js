import {
  BoxGeometry,
  CatmullRomCurve3,
  Clock,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer
} from 'three';

const palette = {
  paper: 0xd8d2b9,
  panel: 0xc2bba3,
  shadow: 0x6d685c,
  graphite: 0x34322d,
  amber: 0xb16d49
};

function createRackColumn(height, material) {
  const group = new Group();
  const frame = new Mesh(new BoxGeometry(0.34, height, 0.22), material);
  group.add(frame);

  const seamMaterial = new MeshStandardMaterial({
    color: palette.graphite,
    roughness: 0.86,
    metalness: 0.05
  });

  for (let y = -height / 2 + 0.42; y < height / 2; y += 0.62) {
    const seam = new Mesh(new BoxGeometry(0.38, 0.018, 0.245), seamMaterial);
    seam.position.set(0, y, 0.012);
    group.add(seam);
  }

  return group;
}

function createVent(width, count, material) {
  const vent = new Group();
  const gap = width / count;

  for (let index = 0; index < count; index += 1) {
    const slat = new Mesh(new BoxGeometry(gap * 0.56, 0.03, 0.035), material);
    slat.position.x = -width / 2 + gap * 0.5 + gap * index;
    vent.add(slat);
  }

  return vent;
}

function createCable(points, color, radius = 0.025) {
  const curve = new CatmullRomCurve3(points);
  const geometry = new TubeGeometry(curve, 42, radius, 5, false);
  const material = new MeshStandardMaterial({
    color,
    roughness: 0.74,
    metalness: 0.03
  });
  return new Mesh(geometry, material);
}

export function initMachineScene(options = {}) {
  const canvas = document.querySelector('[data-machine-environment]');
  if (!canvas || !window.WebGLRenderingContext) return () => {};

  const reducedMotion = Boolean(options.reducedMotion);
  let renderer;

  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: false,
      antialias: !reducedMotion,
      powerPreference: 'low-power'
    });
  } catch {
    canvas.hidden = true;
    return () => {};
  }

  renderer.setClearColor(palette.panel, 1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  const scene = new Scene();
  scene.fog = new Fog(palette.panel, 7.8, 14);

  const camera = new PerspectiveCamera(34, 1, 0.1, 30);
  camera.position.set(0, 0, 8.2);

  const rack = new Group();
  scene.add(rack);

  const panelMaterial = new MeshStandardMaterial({
    color: palette.paper,
    roughness: 0.93,
    metalness: 0.01
  });
  const insetMaterial = new MeshStandardMaterial({
    color: palette.shadow,
    roughness: 0.88,
    metalness: 0.02
  });

  const backplane = new Mesh(new BoxGeometry(12.5, 10.5, 0.15), panelMaterial);
  backplane.position.z = -1.05;
  rack.add(backplane);

  [-5.35, -4.82, 4.82, 5.35].forEach((x, index) => {
    const column = createRackColumn(11, index % 2 ? panelMaterial : insetMaterial);
    column.position.set(x, 0, -0.45 + (index % 2) * 0.08);
    rack.add(column);
  });

  for (let y = -5; y <= 5; y += 1.25) {
    const crossbar = new Mesh(new BoxGeometry(10.3, 0.06, 0.16), insetMaterial);
    crossbar.position.set(0, y, -0.76);
    rack.add(crossbar);
  }

  const topVent = createVent(8.6, 44, insetMaterial);
  topVent.position.set(0, 4.6, -0.56);
  rack.add(topVent);

  const bottomVent = createVent(8.6, 44, insetMaterial);
  bottomVent.position.set(0, -4.6, -0.56);
  rack.add(bottomVent);

  const cableA = createCable([
    new Vector3(-5.15, 4.9, 0.05),
    new Vector3(-5.35, 2.4, 0.34),
    new Vector3(-4.95, -0.5, 0.12),
    new Vector3(-5.22, -4.8, 0.22)
  ], palette.graphite, 0.032);
  rack.add(cableA);

  const cableB = createCable([
    new Vector3(5.28, 5, 0.2),
    new Vector3(5.02, 2.2, 0.42),
    new Vector3(5.35, -1.4, 0.18),
    new Vector3(5.05, -4.95, 0.34)
  ], palette.amber, 0.025);
  rack.add(cableB);

  const indicatorMaterial = new MeshStandardMaterial({
    color: palette.amber,
    emissive: palette.amber,
    emissiveIntensity: 0.9,
    roughness: 0.42
  });
  const indicators = [];

  for (let index = 0; index < 5; index += 1) {
    const lamp = new Mesh(new SphereGeometry(0.055, 8, 6), indicatorMaterial.clone());
    lamp.position.set(index % 2 ? 4.92 : -4.92, 3.7 - index * 1.72, 0.1);
    lamp.userData.phase = index * 0.83;
    indicators.push(lamp);
    rack.add(lamp);
  }

  const ambient = new HemisphereLight(0xfff9df, 0x5b574e, 2.2);
  scene.add(ambient);

  const keyLight = new DirectionalLight(0xfff5d5, 2.8);
  keyLight.position.set(-4, 7, 8);
  scene.add(keyLight);

  const sectionLight = new PointLight(palette.amber, 0.9, 8, 2);
  sectionLight.position.set(4.7, 2.6, 3.2);
  scene.add(sectionLight);

  const pointer = new Vector2(0, 0);
  const pointerTarget = new Vector2(0, 0);
  const rackSections = [...document.querySelectorAll('.rack-section')];
  let sectionTarget = Math.max(0, rackSections.findIndex(section => section.classList.contains('is-active')));
  let frame = 0;
  let running = !document.hidden;
  const clock = new Clock();

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    if (reducedMotion) renderer.render(scene, camera);
  };

  const onPointerMove = event => {
    if (reducedMotion) return;
    pointerTarget.x = (event.clientX / window.innerWidth - 0.5) * 2;
    pointerTarget.y = (event.clientY / window.innerHeight - 0.5) * 2;
  };

  const onSectionChange = event => {
    sectionTarget = event.detail?.index ?? 0;
    sectionLight.position.y = 3.4 - sectionTarget * 1.65;
    sectionLight.intensity = 1.1;
    if (reducedMotion) {
      rack.position.y = (2 - sectionTarget) * 0.035;
      renderer.render(scene, camera);
    }
  };

  const render = () => {
    if (!running) return;
    const elapsed = clock.getElapsedTime();
    pointer.lerp(pointerTarget, 0.045);
    camera.position.x += (pointer.x * 0.18 - camera.position.x) * 0.035;
    camera.position.y += (-pointer.y * 0.12 - camera.position.y) * 0.035;
    rack.rotation.y += (pointer.x * 0.012 - rack.rotation.y) * 0.03;
    rack.rotation.x += (-pointer.y * 0.006 - rack.rotation.x) * 0.03;
    rack.position.y += (((2 - sectionTarget) * 0.035) - rack.position.y) * 0.025;
    rack.position.x += (((sectionTarget - 2) * -0.025) - rack.position.x) * 0.025;
    sectionLight.intensity += (0.48 - sectionLight.intensity) * 0.035;

    indicators.forEach((lamp, index) => {
      const selected = index === sectionTarget;
      lamp.material.emissiveIntensity = selected
        ? 1.15 + Math.sin(elapsed * 3.4) * 0.12
        : 0.18 + Math.max(0, Math.sin(elapsed * 1.35 + lamp.userData.phase)) * 0.08;
    });

    renderer.render(scene, camera);
    frame = window.requestAnimationFrame(render);
  };

  const onVisibility = () => {
    running = !document.hidden;
    if (running && !reducedMotion) {
      clock.getDelta();
      frame = window.requestAnimationFrame(render);
    } else {
      window.cancelAnimationFrame(frame);
    }
  };

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('machine:sectionchange', onSectionChange);
  document.addEventListener('visibilitychange', onVisibility);

  resize();
  if (reducedMotion) {
    renderer.render(scene, camera);
  } else {
    render();
  }

  return () => {
    running = false;
    window.cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('machine:sectionchange', onSectionChange);
    document.removeEventListener('visibilitychange', onVisibility);
    renderer.dispose();
  };
}
