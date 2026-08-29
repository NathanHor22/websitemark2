(function () {
  'use strict';

  var modules = Array.prototype.slice.call(document.querySelectorAll('.server-module'));
  var stops = Array.prototype.slice.call(document.querySelectorAll('.section-drive__stop'));
  var track = document.querySelector('.section-drive__track');
  var handle = document.querySelector('.section-drive__handle');
  var readout = document.querySelector('.section-drive__readout span');
  var status = document.querySelector('.section-drive__status');
  var mobileReadout = document.querySelector('.mobile-drive__readout');
  var mobileStepButtons = document.querySelectorAll('[data-drive-step]');
  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reducedMotion = Boolean(motionQuery && motionQuery.matches);

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

  function smoothstep(start, end, value) {
    var amount = clamp((value - start) / Math.max(0.0001, end - start), 0, 1);
    return amount * amount * (3 - 2 * amount);
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
    });

    stops.forEach(function (stop, stopIndex) {
      var selected = stopIndex === index;
      stop.classList.toggle('is-active', selected);
      if (selected) stop.setAttribute('aria-current', 'location');
      else stop.removeAttribute('aria-current');
    });

    if (((!dragging && !options.skipHandle) || options.forceHandle)) setHandleY(handleYForIndex(index), false);
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
    var moduleTop = window.scrollY + modules[index].getBoundingClientRect().top;
    window.scrollTo({
      top: Math.max(0, moduleTop),
      behavior: reducedMotion ? 'auto' : 'smooth',
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

  function updateBayMechanics(module, rect, focusY, moduleIndex) {
    var inside = Math.min(focusY - rect.top, rect.bottom - focusY);
    var ramp = Math.max(120, Math.min(340, window.innerHeight * 0.3, rect.height * 0.22));
    var progress = reducedMotion ? 1 : smoothstep(0, ramp, inside);
    var latch = smoothstep(0.02, 0.16, progress);
    var seam = smoothstep(0.1, 0.3, progress);
    var extraction = smoothstep(0.22, 0.68, progress);
    var deployment = smoothstep(0.56, 0.9, progress);
    var power = smoothstep(0.82, 1, progress);
    var closedAngle = module.classList.contains('server-module--hero') ? -64 : -9;
    var mechanicalState = 'locked';

    if (power > 0.96) mechanicalState = 'ready';
    else if (progress > 0.02) mechanicalState = rect.top + rect.height * 0.5 >= focusY ? 'deploying' : 'retracting';

    module.style.setProperty('--bay-p', progress.toFixed(4));
    module.style.setProperty('--latch-p', latch.toFixed(4));
    module.style.setProperty('--seam-p', seam.toFixed(4));
    module.style.setProperty('--extract-p', extraction.toFixed(4));
    module.style.setProperty('--deploy-p', deployment.toFixed(4));
    module.style.setProperty('--power-p', power.toFixed(4));
    module.style.setProperty('--tray-y', (extraction * 7).toFixed(2) + 'px');
    module.style.setProperty('--tray-z', (extraction * 34).toFixed(2) + 'px');
    module.style.setProperty('--screen-angle', (closedAngle * (1 - deployment)).toFixed(2) + 'deg');
    module.style.setProperty('--screen-y', (-8 * (1 - deployment)).toFixed(2) + 'px');
    module.style.setProperty('--keyboard-y', (-34 * (1 - deployment)).toFixed(2) + 'px');
    module.style.setProperty('--keyboard-z', (-18 + 46 * deployment).toFixed(2) + 'px');
    module.style.setProperty('--shutter-y', (-104 * deployment).toFixed(2) + '%');
    module.style.setProperty('--shutter-opacity', (1 - deployment).toFixed(4));
    module.style.setProperty('--screen-content-opacity', (0.24 + power * 0.76).toFixed(4));
    module.style.setProperty('--cavity-alpha', (0.08 + seam * 0.92).toFixed(4));
    module.style.setProperty('--latch-left', (-12 * latch).toFixed(2) + 'px');
    module.style.setProperty('--latch-right', (12 * latch).toFixed(2) + 'px');
    module.classList.toggle('is-mechanically-active', progress > 0.02 && progress < 0.999);
    module.classList.toggle('is-deployed', progress >= 0.999);
    module.setAttribute('data-module-state', mechanicalState);

    var bayReadout = module.querySelector('[data-bay-readout]');
    var readoutText = moduleLabel(moduleIndex) + ' ' + mechanicalState.toUpperCase();
    if (bayReadout && bayReadout.textContent !== readoutText) bayReadout.textContent = readoutText;

    return progress;
  }

  function updateFromScroll() {
    scrollQueued = false;
    if (dragging) return;
    var target = window.innerHeight * 0.52;
    var rects = modules.map(function (module) { return module.getBoundingClientRect(); });
    var closest = 0;
    var closestDistance = Infinity;
    rects.forEach(function (rect, index) {
      var distance = rect.top > target ? rect.top - target : (rect.bottom < target ? target - rect.bottom : 0);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = index;
      }
    });

    if (closest !== activeIndex && rects[activeIndex]) {
      var activeRect = rects[activeIndex];
      var activeDistance = activeRect.top > target ? activeRect.top - target : (activeRect.bottom < target ? target - activeRect.bottom : 0);
      if (closestDistance + 24 >= activeDistance) closest = activeIndex;
    }

    updateMachineState(closest, { skipHandle: true });
    modules.forEach(function (module, index) {
      updateBayMechanics(module, rects[index], target, index);
    });
    var maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var scrollProgress = window.scrollY / maxScroll;
    document.documentElement.style.setProperty('--scroll-progress', scrollProgress.toFixed(4));
    document.documentElement.style.setProperty('--rack-offset', reducedMotion ? '0px' : (-((window.scrollY * 0.14) % 164)).toFixed(1) + 'px');
    if (handle) {
      var focusDocumentY = window.scrollY + target;
      var centers = rects.map(function (rect) { return window.scrollY + rect.top + rect.height * 0.5; });
      var driveIndex = 0;
      if (focusDocumentY >= centers[centers.length - 1]) driveIndex = centers.length - 1;
      else {
        for (var centerIndex = 0; centerIndex < centers.length - 1; centerIndex += 1) {
          if (focusDocumentY < centers[centerIndex] || focusDocumentY > centers[centerIndex + 1]) continue;
          driveIndex = centerIndex + ((focusDocumentY - centers[centerIndex]) / Math.max(1, centers[centerIndex + 1] - centers[centerIndex]));
          break;
        }
      }
      setHandleY(driveTravel() * (driveIndex / Math.max(1, modules.length - 1)), true);
    }
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

  if (motionQuery) {
    var onMotionPreferenceChange = function (event) {
      reducedMotion = event.matches;
      updateFromScroll();
    };
    if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionPreferenceChange);
    else if (motionQuery.addListener) motionQuery.addListener(onMotionPreferenceChange);
  }

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
