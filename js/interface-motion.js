import { animate } from 'motion/mini';

const servoEase = [0.18, 0.86, 0.22, 1];
const brakeEase = [0.72, 0, 0.26, 1];

function afterBoot(callback) {
  if (document.body.classList.contains('is-booted')) {
    callback();
    return;
  }

  const observer = new MutationObserver(() => {
    if (!document.body.classList.contains('is-booted')) return;
    observer.disconnect();
    callback();
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

export function initInterfaceMotion(options = {}) {
  const reducedMotion = Boolean(options.reducedMotion);
  if (reducedMotion) return () => {};

  const cleanup = [];
  const revealed = new WeakSet();
  const sections = [...document.querySelectorAll('.rack-section')];

  afterBoot(() => {
    const status = document.querySelector('.machine-status');
    const bank = document.querySelector('.control-bank');
    const heroItems = document.querySelectorAll('.hero-copy > *, .identity-terminal');

    if (status) {
      animate(status, {
        opacity: [0, 1],
        transform: ['translateY(-16px)', 'translateY(0px)']
      }, {
        duration: 0.38,
        ease: servoEase
      });
    }

    if (bank) {
      const mobileBank = window.matchMedia('(max-width: 900px)').matches;
      animate(bank, {
        opacity: [0, 1],
        transform: mobileBank
          ? ['translateY(18px)', 'translateY(0px)']
          : ['translate(22px, -50%)', 'translate(0px, -50%)']
      }, {
        duration: 0.44,
        delay: 0.06,
        ease: servoEase
      });
    }

    if (heroItems.length && document.querySelector('#hero')?.classList.contains('is-active')) {
      heroItems.forEach((item, index) => {
        animate(item, {
          opacity: [0, 1],
          transform: ['translateY(18px)', 'translateY(0px)']
        }, {
          duration: 0.48,
          delay: 0.08 + index * 0.045,
          ease: servoEase
        });
      });
      heroItems.forEach(item => revealed.add(item));
    }
  });

  const revealSection = section => {
    const targets = [
      ...section.querySelectorAll('.hero-copy > *, .identity-terminal, .section-heading > *, .project-browser, .field-archive, .photo-console, .photo-console__archive-link, .contact-console > *, .site-footer')
    ].filter(target => !revealed.has(target));
    if (!targets.length) return;

    targets.forEach(target => revealed.add(target));
    targets.forEach((target, index) => {
      animate(target, {
        opacity: [0, 1],
        transform: ['translateY(16px)', 'translateY(0px)']
      }, {
        duration: 0.42,
        delay: index * 0.035,
        ease: servoEase
      });
    });
  };

  afterBoot(() => {
    const activeSection = sections.find(section => section.classList.contains('is-active'));
    if (activeSection && activeSection.id !== 'hero') revealSection(activeSection);
  });

  const onSectionChange = event => {
    const section = document.getElementById(event.detail?.id);
    if (!section) return;
    revealSection(section);
    const seam = section.querySelector('.rack-section__seam');
    if (seam) {
      animate(seam, {
        transform: ['translateY(-2px)', 'translateY(0px)']
      }, {
        duration: 0.22,
        ease: brakeEase
      });
    }
  };

  document.addEventListener('machine:sectionchange', onSectionChange);
  cleanup.push(() => document.removeEventListener('machine:sectionchange', onSectionChange));

  document.querySelectorAll('.control-key, .machine-button, .service-key').forEach(control => {
    const onPress = () => {
      animate(control, {
        scale: [1, 0.965, 1]
      }, {
        duration: 0.16,
        times: [0, 0.52, 1],
        ease: brakeEase
      });
    };
    control.addEventListener('click', onPress);
    cleanup.push(() => control.removeEventListener('click', onPress));
  });

  const onProjectChange = event => {
    const button = event.target.closest('[data-project]');
    if (!button) return;
    const report = document.querySelector('.project-report');
    if (!report) return;
    window.setTimeout(() => {
      animate(report, {
        opacity: [0.72, 1],
        transform: ['translateY(6px)', 'translateY(0px)']
      }, {
        duration: 0.25,
        ease: servoEase
      });
    }, 225);
  };

  document.addEventListener('click', onProjectChange);
  cleanup.push(() => document.removeEventListener('click', onProjectChange));

  return () => cleanup.forEach(dispose => dispose());
}
