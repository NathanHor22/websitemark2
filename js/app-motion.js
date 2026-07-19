// Motion One (motion.dev) — springy scroll-reveal entrances for the IBM redesign.
// Loaded after js/motion.min.js, which exposes window.Motion (UMD).
(function () {
  if (!window.Motion) return;
  // Respect users who prefer reduced motion — leave everything visible & static.
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var Motion = window.Motion;
  var animate = Motion.animate;
  var inView = Motion.inView;
  var spring = Motion.spring;

  var enter = spring ? spring({ stiffness: 110, damping: 16 }) : [0.22, 1, 0.36, 1];

  // Reveal each node once as it scrolls into view, with an optional stagger.
  function reveal(nodes, stagger) {
    stagger = stagger || 0;
    nodes.forEach(function (el, i) {
      el.style.opacity = '0';
      var stop = inView(el, function () {
        animate(
          el,
          { opacity: [0, 1], y: [24, 0] },
          { delay: stagger * i, easing: enter }
        );
        if (stop) stop(); // reveal once
      }, { amount: 0.15 });
    });
  }

  function q(sel) {
    return Array.prototype.slice.call(document.querySelectorAll(sel));
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Section intro blocks (eyebrow + heading)
    reveal(q('#projects > .mb-10, #activity > .mb-10, #creative > .mb-10'));

    // The projects card stack as one unit (its inner cards manage their own transforms)
    reveal(q('#projects .projects-stack-outer'));

    // LinkedIn activity cards — staggered
    reveal(q('#activity .linkedin-card'), 0.1);

    // Creative carousels — staggered
    reveal(q('#creative .grid > div, #creative #event-carousel'), 0.09);

    // Contact block — staggered
    reveal(q('#contact > *'), 0.06);
  });
})();
