import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the production controller without a browser or a second copy of its
// state machine. WAAPI completion is manual so interruption races are repeatable.
const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const controller = source.slice(source.indexOf('function initSectionController(sound) {'), source.indexOf('\nconst projectRecords = {'));
assert.ok(controller.startsWith('function initSectionController'));

class Target {
  listeners = new Map();
  addEventListener(type, callback) {
    const list = this.listeners.get(type) ?? [];
    list.push(callback);
    this.listeners.set(type, list);
  }
  dispatchEvent(event) {
    for (const callback of this.listeners.get(event.type) ?? []) callback(event);
  }
}

class Classes {
  values = new Set();
  contains(value) { return this.values.has(value); }
  add(...values) { values.forEach(value => this.values.add(value)); }
  remove(...values) { values.forEach(value => this.values.delete(value)); }
  toggle(value, selected = !this.contains(value)) {
    if (selected) this.add(value);
    else this.remove(value);
  }
}

const flush = async () => {
  for (let index = 0; index < 6; index += 1) await Promise.resolve();
};

function setup({ reduced = false, hash = '' } = {}) {
  const document = new Target();
  const window = new Target();
  const media = new Target();
  media.matches = reduced;
  const animations = [];
  const changes = [];
  const completed = [];
  const historyCalls = [];

  class Element extends Target {
    classList = new Classes();
    attributes = new Map();
    style = { values: new Map(), setProperty(name, value) { this.values.set(name, value); } };
    dataset = {};
    inert = false;
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    contains(element) { return element === this || element?.parent === this; }
    closest() { return this; }
    focus(options) { document.activeElement = this; this.focusOptions = options; }
    animate(keyframes, options) {
      let resolve;
      let reject;
      const finished = new Promise((accept, fail) => { resolve = accept; reject = fail; });
      const animation = {
        element: this, keyframes, options, finished, cancelled: false,
        pose: keyframes[0],
        finish() { this.pose = keyframes.at(-1); resolve(); },
        cancel() {
          this.cancelled = true;
          if (this.element.animation === this) this.element.animation = null;
          reject(new Error('Animation cancelled'));
        }
      };
      this.animation = animation;
      animations.push(animation);
      return animation;
    }
  }

  document.body = new Element();
  document.documentElement = new Element();
  document.activeElement = document.body;
  const ids = ['hero', 'projects', 'activity', 'creative', 'contact'];
  const sections = ids.map((id, index) => {
    const section = new Element();
    section.id = id;
    section.dataset = { sectionCode: `0${index}`, sectionLabel: id };
    return section;
  });
  const controls = ids.map(id => {
    const control = new Element();
    control.dataset.sectionTarget = id;
    return control;
  });
  const strip = new Element();
  const status = new Element();
  const code = new Element();
  const label = new Element();
  const singles = new Map([
    ['[data-current-code]', code], ['[data-current-section]', label],
    ['[data-sr-status]', status], ['.control-bank__keys', strip],
    ...sections.map(section => [`#${section.id}`, section])
  ]);
  const qs = selector => singles.get(selector) ?? null;
  const qsa = selector => selector === '.rack-section' ? sections : controls;
  window.location = { hash };
  window.getComputedStyle = element => ({
    transform: element.animation?.pose.transform ?? 'none',
    opacity: String(element.animation?.pose.opacity ?? (element.classList.contains('is-active') ? 1 : 0))
  });
  const history = Object.fromEntries(['pushState', 'replaceState'].map(method => [method, (state, title, href) => {
    window.location.hash = href;
    historyCalls.push({ method, href });
  }]));
  document.addEventListener('machine:sectionchange', event => changes.push(event.detail.id));
  document.addEventListener('machine:navigationend', event => completed.push(event.detail.id));

  const context = vm.createContext({
    document, window, history, reducedMotion: media, qs, qsa,
    CSS: { escape: value => value },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } }
  });
  vm.runInContext(`${controller}\ninitSectionController({ tick() {} });`, context);

  return {
    document, window, media, sections, controls, strip, animations, changes, completed, historyCalls, status,
    click(id) { controls[ids.indexOf(id)].dispatchEvent({ type: 'click', preventDefault() {} }); },
    async finishLatest() { animations.at(-1).finish(); await flush(); },
    assertActive(id) {
      sections.forEach(section => {
        const selected = section.id === id;
        assert.equal(section.classList.contains('is-active'), selected);
        assert.equal(section.inert, !selected);
        assert.equal(section.attributes.get('aria-hidden'), String(!selected));
      });
      controls.forEach(control => assert.equal(control.attributes.get('aria-current'), control.dataset.sectionTarget === id ? 'location' : undefined));
    }
  };
}

{
  const page = setup();
  page.assertActive('hero');
  page.click('contact');
  const interrupted = page.animations.at(-1);
  interrupted.pose = { transform: 'translateY(-6px)', opacity: 0.4 };
  page.click('activity');
  assert.equal(interrupted.cancelled, true);
  assert.equal(page.animations.at(-1).keyframes[0].transform, 'translateY(-6px)');
  assert.equal(page.animations.at(-1).keyframes[0].opacity, '0.4');
  assert.equal(page.controls[2].classList.contains('is-requested'), true);
  interrupted.finish();
  await flush();
  page.assertActive('hero');
  await page.finishLatest();
  page.assertActive('activity');
  await page.finishLatest();
  assert.deepEqual(page.changes, ['hero', 'activity']);
  assert.deepEqual(page.completed, ['activity']);
  assert.equal(page.window.location.hash, '#activity');
  assert.equal(page.document.body.classList.contains('is-switching-section'), false);
}

{
  const page = setup();
  page.click('projects');
  await page.finishLatest();
  const docking = page.animations.at(-1);
  docking.pose = { transform: 'translateY(9px)', opacity: 0.55 };
  page.click('contact');
  assert.equal(docking.cancelled, true);
  assert.equal(page.animations.at(-1).keyframes[0].transform, 'translateY(9px)');
  docking.finish();
  await flush();
  page.assertActive('projects');
  await page.finishLatest();
  await page.finishLatest();
  page.assertActive('contact');
  assert.deepEqual(page.completed, ['contact']);
}

{
  const page = setup();
  page.click('contact');
  page.animations.at(-1).pose = { transform: 'translateY(-8px)', opacity: 0.3 };
  page.click('hero');
  assert.equal(page.animations.at(-1).keyframes[0].transform, 'translateY(-8px)');
  await page.finishLatest();
  page.assertActive('hero');
  assert.deepEqual(page.changes, ['hero']);
  assert.deepEqual(page.completed, ['hero']);
}

{
  const page = setup({ reduced: true, hash: '#creative' });
  page.assertActive('creative');
  assert.equal(page.historyCalls.length, 0);
  page.document.activeElement = { parent: page.sections[3] };
  page.click('contact');
  page.assertActive('contact');
  assert.equal(page.animations.length, 0);
  assert.equal(page.document.activeElement, page.controls[4]);
  assert.equal(page.controls[4].focusOptions.preventScroll, true);
  assert.equal(page.status.textContent, 'contact section');
  page.window.location.hash = '#projects';
  page.window.dispatchEvent({ type: 'popstate' });
  page.window.dispatchEvent({ type: 'hashchange' });
  page.assertActive('projects');
  assert.equal(page.historyCalls.length, 1);
  page.strip.dispatchEvent({ type: 'keydown', target: page.controls[1], key: 'ArrowDown', preventDefault() {} });
  page.assertActive('activity');
  assert.equal(page.document.activeElement, page.controls[2]);
}

{
  const page = setup();
  page.click('activity');
  page.media.matches = true;
  page.media.dispatchEvent({ type: 'change', matches: true });
  await flush();
  page.assertActive('activity');
  assert.equal(page.animations[0].cancelled, true);
  assert.equal(page.document.body.classList.contains('is-switching-section'), false);
  assert.deepEqual(page.completed, ['activity']);
}

{
  const page = setup({ hash: '#missing' });
  page.assertActive('hero');
  assert.equal(page.window.location.hash, '#hero');
  assert.equal(page.historyCalls[0].method, 'replaceState');
}

console.log('Section navigation: interruption, retargeting, docking, reduced motion, deep links, history, focus, keyboard and inert states passed.');
