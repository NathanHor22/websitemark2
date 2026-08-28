(function () {
  'use strict';

  function wrap(value, length) {
    return (value % length + length) % length;
  }

  function PhotoStack(root) {
    this.root = root;
    this.cards = Array.prototype.slice.call(root.querySelectorAll('.carousel-slide'));
    this.counter = document.getElementById(root.id + '-counter');
    this.index = Number(root.getAttribute('data-current-slide')) || 0;
    this.busy = false;
    this.startX = 0;
    this.startY = 0;

    root.setAttribute('role', 'region');
    root.setAttribute('aria-roledescription', 'photograph stack');
    root.setAttribute('tabindex', '0');
    root.style.touchAction = 'pan-y';

    this.cards.forEach(function (card, cardIndex) {
      card.style.removeProperty('opacity');
      var image = card.querySelector('img');
      if (image) {
        image.draggable = false;
        image.decoding = 'async';
        image.loading = cardIndex < 2 ? 'eager' : 'lazy';
      }
    });

    this.bind();
    this.render();
  }

  PhotoStack.prototype.bind = function () {
    var self = this;

    this.root.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        self.move(1);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        self.move(-1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        self.goTo(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        self.goTo(self.cards.length - 1);
      }
    });

    this.root.addEventListener('click', function (event) {
      if (event.target.closest('button, a')) return;
      if (event.target.closest('.carousel-slide.is-front')) self.move(1);
    });

    this.root.addEventListener('pointerdown', function (event) {
      if (event.target.closest('button, a')) return;
      self.startX = event.clientX;
      self.startY = event.clientY;
    }, { passive: true });

    this.root.addEventListener('pointerup', function (event) {
      if (!self.startX && !self.startY) return;
      var dx = event.clientX - self.startX;
      var dy = event.clientY - self.startY;
      self.startX = 0;
      self.startY = 0;
      if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy)) self.move(dx < 0 ? 1 : -1);
    }, { passive: true });
  };

  PhotoStack.prototype.render = function () {
    var self = this;
    var count = this.cards.length;
    this.root.setAttribute('data-current-slide', String(this.index));

    this.cards.forEach(function (card, cardIndex) {
      var distance = wrap(cardIndex - self.index, count);
      card.classList.remove('active', 'is-front', 'is-behind-one', 'is-behind-two', 'is-hidden', 'is-ejecting-next', 'is-ejecting-prev');
      if (distance === 0) card.classList.add('active', 'is-front');
      else if (distance === 1) card.classList.add('is-behind-one');
      else if (distance === 2) card.classList.add('is-behind-two');
      else card.classList.add('is-hidden');

      var isFront = distance === 0;
      card.setAttribute('aria-hidden', String(!isFront));
      card.inert = !isFront;
      var image = card.querySelector('img');
      if (image && distance <= 1) {
        image.loading = 'eager';
        if (image.decode) image.decode().catch(function () {});
      }
    });

    if (this.counter) this.counter.textContent = (this.index + 1) + ' / ' + count;
    this.root.setAttribute('aria-label', 'Frame ' + (this.index + 1) + ' of ' + count + '. Use arrow keys or the previous and next controls.');
  };

  PhotoStack.prototype.goTo = function (index) {
    if (!this.cards.length || this.busy) return;
    var target = wrap(index, this.cards.length);
    if (target === this.index) {
      this.render();
      return;
    }
    var direction = target > this.index ? 1 : -1;
    if (Math.abs(target - this.index) > this.cards.length / 2) direction *= -1;
    this.transitionTo(target, direction);
  };

  PhotoStack.prototype.move = function (direction) {
    if (!this.cards.length || this.busy) return;
    this.transitionTo(wrap(this.index + direction, this.cards.length), direction);
  };

  PhotoStack.prototype.transitionTo = function (target, direction) {
    var self = this;
    var front = this.cards[this.index];
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.busy = true;
    if (front && !reducedMotion) front.classList.add(direction > 0 ? 'is-ejecting-next' : 'is-ejecting-prev');

    window.setTimeout(function () {
      self.index = target;
      self.render();
      self.busy = false;
    }, reducedMotion ? 0 : 340);
  };

  window.photoStackControllers = window.photoStackControllers || {};
  document.querySelectorAll('.photo-stack').forEach(function (root) {
    window.photoStackControllers[root.id] = new PhotoStack(root);
  });
}());
