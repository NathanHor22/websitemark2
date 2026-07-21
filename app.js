
//Typewriter effect
class TypeWriter {
  constructor(txtElement, words, wait = 3000) {
    this.txtElement = txtElement;
    this.words = words;
    this.txt = '';
    this.wordIndex = 0;
    this.wait = parseInt(wait, 10);
    this.type();
    this.isDeleting = false;
  }

  type() {
    // Current index of word
    const current = this.wordIndex % this.words.length;
    // Get full text of current word
    const fullTxt = this.words[current];

    // Check if deleting
    if(this.isDeleting) {
      // Remove char
      this.txt = fullTxt.substring(0, this.txt.length - 1);
    } else {
      // Add char
      this.txt = fullTxt.substring(0, this.txt.length + 1);
    }

    // Insert txt into element with cursor as separate element
    this.txtElement.innerHTML = `${this.txt}<span class="typewriter-cursor">|</span>`;

    // Initial Type Speed
    let typeSpeed = 100;

    if(this.isDeleting) {
      typeSpeed /= 2;
    }

    // If word is complete
    if(!this.isDeleting && this.txt === fullTxt) {
      // Make pause at end
      typeSpeed = this.wait;
      // Set delete to true
      this.isDeleting = true;
    } else if(this.isDeleting && this.txt === '') {
      this.isDeleting = false;
      // Move to next word
      this.wordIndex++;
      // Pause before start typing
      typeSpeed = 900;
    }

    setTimeout(() => this.type(), typeSpeed);
  }
}

// Initialize typewriter effect when page loads
document.addEventListener('DOMContentLoaded', function() {
  const txtElement = document.getElementById('typewriter-text');
  const words = ['Creative Technologist.', 'AR Developer.', 'Agentic AI Builder.', 'Full-Stack Developer.', 'Photographer.'];
  const wait = 2500;
  
  if (txtElement) {
    // Add a delay before starting the typing effect
    setTimeout(() => {
      new TypeWriter(txtElement, words, wait);
    }, 500);
  }
});



// Generic carousel functionality
function showSlide(index, carouselId) {
  const carousel = document.getElementById(carouselId);
  const slides = carousel.querySelectorAll('.carousel-slide');

  slides.forEach(slide => {
    slide.classList.remove('active');
    slide.style.opacity = '0';
  });

  slides[index].classList.add('active');
  slides[index].style.opacity = '1';
  carousel.setAttribute('data-current-slide', index);

  // Update the "1 / 5" counter chip if present
  const counter = document.getElementById(carouselId + '-counter');
  if (counter) counter.textContent = `${index + 1} / ${slides.length}`;
}

function changeSlide(direction, carouselId) {
  const carousel = document.getElementById(carouselId);
  const slides = carousel.querySelectorAll('.carousel-slide');
  const totalSlides = slides.length;
  
  // Get current slide for this specific carousel
  let currentSlide = parseInt(carousel.getAttribute('data-current-slide'));
  
  // Calculate new slide index
  currentSlide += direction;
  
  // Loop around
  if (currentSlide >= totalSlides) {
    currentSlide = 0;
  } else if (currentSlide < 0) {
    currentSlide = totalSlides - 1;
  }
  
  // Show the new slide
  showSlide(currentSlide, carouselId);
}

// Initialize photo carousels when page loads
document.addEventListener('DOMContentLoaded', function() {
  const sportsCarousel = document.getElementById('sports-carousel');
  if (sportsCarousel) showSlide(0, 'sports-carousel');

  const postersCarousel = document.getElementById('posters-carousel');
  if (postersCarousel) showSlide(0, 'posters-carousel');
});

// ── LinkedIn post "see more / see less" toggle ────────────────────
function togglePost(containerId, btn) {
  const container = document.getElementById(containerId);
  const isExpanded = container.classList.contains('expanded');
  container.classList.toggle('expanded', !isExpanded);
  btn.textContent = isExpanded ? '...see more' : 'see less';
}

// ── Project carousel ──────────────────────────────────────────────
// One card visible at a time. Must match the `gap` on .projects-track in the CSS.
const PROJECT_SLIDE_GAP = 24;
let projectIdx = 0;
let projectSectionVisible = true;

function _projectCards() {
  return document.querySelectorAll('#projects-track > .project-post-card');
}

// Only the card on screen should be playing — the other five are decoded video
// we'd be downloading for nothing.
function _syncProjectVideos() {
  _projectCards().forEach((card, i) => {
    const video = card.querySelector('video');
    if (!video) return;
    if (i === projectIdx && projectSectionVisible) video.play().catch(() => {});
    else video.pause();
  });
}

// The track is sized to the active card so a collapsed card doesn't inherit
// the height of an expanded one sitting off-screen.
function _syncProjectHeight() {
  const track = document.getElementById('projects-track');
  const active = _projectCards()[projectIdx];
  if (track && active) track.style.height = active.offsetHeight + 'px';
}

function updateProjectCarousel() {
  const track = document.getElementById('projects-track');
  if (!track) return;
  track.style.transform =
    `translateX(calc(${-projectIdx * 100}% - ${projectIdx * PROJECT_SLIDE_GAP}px))`;
  document.querySelectorAll('.project-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === projectIdx);
  });
  _projectCards().forEach((card, i) => {
    // Keep off-screen cards out of the tab order and away from screen readers
    card.setAttribute('aria-hidden', String(i !== projectIdx));
    card.querySelectorAll('a, button').forEach((el) => {
      el.tabIndex = i === projectIdx ? 0 : -1;
    });
  });
  _syncProjectHeight();
  _syncProjectVideos();
}

function goToProject(idx) {
  const count = _projectCards().length;
  if (!count) return;
  projectIdx = (idx + count) % count;
  updateProjectCarousel();
}

function changeProject(direction) {
  goToProject(projectIdx + direction);
}

// "...see more" expands the active card's bullets/tags/links.
function toggleProject(btn) {
  const card = btn.closest('.project-post-card');
  const expanded = !card.classList.contains('expanded');
  card.classList.toggle('expanded', expanded);
  btn.textContent = expanded ? 'see less' : '...see more';
  btn.setAttribute('aria-expanded', String(expanded));
}

function _initProjectCarousel() {
  const track = document.getElementById('projects-track');
  if (!track) return;

  // A ResizeObserver rather than a one-shot measure: this fires on every frame
  // of the see-more expansion, on window resize, and once webfonts land and
  // reflow the titles — all of which change the active card's height.
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => _syncProjectHeight());
    _projectCards().forEach((card) => ro.observe(card));
  } else {
    window.addEventListener('resize', _syncProjectHeight);
  }

  // Pause the video entirely while the section is scrolled away
  const section = document.getElementById('projects');
  if (section && window.IntersectionObserver) {
    new IntersectionObserver((entries) => {
      projectSectionVisible = entries[0].isIntersecting;
      _syncProjectVideos();
    }, { threshold: 0.1 }).observe(section);
  }

  // Swipe
  let startX = 0;
  let startY = 0;
  track.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  track.addEventListener('touchend', (e) => {
    const dx = startX - e.changedTouches[0].clientX;
    const dy = startY - e.changedTouches[0].clientY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      changeProject(dx > 0 ? 1 : -1);
    }
  }, { passive: true });

  // Left/right arrow keys when focus is inside the carousel
  document.querySelector('.projects-carousel')?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { changeProject(-1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { changeProject(1); e.preventDefault(); }
  });

  updateProjectCarousel();
}

document.addEventListener('DOMContentLoaded', _initProjectCarousel);
// Videos and webfonts settle after DOMContentLoaded and can change card height
window.addEventListener('load', _syncProjectHeight);

// Animate on Scroll
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const animationType = entry.target.getAttribute('data-animate') || 'fadeIn';
      entry.target.classList.add(`animate-${animationType}`);
      entry.target.classList.remove('opacity-0');
    }
  });
}, observerOptions);

// Observe elements with data-animate attribute
document.addEventListener('DOMContentLoaded', () => {
  const animatableElements = document.querySelectorAll('[data-animate]');
  animatableElements.forEach((element, index) => {
    if (index === 0) {
      // First element (first section content) fades in immediately
      element.classList.add('animate-fadeIn');
    } else {
      // Other elements start hidden
      element.classList.add('opacity-0');
      observer.observe(element);
    }
  });
});


