// Section travel belongs to the plate controller in app.js. This module only
// supplies the short report detent after a project record actually changes.
export function initInterfaceMotion(options = {}) {
  if (options.reducedMotion) return () => {};

  let reportAnimation = null;

  const stopReport = () => {
    reportAnimation?.cancel();
    reportAnimation = null;
  };

  const onProjectChange = () => {
    const report = document.querySelector('#projects.is-active .project-report');
    if (!report || typeof report.animate !== 'function' || document.body.classList.contains('is-switching-section')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stopReport();
    reportAnimation = report.animate([
      { transform: 'translateY(2px)', opacity: 0.85 },
      { transform: 'translateY(0)', opacity: 1 }
    ], {
      duration: 130,
      easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)'
    });
  };

  document.addEventListener('machine:projectchange', onProjectChange);
  document.addEventListener('machine:navigationstart', stopReport);

  return () => {
    stopReport();
    document.removeEventListener('machine:projectchange', onProjectChange);
    document.removeEventListener('machine:navigationstart', stopReport);
  };
}
