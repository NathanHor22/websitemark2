(function () {
  'use strict';

  var modules = Array.prototype.slice.call(document.querySelectorAll('.server-module'));
  var stops = Array.prototype.slice.call(document.querySelectorAll('.section-drive__stop'));
  var drive = document.querySelector('.section-drive');
  var track = document.querySelector('.section-drive__track');
  var handle = document.querySelector('.section-drive__handle');
  var readout = document.querySelector('.section-drive__readout span');
  var status = document.querySelector('.section-drive__status');
  var mobileReadout = document.querySelector('.mobile-drive__readout');
  var mobileStepButtons = document.querySelectorAll('[data-drive-step]');
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!modules.length) return;

  var activeIndex = 0;
  var dragging = false;
  var dragPointerId = null;
  var scrollQueued = false;
  var pointerQueued = false;
  var readoutTimer = 0;
  var pendingPointer = { x: window.innerWidth * 0.72, y: window.innerHeight * 0.28 };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function moduleLabel(index) {
    var module = modules[index];
    return module ? module.getAttribute('data-module-label') || module.id.toUpperCase() : '';
  }

  function moduleCode(index) {
    var module = modules[index];
    return module ? module.getAttribute('data-module') || String(index).padStart(2, '0') : '00';
  }

  function driveTravel() {
    if (!track || !handle) return 0;
    return Math.max(0, track.clientHeight - handle.offsetHeight - 10);
  }

  function handleYForIndex(index) {
    return modules.length > 1 ? driveTravel() * (index / (modules.length - 1)) : 0;
  }

  function setHandleY(y, immediate) {
    if (!handle) return;
    handle.classList.toggle('is-direct', Boolean(immediate));
    handle.style.setProperty('--drive-y', clamp(y, 0, driveTravel()) + 'px');
  }

  function turnReadout(code) {
    if (!readout || readout.textContent === code) return;
    if (readoutTimer) window.clearTimeout(readoutTimer);
    if (reducedMotion || !readout.animate) {
      readout.textContent = code;
      return;
    }

    var oldAnimation = readout.getAnimations ? readout.getAnimations()[0] : null;
    if (oldAnimation) oldAnimation.cancel();
    var animation = readout.animate([
      { transform: 'perspective(80px) rotateX(0deg)', opacity: 1 },
      { transform: 'perspective(80px) rotateX(-88deg)', opacity: 0.35, offset: 0.48 },
      { transform: 'perspective(80px) rotateX(88deg)', opacity: 0.35, offset: 0.52 },
      { transform: 'perspective(80px) rotateX(0deg)', opacity: 1 }
    ], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });

    readoutTimer = window.setTimeout(function () {
      readout.textContent = code;
      readoutTimer = 0;
    }, 205);

    animation.addEventListener('finish', function () {
      readout.style.transform = '';
      readout.style.opacity = '';
    }, { once: true });
  }

  function updateMachineState(index, options) {
    options = options || {};
    index = clamp(index, 0, modules.length - 1);
    var changed = index !== activeIndex;
    activeIndex = index;
    var label = moduleLabel(index);
    var code = moduleCode(index);

    modules.forEach(function (module, moduleIndex) {
      module.classList.toggle('is-active', moduleIndex === index);
      module.classList.toggle('is-before', moduleIndex < index);
      module.classList.toggle('is-after', moduleIndex > index);
      module.setAttribute('data-module-state', moduleIndex === index ? 'ready' : 'standby');
    });

    stops.forEach(function (stop, stopIndex) {
      var selected = stopIndex === index;
      stop.classList.toggle('is-active', selected);
      if (selected) stop.setAttribute('aria-current', 'location');
      else stop.removeAttribute('aria-current');
    });

    if (!dragging || options.forceHandle) setHandleY(handleYForIndex(index), false);
    turnReadout(code);

    if (handle) {
      handle.setAttribute('aria-valuenow', String(index));
      handle.setAttribute('aria-valuetext', label.charAt(0) + label.slice(1).toLowerCase() + ', section ' + (index + 1) + ' of ' + modules.length);
    }

    if (status) status.innerHTML = '<i></i> ' + label + ' READY';
    if (mobileReadout) {
      mobileReadout.href = '#' + modules[index].id;
      mobileReadout.innerHTML = '<span>' + code + '</span> ' + label;
    }

    document.documentElement.style.setProperty('--active-module', String(index));

    if (changed) {
      document.dispatchEvent(new CustomEvent('machine:sectionchange', {
        detail: { index: index, id: modules[index].id, label: label, code: code }
      }));
    }
  }

  function navigateTo(index, focusSection) {
    index = clamp(index, 0, modules.length - 1);
    updateMachineState(index, { forceHandle: true });
    modules[index].scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
    if (window.history && history.replaceState) history.replaceState(null, '', '#' + modules[index].id);
    if (focusSection) {
      window.setTimeout(function () {
        modules[index].setAttribute('tabindex', '-1');
        modules[index].focus({ preventScroll: true });
      }, reducedMotion ? 0 : 620);
    }
  }

  stops.forEach(function (stop, index) {
    stop.addEventListener('click', function (event) {
      event.preventDefault();
      navigateTo(index, false);
    });
  });

  mobileStepButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      navigateTo(activeIndex + Number(button.getAttribute('data-drive-step')), false);
    });
  });

  if (mobileReadout) {
    mobileReadout.addEventListener('click', function (event) {
      event.preventDefault();
      navigateTo(activeIndex, false);
    });
  }

  if (handle && track) {
    handle.addEventListener('keydown', function (event) {
      var next = activeIndex;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'PageDown') next += 1;
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft' || event.key === 'PageUp') next -= 1;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = modules.length - 1;
      else return;
      event.preventDefault();
      navigateTo(next, false);
    });

    handle.addEventListener('pointerdown', function (event) {
      if (event.button !== 0) return;
      dragging = true;
      dragPointerId = event.pointerId;
      handle.setPointerCapture(event.pointerId);
      handle.classList.add('is-dragging');
      event.preventDefault();
    });

    handle.addEventListener('pointermove', function (event) {
      if (!dragging || event.pointerId !== dragPointerId) return;
      var rect = track.getBoundingClientRect();
      var y = event.clientY - rect.top - handle.offsetHeight / 2;
      setHandleY(y, true);
      var previewIndex = Math.round((clamp(y, 0, driveTravel()) / Math.max(1, driveTravel())) * (modules.length - 1));
      handle.setAttribute('aria-valuenow', String(previewIndex));
      handle.setAttribute('aria-valuetext', moduleLabel(previewIndex) + ', section ' + (previewIndex + 1) + ' of ' + modules.length);
      turnReadout(moduleCode(previewIndex));
    });

    function endDrag(event) {
      if (!dragging || event.pointerId !== dragPointerId) return;
      var rect = track.getBoundingClientRect();
      var y = event.clientY - rect.top - handle.offsetHeight / 2;
      var index = Math.round((clamp(y, 0, driveTravel()) / Math.max(1, driveTravel())) * (modules.length - 1));
      dragging = false;
      dragPointerId = null;
      handle.classList.remove('is-dragging', 'is-direct');
      navigateTo(index, false);
    }

    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  }

  function updateFromScroll() {
    scrollQueued = false;
    if (dragging) return;
    var target = window.innerHeight * 0.46;
    var closest = 0;
    var closestDistance = Infinity;
    modules.forEach(function (module, index) {
      var rect = module.getBoundingClientRect();
      var center = rect.top + Math.min(rect.height, window.innerHeight) * 0.5;
      var distance = Math.abs(center - target);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = index;
      }
    });
    updateMachineState(closest);
    var maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    document.documentElement.style.setProperty('--scroll-progress', (window.scrollY / maxScroll).toFixed(4));
  }

  window.addEventListener('scroll', function () {
    if (!scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(updateFromScroll);
    }
  }, { passive: true });

  window.addEventListener('resize', function () {
    setHandleY(handleYForIndex(activeIndex), true);
    updateFromScroll();
  });

  window.addEventListener('pointermove', function (event) {
    if (event.pointerType === 'touch') return;
    pendingPointer.x = event.clientX;
    pendingPointer.y = event.clientY;
    if (pointerQueued) return;
    pointerQueued = true;
    requestAnimationFrame(function () {
      pointerQueued = false;
      var x = pendingPointer.x / Math.max(1, window.innerWidth);
      var y = pendingPointer.y / Math.max(1, window.innerHeight);
      document.documentElement.style.setProperty('--pointer-x', (x * 100).toFixed(2) + '%');
      document.documentElement.style.setProperty('--pointer-y', (y * 100).toFixed(2) + '%');
      document.documentElement.style.setProperty('--grid-x', ((x - 0.5) * 8).toFixed(2) + 'px');
      document.documentElement.style.setProperty('--grid-y', ((y - 0.5) * 8).toFixed(2) + 'px');
    });
  }, { passive: true });

  var initialIndex = modules.findIndex(function (module) { return '#' + module.id === window.location.hash; });
  updateMachineState(initialIndex >= 0 ? initialIndex : 0, { forceHandle: true });
  requestAnimationFrame(updateFromScroll);
}());
