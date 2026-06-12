
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

// ── 3D Project Stack ──────────────────────────────────────────────
const PROJECT_COUNT = 6;
let projectIdx = 0;
let projectTransitioning = false;

function updateProjectStack() {
  const cards = document.querySelectorAll('.project-3d-card');
  cards.forEach((card, i) => {
    const pos = (i - projectIdx + PROJECT_COUNT) % PROJECT_COUNT;
    card.dataset.stackPos = pos;
    const video = card.querySelector('video');
    if (video) {
      if (pos === 0) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  });
  document.querySelectorAll('.project-dot-3d').forEach((dot, i) => {
    dot.classList.toggle('active', i === projectIdx);
  });
}

function goToProject(idx) {
  if (projectTransitioning || idx === projectIdx) return;
  const fwd = (idx - projectIdx + PROJECT_COUNT) % PROJECT_COUNT;
  _doProjectTransition(fwd <= PROJECT_COUNT / 2 ? 1 : -1, idx);
}

function changeProject(direction) {
  if (projectTransitioning) return;
  const newIdx = (projectIdx + direction + PROJECT_COUNT) % PROJECT_COUNT;
  _doProjectTransition(direction, newIdx);
}

function _doProjectTransition(direction, newIdx) {
  projectTransitioning = true;
  const cards = document.querySelectorAll('.project-3d-card');
  const exitCard = cards[projectIdx];
  exitCard.style.transform = '';
  exitCard.style.transition = '';
  exitCard.classList.add(direction > 0 ? 'card-exit-right' : 'card-exit-left');
  setTimeout(() => {
    exitCard.classList.remove('card-exit-right', 'card-exit-left');
    projectIdx = newIdx;
    updateProjectStack();
    projectTransitioning = false;
  }, 440);
}

function _initProjectTilt() {
  const grid = document.getElementById('projects-stack-grid');
  if (!grid) return;
  grid.addEventListener('mousemove', (e) => {
    const active = grid.querySelector('.project-3d-card[data-stack-pos="0"]');
    if (!active || active.classList.contains('card-exit-right') || active.classList.contains('card-exit-left')) return;
    const rect = active.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    active.style.transition = 'transform 0.12s ease';
    active.style.transform = `perspective(1400px) rotateY(${x * 10}deg) rotateX(${-y * 7}deg) translateZ(14px) scale(1.01)`;
  });
  grid.addEventListener('mouseleave', () => {
    const active = grid.querySelector('.project-3d-card[data-stack-pos="0"]');
    if (!active) return;
    active.style.transition = 'transform 0.55s cubic-bezier(0.23, 1, 0.32, 1)';
    active.style.transform = '';
  });
}

function _initProjectSwipe() {
  const section = document.getElementById('projects');
  if (!section) return;
  let startX = 0;
  let startY = 0;
  section.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  section.addEventListener('touchend', (e) => {
    const dx = startX - e.changedTouches[0].clientX;
    const dy = startY - e.changedTouches[0].clientY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      changeProject(dx > 0 ? 1 : -1);
    }
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('projects-stack-grid')) return;
  updateProjectStack();
  _initProjectTilt();
  _initProjectSwipe();
});

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


