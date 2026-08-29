import { initDiagnosticSnake } from './js/diagnostic-snake.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const safeStorage = {
  get(key, fallback = null) {
    try {
      return window.localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable in privacy modes; the interface still works.
    }
  },
  sessionGet(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  sessionSet(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // A repeated boot is harmless when session storage is unavailable.
    }
  }
};

function initBootSequence() {
  const boot = qs('[data-boot-sequence]');
  if (!boot) return;

  const skipControls = qsa('[data-skip-boot]');
  const interfaceElements = qsa('.machine-shell, .control-bank');
  const terminal = qs('[data-boot-terminal]', boot);
  const command = qs('[data-boot-command]', boot);
  const output = qs('[data-boot-output]', boot);
  const result = qs('[data-boot-result]', boot);
  const status = qs('[data-boot-status]', boot);
  const duration = reducedMotion.matches ? 820 : 4950;
  const timers = [];
  const commandText = 'terminal --init --profile portfolio';
  let streamFrame = 0;
  let streamStarted = 0;
  let manualBoost = 0;
  let renderedLines = 0;
  let released = false;
  interfaceElements.forEach(element => { element.inert = true; });

  const after = (callback, delay) => {
    const timer = window.setTimeout(callback, delay);
    timers.push(timer);
    return timer;
  };

  const bootLines = Array.from({ length: 216 }, (_, index) => {
    const sequence = String(index + 1).padStart(4, '0');
    const address = (0x03f8 + index * 16).toString(16).padStart(4, '0');
    const checksum = ((index * 7919 + 65521) % 0xffff).toString(16).padStart(4, '0').toUpperCase();
    const channel = ['isa0', 'video0', 'archive0', 'input0', 'audio0', 'memory0'][index % 6];
    const messages = [
      `${channel}: probing address 0x${address} ........ [OK]`,
      `memory.page/${sequence}: checksum ${checksum} verified`,
      `archive.record/${sequence}: descriptor mounted read-only`,
      `video_memory: indexing frame ${sequence}/0216`,
      `interface: binding channel ${channel} to local bus`,
      `telemetry: packet ${sequence} latency ${(index % 9) + 1}.0ms`,
      `driver/${channel}: interrupt vector ${(index % 12) + 3} assigned`,
      `operator.profile: permission map ${checksum} accepted`
    ];
    if (index === 18) return '$ mount /dev/archive0 /mnt/projects --read-only';
    if (index === 46) return '$ probe --bus isa0 --ports 03f8,02f8';
    if (index === 78) return '$ visual-memory --index ./img --verify';
    if (index === 112) return '$ bind interface/right-control-bank --local';
    if (index === 137) return '$ verify --all --quiet';
    if (index === 170) return '$ link profile/fc-0201 --channel video0';
    if (index === 201) return '$ handoff --target portfolio-interface';
    return messages[index % messages.length];
  });

  const renderStream = now => {
    if (released || !streamStarted) return;
    const target = Math.min(bootLines.length, Math.floor((now - streamStarted) / 11.3) + manualBoost);
    if (target > renderedLines) {
      renderedLines = target;
      output.textContent = bootLines.slice(Math.max(0, renderedLines - 24), renderedLines).join('\n');
      output.scrollTop = output.scrollHeight;
    }
    if (renderedLines < bootLines.length) streamFrame = window.requestAnimationFrame(renderStream);
  };

  const typeCommand = () => {
    let character = 0;
    const typeNext = () => {
      if (released) return;
      character += 1;
      command.textContent = commandText.slice(0, character);
      if (character < commandText.length) after(typeNext, 10 + (character % 5) * 3);
    };
    typeNext();
  };

  const onBootKey = event => {
    if (released || !boot.classList.contains('is-streaming') || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key.length === 1 || event.key === 'Enter') manualBoost = Math.min(bootLines.length, manualBoost + 4);
  };

  const release = (forceFocus = false) => {
    if (released) return;
    released = true;
    timers.forEach(timer => window.clearTimeout(timer));
    window.cancelAnimationFrame(streamFrame);
    document.removeEventListener('keydown', onBootKey);
    const activeElement = document.activeElement;
    const shouldMoveFocus = forceFocus || boot.contains(activeElement) || skipControls.includes(activeElement);
    safeStorage.sessionSet('nh-boot-seen', '1');
    document.body.classList.add('is-booted');
    document.body.classList.remove('is-booting');
    interfaceElements.forEach(element => { element.inert = false; });
    if (shouldMoveFocus) qs('#main-content')?.focus({ preventScroll: true });
    boot.inert = true;
    boot.setAttribute('aria-hidden', 'true');
    document.dispatchEvent(new CustomEvent('machine:bootcomplete'));
    window.setTimeout(() => boot.remove(), reducedMotion.matches ? 0 : 520);
  };

  skipControls.forEach(control => control.addEventListener('click', event => {
    event.preventDefault();
    if (released) qs('#main-content')?.focus({ preventScroll: true });
    else release(true);
  }));

  document.addEventListener('keydown', onBootKey);
  terminal?.setAttribute('aria-hidden', 'false');
  after(() => boot.classList.add('is-powered'), 40);

  if (reducedMotion.matches) {
    command.textContent = commandText;
    output.textContent = 'memory check ................................ [OK]\nproject archive .............................. [OK]\nvisual interface ............................. [OK]';
    result.style.opacity = '1';
    boot.classList.add('is-success');
    if (status) status.textContent = 'Terminal successfully booted';
  } else {
    after(typeCommand, 250);
    after(() => {
      boot.classList.add('is-streaming');
      streamStarted = performance.now();
      streamFrame = window.requestAnimationFrame(renderStream);
    }, 650);
    after(() => {
      renderedLines = bootLines.length;
      output.textContent = bootLines.slice(-24).join('\n');
      boot.classList.remove('is-streaming');
      boot.classList.add('is-success');
      if (status) status.textContent = 'Terminal successfully booted';
    }, 3100);
    after(() => boot.classList.add('is-releasing'), 4600);
  }

  after(release, duration);
}

function initClock() {
  const output = qs('[data-clock]');
  if (!output) return;

  const render = () => {
    output.textContent = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kuala_Lumpur'
    }).format(new Date());
  };

  render();
  window.setInterval(render, 1000);
}

function initRoleReadout() {
  const output = qs('[data-role-readout]');
  const hero = qs('#hero');
  if (!output || !hero) return;

  const roles = [
    'CREATIVE TECHNOLOGIST',
    'AR DEVELOPER',
    'AGENTIC AI BUILDER',
    'FULL-STACK DEVELOPER',
    'PHOTOGRAPHER'
  ];
  let roleIndex = 0;
  let character = 0;
  let deleting = false;
  let timer = 0;
  let homeActive = hero.classList.contains('is-active');

  if (reducedMotion.matches) {
    output.textContent = roles[0];
    return;
  }

  output.textContent = '';

  const canRun = () => homeActive && !document.hidden && document.body.classList.contains('is-booted');

  const schedule = delay => {
    window.clearTimeout(timer);
    if (canRun()) timer = window.setTimeout(step, delay);
  };

  const step = () => {
    if (!canRun()) return;
    const role = roles[roleIndex];

    if (!deleting) {
      character += 1;
      output.textContent = role.slice(0, character);
      if (character >= role.length) {
        deleting = true;
        schedule(1450);
      } else {
        schedule(55);
      }
      return;
    }

    character -= 1;
    output.textContent = role.slice(0, Math.max(0, character));
    if (character <= 0) {
      deleting = false;
      roleIndex = (roleIndex + 1) % roles.length;
      schedule(220);
    } else {
      schedule(28);
    }
  };

  const resume = () => {
    window.clearTimeout(timer);
    if (canRun()) schedule(character ? 260 : 80);
  };

  document.addEventListener('machine:sectionchange', event => {
    homeActive = event.detail?.id === 'hero';
    resume();
  });
  document.addEventListener('machine:bootcomplete', resume);
  document.addEventListener('visibilitychange', resume);
  resume();
}

function initSound() {
  const button = qs('[data-sound-toggle]');
  if (!button) return { tick() {} };

  let enabled = safeStorage.get('nh-machine-sound', 'off') === 'on';
  let context;

  const sync = () => {
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Turn interface sound off' : 'Turn interface sound on');
    button.classList.toggle('is-on', enabled);
  };

  const tick = (frequency = 110, length = 0.035, volume = 0.028) => {
    if (!enabled) return;
    context ??= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === 'suspended') context.resume();

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + length);
  };

  button.addEventListener('click', () => {
    enabled = !enabled;
    safeStorage.set('nh-machine-sound', enabled ? 'on' : 'off');
    sync();
    if (enabled) tick(92, 0.07, 0.04);
  });

  sync();
  return { tick };
}

function initSectionController(sound) {
  const sections = qsa('.rack-section');
  const controls = qsa('[data-section-target]');
  const currentCode = qs('[data-current-code]');
  const currentLabel = qs('[data-current-section]');
  const srStatus = qs('[data-sr-status]');
  const root = document.documentElement;
  const transition = qs('.section-transition');
  let currentIndex = -1;
  let pendingIndex = -1;
  let swapTimer = 0;
  let finishTimer = 0;

  if (!sections.length) return;

  const activate = (index, source = 'navigation') => {
    const next = sections[index];
    if (!next || index === currentIndex) return;
    const previous = sections[currentIndex];
    const focusWasInside = previous?.contains(document.activeElement);
    const nextControl = controls.find(control => control.dataset.sectionTarget === next.id);
    if (focusWasInside) nextControl?.focus({ preventScroll: true });
    currentIndex = index;

    sections.forEach((section, itemIndex) => {
      const selected = itemIndex === index;
      section.classList.toggle('is-active', selected);
      section.classList.toggle('is-before', itemIndex < index);
      section.classList.toggle('is-after', itemIndex > index);
      section.setAttribute('aria-hidden', String(!selected));
      section.inert = !selected;
      section.tabIndex = -1;
    });

    controls.forEach(control => {
      const selected = control.dataset.sectionTarget === next.id;
      control.classList.toggle('is-active', selected);
      if (selected) control.setAttribute('aria-current', 'location');
      else control.removeAttribute('aria-current');
    });

    const code = next.dataset.sectionCode ?? String(index).padStart(2, '0');
    const label = next.dataset.sectionLabel ?? next.id;
    if (currentCode) currentCode.textContent = code;
    if (currentLabel) currentLabel.textContent = label;
    if (source !== 'initial' && srStatus) srStatus.textContent = label + ' section';

    root.style.setProperty('--section-index', index);
    root.style.setProperty('--screen-progress', String(index / Math.max(1, sections.length - 1)));
    document.dispatchEvent(new CustomEvent('machine:sectionchange', {
      detail: { index, id: next.id, label, code }
    }));
  };

  const navigate = (id, historyMode = 'push') => {
    const target = qs('#' + CSS.escape(id));
    if (!target) return;
    const targetIndex = sections.indexOf(target);
    if (targetIndex < 0) return;
    const href = '#' + id;

    if (historyMode === 'push' && window.location.hash !== href) history.pushState({ section: id }, '', href);
    if (historyMode === 'replace') history.replaceState({ section: id }, '', href);

    if (targetIndex === pendingIndex) {
      return;
    }

    window.clearTimeout(swapTimer);
    window.clearTimeout(finishTimer);

    if (targetIndex === currentIndex) {
      pendingIndex = -1;
      transition?.classList.remove('is-closing');
      document.body.classList.remove('is-switching-section');
      if (historyMode !== 'none') sound.tick(62, 0.025, 0.015);
      return;
    }

    pendingIndex = targetIndex;

    sound.tick(76, 0.045, 0.025);
    document.dispatchEvent(new CustomEvent('machine:navigationstart', { detail: { id } }));

    const perform = () => {
      pendingIndex = -1;
      activate(targetIndex);
    };

    if (reducedMotion.matches || !transition) {
      perform();
      document.dispatchEvent(new CustomEvent('machine:navigationend', { detail: { id } }));
      return;
    }

    transition.classList.remove('is-closing');
    void transition.offsetWidth;
    transition.classList.add('is-closing');
    document.body.classList.add('is-switching-section');
    swapTimer = window.setTimeout(perform, 250);
    finishTimer = window.setTimeout(() => {
      transition.classList.remove('is-closing');
      document.body.classList.remove('is-switching-section');
      document.dispatchEvent(new CustomEvent('machine:navigationend', { detail: { id } }));
    }, 560);
  };

  controls.forEach(control => {
    control.addEventListener('click', event => {
      event.preventDefault();
      navigate(control.dataset.sectionTarget);
    });
  });

  const controlStrip = qs('.control-bank__keys');
  controlStrip?.addEventListener('keydown', event => {
    const activeControl = event.target.closest('[data-section-target]');
    const activeIndex = controls.indexOf(activeControl);
    if (activeIndex < 0) return;
    let nextIndex = activeIndex;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (activeIndex + 1) % controls.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (activeIndex - 1 + controls.length) % controls.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = controls.length - 1;
    else return;
    event.preventDefault();
    controls[nextIndex].focus();
    navigate(controls[nextIndex].dataset.sectionTarget);
  });

  const syncFromLocation = () => {
    const id = window.location.hash.slice(1) || 'hero';
    const valid = sections.some(section => section.id === id);
    if (!valid) history.replaceState({ section: 'hero' }, '', '#hero');
    navigate(valid ? id : 'hero', 'none');
  };

  window.addEventListener('popstate', syncFromLocation);
  window.addEventListener('hashchange', syncFromLocation);

  const initialId = window.location.hash.slice(1);
  const initialIndex = sections.findIndex(section => section.id === initialId);
  activate(initialIndex >= 0 ? initialIndex : 0, 'initial');
  if (initialId && initialIndex < 0) history.replaceState({ section: 'hero' }, '', '#hero');
}

const projectRecords = {
  synapze: {
    code: 'REC—01',
    title: 'Synapze Website Rebuild',
    award: 'Production system · Creative technology',
    mode: 'live',
    liveUrl: 'https://www.synapzemy.com/',
    repository: 'https://github.com/NathanHor22/Synapze-testing-site-pre-prod',
    objective: "Rebuild Synapze's public website around clear discovery and purposeful event storytelling.",
    system: 'A responsive production site with answer-engine optimisation and location integrations.',
    result: "A live production platform supporting Synapze's projects, services and regional presence.",
    tags: ['AEO', 'Maps API', 'Web']
  },
  jaga: {
    code: 'REC—02',
    title: 'Jaga',
    award: 'Top 3 · OpenAI Build Week',
    mode: 'live',
    liveUrl: 'https://jagacare.vercel.app/',
    repository: 'https://github.com/NathanHor22/codex-hackathon',
    objective: "Help people assess suspicious calls and messages across Malaysia's language landscape.",
    system: 'A five-language scam-detection assistant paired with an accessible ESP32-S3 hardware companion.',
    result: 'Placed Top 3 at OpenAI Build Week and deployed as a live browser demonstration.',
    tags: ['Safety AI', 'Multilingual', 'ESP32-S3']
  },
  afa: {
    code: 'REC—03',
    title: 'AFA Tunnel WebAR',
    award: 'Live WebAR experience · AFA Tunnel',
    mode: 'live',
    liveUrl: 'https://afa-tunnel-webarexperience.vercel.app/',
    objective: 'Turn the AFA Tunnel project into an explorable browser-based augmented-reality experience.',
    system: 'A mobile-first WebAR application delivered through the browser without a separate native app.',
    result: 'Deployed as a live experience for direct access on compatible mobile devices.',
    tags: ['WebAR', 'Immersive', 'Mobile']
  },
  gallery: {
    code: 'REC—04',
    title: 'Synapze Interactive Gallery',
    award: 'Interactive installation · Offline-first computer vision',
    mode: 'live',
    liveUrl: 'https://synapze-interactive-gallery.vercel.app/',
    embeddable: false,
    objective: 'Create physical-feeling gallery games controlled with hand gestures instead of dedicated sensors.',
    system: 'MediaPipe and OpenCV tracking drive Python and Pygame bird-flight and slingshot experiences through a standard webcam.',
    result: 'A webcam-only, Kinect-free gallery designed to keep processing as offline as possible.',
    tags: ['MediaPipe', 'OpenCV', 'Pygame']
  },
  purrmit: {
    code: 'REC—05',
    title: 'Purrmit',
    award: 'Top 3 Finalist · Healthcare Operations',
    mode: 'live',
    liveUrl: 'https://purrmit.lovable.app/',
    repository: 'https://github.com/NathanHor22/Purrmit_Your-GL-Copilot',
    objective: 'Reduce guarantee-letter clearing and reconciliation friction in hospital operations.',
    system: 'An agentic AI healthcare copilot designed around the actual guarantee-letter workflow.',
    result: 'Placed Top 3 out of 47 teams at the Lovable Vibeathon KL at AWS Malaysia.',
    tags: ['Agentic AI', 'Healthcare', 'Automation']
  },
  persephone: {
    code: 'REC—06',
    title: 'Persephone',
    award: 'Top 5 · Robotics & Physical AI',
    mode: 'video',
    video: './img/Persephone.mp4',
    autoplay: true,
    poster: './img/employable.png',
    objective: 'Build a wearable event concierge that gives attendees a persistent personal interface.',
    system: 'An ESP32-S3 wearable with edge intelligence, an LVGL touchscreen and Agora real-time audio.',
    result: 'Placed Top 5 in the Robotics & Physical AI track and is presented here as a hardware demonstration.',
    tags: ['ESP32-S3', 'Edge AI', 'Agora']
  },
  tenun: {
    code: 'REC—07',
    title: 'Tenun',
    award: 'Recorded build · TalentBank CareerOS',
    mode: 'video',
    video: './img/web/video/Tenun.mp4',
    autoplay: true,
    poster: './img/Tenun.png',
    repository: 'https://github.com/NathanHor22/tenun-pre-prod',
    objective: 'Connect candidate profiles, intelligent job matching and employer workflows in one career platform.',
    system: 'A full-stack CareerOS with candidate, vacancy and employer dashboard surfaces.',
    result: 'The backend is currently offline, so the complete interface is retained as a recorded application walkthrough.',
    tags: ['TypeScript', 'Full-stack', 'CareerOS']
  }
};

function initProjects(sound) {
  const browser = qs('.project-browser');
  if (!browser) return;

  const keys = Object.keys(projectRecords);
  const buttons = qsa('[data-project]', browser);
  const frame = qs('[data-project-frame]', browser);
  const video = qs('[data-project-video]', browser);
  const play = qs('[data-video-toggle]', browser);
  const reload = qs('[data-project-reload]', browser);
  const external = qs('[data-project-external]', browser);
  const externalNotice = qs('[data-project-external-notice]', browser);
  const shutter = qs('.project-preview__shutter', browser);
  const mobileBack = qs('[data-project-back]', browser);
  const projectIndex = qs('.project-index', browser);
  const mobileProjectView = window.matchMedia('(max-width: 680px)');
  let current = 0;
  let busy = false;
  let wantsPlayback = false;
  let projectsActive = qs('#projects')?.classList.contains('is-active') ?? false;

  const fields = {
    code: qs('[data-project-code]', browser),
    state: qs('[data-project-state]', browser),
    title: qs('[data-project-title]', browser),
    award: qs('[data-project-award]', browser),
    objective: qs('[data-project-objective]', browser),
    system: qs('[data-project-system]', browser),
    result: qs('[data-project-result]', browser),
    tags: qs('[data-project-tags]', browser),
    live: qs('[data-project-live]', browser),
    repository: qs('[data-project-repository]', browser)
  };

  const selectedRecord = () => projectRecords[keys[current]];

  const syncPlayButton = () => {
    const playing = !video.hidden && !video.paused;
    play?.classList.toggle('is-playing', playing);
    play?.setAttribute('aria-label', playing ? 'Pause project video' : 'Play project video');
  };

  const unmountLiveSession = () => {
    if (!frame) return;
    frame.dataset.url = '';
    if (frame.getAttribute('src') !== 'about:blank') frame.src = 'about:blank';
  };

  const mountLiveSession = record => {
    if (!frame || record?.mode !== 'live' || record.embeddable === false || !projectsActive || document.hidden) return;
    if (frame.dataset.url === record.liveUrl) return;
    fields.state.textContent = 'Remote application / connecting';
    frame.dataset.url = record.liveUrl;
    frame.src = record.liveUrl;
  };

  const configureLink = (link, url, label) => {
    if (!link) return;
    link.hidden = !url;
    if (!url) {
      link.removeAttribute('href');
      return;
    }
    link.href = url;
    link.firstChild.textContent = `${label} `;
  };

  const configureViewer = record => {
    const isLive = record.mode === 'live';
    const canEmbed = isLive && record.embeddable !== false;
    video.pause();
    wantsPlayback = false;
    syncPlayButton();

    frame.hidden = !canEmbed;
    video.hidden = isLive;
    play.hidden = isLive;
    reload.hidden = !canEmbed;
    external.hidden = !isLive;
    externalNotice.hidden = !isLive || canEmbed;

    if (isLive) {
      video.removeAttribute('src');
      video.removeAttribute('poster');
      video.load();
      frame.title = `${record.title} live application`;
      external.href = record.liveUrl;
      if (canEmbed) {
        fields.state.textContent = projectsActive ? 'Remote application / connecting' : 'Remote application / standing by';
        mountLiveSession(record);
      } else {
        unmountLiveSession();
        fields.state.textContent = 'External application / secure launch';
      }
    } else {
      unmountLiveSession();
      frame.title = 'Live application viewer inactive';
      video.poster = record.poster || '';
      video.src = record.video;
      video.load();
      fields.state.textContent = 'Recorded hardware session / local';
      wantsPlayback = record.autoplay === true;
      if (wantsPlayback && projectsActive && !document.hidden) {
        video.play().then(syncPlayButton).catch(() => {
          wantsPlayback = false;
          syncPlayButton();
        });
      }
    }
  };

  const render = (index, immediate = false) => {
    const normalized = (index + keys.length) % keys.length;
    const key = keys[normalized];
    const record = projectRecords[key];
    if (!record || (busy && !immediate)) return;
    busy = !immediate;
    video.pause();
    unmountLiveSession();
    wantsPlayback = false;
    syncPlayButton();
    if (!immediate) shutter?.classList.add('is-changing');

    const apply = () => {
      current = normalized;
      buttons.forEach(button => {
        const selected = button.dataset.project === key;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });

      fields.code.textContent = record.code;
      fields.title.textContent = record.title;
      fields.award.textContent = record.award;
      fields.objective.textContent = record.objective;
      fields.system.textContent = record.system;
      fields.result.textContent = record.result;
      fields.tags.replaceChildren(...record.tags.map(tag => {
        const item = document.createElement('li');
        item.textContent = tag;
        return item;
      }));
      configureLink(fields.live, record.liveUrl, 'Open live application');
      configureLink(fields.repository, record.repository, 'Open repository');
      configureViewer(record);
      sound.tick(128 + normalized * 9, 0.03, 0.018);
    };

    if (immediate || reducedMotion.matches) {
      apply();
      busy = false;
      shutter?.classList.remove('is-changing');
    } else {
      window.setTimeout(apply, 210);
      window.setTimeout(() => {
        shutter?.classList.remove('is-changing');
        busy = false;
      }, 450);
    }
  };

  const openMobileDetail = () => {
    if (!mobileProjectView.matches) return;
    browser.classList.add('is-mobile-detail');
    projectIndex.inert = true;
    mobileBack?.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => mobileBack?.focus({ preventScroll: true }), reducedMotion.matches ? 0 : 230);
  };

  const closeMobileDetail = () => {
    browser.classList.remove('is-mobile-detail');
    projectIndex.inert = false;
    mobileBack?.setAttribute('aria-hidden', 'true');
    buttons[current]?.focus({ preventScroll: true });
  };

  buttons.forEach(button => button.addEventListener('click', () => {
    render(keys.indexOf(button.dataset.project));
    openMobileDetail();
  }));
  mobileBack?.addEventListener('click', closeMobileDetail);
  browser.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !browser.classList.contains('is-mobile-detail')) return;
    event.preventDefault();
    closeMobileDetail();
  });
  const syncMobileProjectView = event => {
    if (event.matches) return;
    browser.classList.remove('is-mobile-detail');
    projectIndex.inert = false;
    mobileBack?.setAttribute('aria-hidden', 'true');
  };
  mobileProjectView.addEventListener?.('change', syncMobileProjectView);
  projectIndex.addEventListener('keydown', event => {
    const direction = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[event.key];
    if (!direction) return;
    event.preventDefault();
    const next = (current + direction + keys.length) % keys.length;
    render(next);
    buttons[next]?.focus({ preventScroll: true });
  });

  play?.addEventListener('click', async () => {
    if (video.paused) {
      wantsPlayback = true;
      try {
        await video.play();
      } catch {
        wantsPlayback = false;
      }
    } else {
      wantsPlayback = false;
      video.pause();
    }
    syncPlayButton();
    sound.tick(video.paused ? 86 : 146, 0.035, 0.02);
  });

  video.addEventListener('play', syncPlayButton);
  video.addEventListener('pause', syncPlayButton);
  frame.addEventListener('load', () => {
    const record = selectedRecord();
    if (record?.mode === 'live' && frame.dataset.url === record.liveUrl) {
      fields.state.textContent = 'Remote application / session active';
    }
  });
  reload?.addEventListener('click', () => {
    const record = selectedRecord();
    if (record?.mode !== 'live') return;
    unmountLiveSession();
    fields.state.textContent = 'Remote application / reconnecting';
    window.requestAnimationFrame(() => mountLiveSession(record));
    sound.tick(118, 0.035, 0.02);
  });

  const syncPlaybackVisibility = async () => {
    if (!projectsActive || document.hidden) {
      video.pause();
      unmountLiveSession();
      if (selectedRecord()?.mode === 'live' && selectedRecord()?.embeddable !== false) fields.state.textContent = 'Remote application / standing by';
    } else if (selectedRecord()?.mode === 'live') {
      mountLiveSession(selectedRecord());
    } else if (wantsPlayback) {
      try {
        await video.play();
      } catch {
        wantsPlayback = false;
        syncPlayButton();
      }
    }
  };

  document.addEventListener('machine:sectionchange', event => {
    projectsActive = event.detail?.id === 'projects';
    syncPlaybackVisibility();
  });
  document.addEventListener('visibilitychange', syncPlaybackVisibility);

  render(0, true);
}

function initFieldArchive(sound) {
  const archive = qs('[data-field-archive]');
  if (!archive) return;

  const directory = qs('[data-field-directory]', archive);
  const stage = qs('[data-field-stage]', archive);
  const records = qsa('[data-field-record]', archive);
  const details = qsa('[data-field-detail]', archive);
  const position = qs('[data-field-position]', archive);
  const stateReadout = qs('[data-field-state]', archive);
  const srStatus = qs('[data-sr-status]');
  let selected = 0;
  let openKey = '';
  let transitionTimer = 0;

  const currentDetail = () => details.find(detail => detail.dataset.fieldDetail === openKey);
  const currentScroller = () => qs('.field-dossier__text', currentDetail());

  const setSelected = (index, moveFocus = false) => {
    selected = (index + records.length) % records.length;
    records.forEach((record, recordIndex) => record.classList.toggle('is-selected', recordIndex === selected));
    if (position) position.textContent = String(selected + 1).padStart(2, '0') + ' / ' + String(records.length).padStart(2, '0');
    if (moveFocus) records[selected].focus({ preventScroll: true });
    sound.tick(96 + selected * 8, 0.024, 0.012);
  };

  const openRecord = index => {
    if (!records[index] || openKey) return;
    window.clearTimeout(transitionTimer);
    setSelected(index);
    const record = records[selected];
    const detail = details.find(item => item.dataset.fieldDetail === record.dataset.fieldRecord);
    if (!detail) return;

    openKey = record.dataset.fieldRecord;
    detail.hidden = false;
    stage.inert = false;
    stage.setAttribute('aria-hidden', 'false');
    directory.inert = true;
    records.forEach(item => item.setAttribute('aria-expanded', String(item === record)));
    archive.classList.add('is-changing');
    if (stateReadout) stateReadout.textContent = 'Record deploying';
    sound.tick(72, 0.06, 0.026);

    window.requestAnimationFrame(() => {
      archive.classList.add('is-open');
      transitionTimer = window.setTimeout(() => {
        archive.classList.remove('is-changing');
        if (stateReadout) stateReadout.textContent = 'Record open';
        if (srStatus) srStatus.textContent = 'Field record ' + (selected + 1) + ' of ' + records.length + ' opened';
        currentScroller()?.focus({ preventScroll: true });
      }, reducedMotion.matches ? 0 : 390);
    });
  };

  const closeRecord = (restoreFocus = true) => {
    if (!openKey) return;
    window.clearTimeout(transitionTimer);
    const detail = currentDetail();
    const record = records[selected];
    detail?.querySelectorAll('video').forEach(video => video.pause());
    stage.inert = true;
    archive.classList.add('is-changing', 'is-closing');
    archive.classList.remove('is-open');
    if (stateReadout) stateReadout.textContent = 'Record retracting';
    sound.tick(64, 0.055, 0.022);

    transitionTimer = window.setTimeout(() => {
      detail.hidden = true;
      openKey = '';
      stage.setAttribute('aria-hidden', 'true');
      directory.inert = false;
      records.forEach(item => item.setAttribute('aria-expanded', 'false'));
      archive.classList.remove('is-changing', 'is-closing');
      if (stateReadout) stateReadout.textContent = 'Directory ready';
      if (srStatus) srStatus.textContent = 'Returned to field record directory';
      if (restoreFocus) record.focus({ preventScroll: true });
    }, reducedMotion.matches ? 0 : 360);
  };

  const scrollOpenRecord = direction => {
    const scroller = currentScroller();
    if (!scroller) return;
    scroller.scrollBy({
      top: direction * Math.max(80, scroller.clientHeight * 0.62),
      behavior: reducedMotion.matches ? 'auto' : 'smooth'
    });
    sound.tick(direction > 0 ? 112 : 102, 0.02, 0.01);
  };

  records.forEach((record, index) => {
    record.addEventListener('focus', () => setSelected(index));
    record.addEventListener('click', () => openRecord(index));
  });

  qsa('[data-field-back]', archive).forEach(button => button.addEventListener('click', () => closeRecord()));
  qsa('[data-field-step]', archive).forEach(button => {
    button.addEventListener('click', () => {
      const direction = Number(button.dataset.fieldStep);
      if (openKey) scrollOpenRecord(direction);
      else setSelected(selected + direction, true);
    });
  });

  archive.addEventListener('keydown', event => {
    if (openKey) {
      if (event.key === 'Escape' || event.key === 'ArrowLeft') {
        event.preventDefault();
        closeRecord();
      } else if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault();
        scrollOpenRecord(1);
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        scrollOpenRecord(-1);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected(selected + 1, true);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected(selected - 1, true);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setSelected(0, true);
    } else if (event.key === 'End') {
      event.preventDefault();
      setSelected(records.length - 1, true);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      openRecord(selected);
    }
  });

  document.addEventListener('machine:sectionchange', event => {
    if (event.detail?.id !== 'activity') currentDetail()?.querySelectorAll('video').forEach(video => video.pause());
  });

  setSelected(0);
}

const photoArchive = {
  sports: {
    label: 'Sports study',
    alt: [
      'Athlete competing on an indoor court',
      'Sports action captured from the sideline',
      'Competitor moving through a decisive play',
      'Athletic movement framed against the venue',
      'Candid moment during a sporting event'
    ],
    files: ['sports1.jpg', 'sports2.jpg', 'sports3.jpg', 'sports4.jpg', 'sports5.jpg'].map(file => './img/web/Sports/' + file)
  },
  posters: {
    label: 'Poster study',
    alt: [
      'Experimental graphic poster composition',
      'Typography-led graphic poster',
      'Layered colour and type poster study',
      'Editorial poster composition',
      'Graphic design poster from Nathan’s archive'
    ],
    files: ['poster1.jpg', 'posters2.jpg', 'posters3.jpg', 'posters4.jpg', 'posters5.jpg'].map(file => './img/web/Posters/' + file)
  },
  street: {
    label: 'Street study',
    alt: [
      'Street scene observed in available light',
      'Pedestrian moment within an urban setting',
      'Architectural detail from the street archive',
      'Candid urban scene with layered movement',
      'Quiet street photograph from Nathan’s archive'
    ],
    files: ['street1.jpg', 'street2.jpg', 'street3.jpg', 'street4.jpg', 'street5.jpg'].map(file => './img/web/Street/' + file)
  },
  events: {
    label: 'Event study',
    alt: [
      'Crowd and speaker during a live event',
      'Event participant captured between sessions',
      'Stage atmosphere during a technology event',
      'Candid networking moment at an event',
      'Live programme moment from Nathan’s event archive'
    ],
    files: ['events1.jpg', 'events2.jpg', 'events3.jpg', 'events4.jpg', 'events5.jpg'].map(file => './img/web/Events/' + file)
  }
};

function initPhotography(sound) {
  const consoleElement = qs('.photo-console');
  if (!consoleElement) return;

  const categoryButtons = qsa('[data-photo-category]', consoleElement);
  const preview = qs('[data-photo-preview]', consoleElement);
  const frame = qs('.photo-console__frame', consoleElement);
  const caption = qs('[data-photo-caption]', consoleElement);
  const counter = qs('[data-photo-counter]', consoleElement);
  const contact = qs('[data-photo-contact]', consoleElement);
  const shutter = qs('.photo-console__shutter', consoleElement);
  let category = 'sports';
  let index = 0;
  let busy = false;
  let touchStart = null;
  let queuedRequest = null;
  let categoryVersion = 0;

  const syncCategoryButtons = () => {
    categoryButtons.forEach(button => {
      const selected = button.dataset.photoCategory === category;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  };

  const renderContactSheet = () => {
    const record = photoArchive[category];
    const buttons = qsa(':scope > button', contact);
    buttons.forEach((button, itemIndex) => {
      const image = qs('img', button);
      if (!image || !record.files[itemIndex]) return;
      button.dataset.photoIndex = String(itemIndex);
      button.classList.toggle('is-selected', itemIndex === index);
      button.setAttribute('aria-pressed', String(itemIndex === index));
      button.setAttribute('aria-label', 'View ' + record.label.toLowerCase() + ' ' + (itemIndex + 1));
      image.src = record.files[itemIndex];
      image.alt = '';
      image.loading = 'lazy';
      button.onclick = () => render(Number(button.dataset.photoIndex), category);
    });
  };

  const preloadCategory = (record, version) => {
    record.files.forEach(source => {
      const image = new Image();
      image.decoding = 'async';
      image.src = source;
      if (image.decode) image.decode().catch(() => {});
      image.addEventListener('load', () => {
        if (version !== categoryVersion) image.src = '';
      }, { once: true });
    });
  };

  const apply = () => {
    const record = photoArchive[category];
    const safeIndex = (index + record.files.length) % record.files.length;
    index = safeIndex;
    const portrait = category !== 'events';
    frame?.classList.toggle('is-portrait', portrait);
    frame?.classList.toggle('is-landscape', !portrait);
    preview.src = record.files[safeIndex];
    preview.alt = record.alt[safeIndex];
    preview.width = portrait ? 1067 : 1600;
    preview.height = portrait ? 1600 : 1067;
    frame?.setAttribute('aria-label', record.alt[safeIndex] + '. Use left and right arrow keys to change photographs.');
    caption.textContent = record.label + ' ' + String(safeIndex + 1).padStart(2, '0');
    counter.textContent = String(safeIndex + 1).padStart(2, '0') + ' / ' + String(record.files.length).padStart(2, '0');
    renderContactSheet();
    sound.tick(104 + safeIndex * 7, 0.028, 0.018);
  };

  const render = (nextIndex, nextCategory = category) => {
    if (!photoArchive[nextCategory]) return;
    if (busy) {
      queuedRequest = { category: nextCategory, index: nextIndex };
      return;
    }
    const categoryChanged = nextCategory !== category;
    if (categoryChanged) {
      category = nextCategory;
      index = 0;
      syncCategoryButtons();
      categoryVersion += 1;
      preloadCategory(photoArchive[category], categoryVersion);
      contact.setAttribute('aria-busy', 'true');
      contact.classList.remove('is-swapping-in');
      contact.classList.add('is-swapping-out');
      categoryButtons.forEach(button => { button.disabled = true; });
    }
    index = nextIndex;
    if (reducedMotion.matches) {
      apply();
      contact.classList.remove('is-swapping-in', 'is-swapping-out');
      contact.removeAttribute('aria-busy');
      categoryButtons.forEach(button => { button.disabled = false; });
      return;
    }
    busy = true;
    shutter?.classList.add('is-changing');
    window.setTimeout(() => {
      apply();
      if (categoryChanged) {
        contact.classList.remove('is-swapping-out');
        void contact.offsetWidth;
        contact.classList.add('is-swapping-in');
      }
    }, 210);
    window.setTimeout(() => {
      shutter?.classList.remove('is-changing');
      contact.classList.remove('is-swapping-in', 'is-swapping-out');
      contact.removeAttribute('aria-busy');
      categoryButtons.forEach(button => { button.disabled = false; });
      busy = false;
      const next = queuedRequest;
      queuedRequest = null;
      if (next) window.requestAnimationFrame(() => render(next.index, next.category));
    }, categoryChanged ? 520 : 450);
  };

  categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
      const requestedCategory = button.dataset.photoCategory;
      if (busy) {
        queuedRequest = requestedCategory === category ? null : { category: requestedCategory, index: 0 };
        return;
      }
      if (requestedCategory === category) return;
      render(0, requestedCategory);
    });
  });

  qsa('[data-photo-step]', consoleElement).forEach(button => {
    button.addEventListener('click', () => render(index + Number(button.dataset.photoStep)));
  });

  frame?.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      render(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      render(index + 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      render(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      render(photoArchive[category].files.length - 1);
    }
  });

  frame?.addEventListener('touchstart', event => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  frame?.addEventListener('touchend', event => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy)) return;
    render(index + (dx < 0 ? 1 : -1));
  }, { passive: true });

  renderContactSheet();
  frame?.classList.add('is-portrait');
}

function initContactTerminal(sound) {
  const button = qs('[data-copy-email]');
  if (!button) return;
  const label = qs('span', button);
  const status = qs('[data-sr-status]');
  let restoreTimer = 0;

  const legacyCopy = value => {
    const field = document.createElement('textarea');
    try {
      field.value = value;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.append(field);
      field.select();
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      field.remove();
    }
  };

  button.addEventListener('click', async () => {
    const email = button.dataset.email;
    let copied = false;
    try {
      await navigator.clipboard.writeText(email);
      copied = true;
    } catch {
      copied = legacyCopy(email);
    }

    button.focus({ preventScroll: true });

    window.clearTimeout(restoreTimer);
    if (label) label.textContent = copied ? 'Address copied' : 'Copy unavailable';
    if (status) status.textContent = copied ? 'Email address copied to clipboard' : 'Could not copy email address';
    sound.tick(copied ? 154 : 72, 0.055, 0.024);
    restoreTimer = window.setTimeout(() => {
      if (label) label.textContent = 'Copy address';
    }, 1800);
  });
}

function initDiagnosticPlaceholder(sound) {
  const start = qs('[data-diagnostic-start]');
  const status = qs('[data-sr-status]');
  if (!start) return;
  start.addEventListener('click', () => {
    sound.tick(164, 0.06, 0.025);
    if (status) status.textContent = 'Diagnostic system loading';
    document.dispatchEvent(new CustomEvent('machine:diagnosticrequest'));
  });
}

function initProgressiveEnhancements() {
  if (reducedMotion.matches) return;

  const load = async () => {
    try {
      const [{ initMachineScene }, { initInterfaceMotion }] = await Promise.all([
        import('./js/machine-scene.js'),
        import('./js/interface-motion.js')
      ]);
      const activate = () => {
        initMachineScene({ reducedMotion: false });
        initInterfaceMotion({ reducedMotion: false });
      };
      if (document.body.classList.contains('is-booted')) activate();
      else document.addEventListener('machine:bootcomplete', activate, { once: true });
    } catch {
      // The complete HTML interface remains usable if WebGL or animation modules fail.
    }
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(load, { timeout: 900 });
  } else {
    window.setTimeout(load, 260);
  }
}

function init() {
  initBootSequence();
  initClock();
  initRoleReadout();
  const sound = initSound();
  initSectionController(sound);
  initProjects(sound);
  initFieldArchive(sound);
  initPhotography(sound);
  initContactTerminal(sound);
  initDiagnosticPlaceholder(sound);
  initDiagnosticSnake({ reducedMotion: reducedMotion.matches });
  initProgressiveEnhancements();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
