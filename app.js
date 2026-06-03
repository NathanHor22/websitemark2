
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

// ── Project carousel ──────────────────────────────────────────────
const PROJECT_TOTAL = 7;
let projectCurrentSlide = 0;
let projectAutoPlayTimer = null;

function goToProjectSlide(index) {
  projectCurrentSlide = index;
  const wrapper = document.getElementById('projects-carousel-wrapper');
  const track   = document.getElementById('projects-track');
  if (track && wrapper) {
    track.style.transform = `translateX(-${index * wrapper.offsetWidth}px)`;
  }
  document.querySelectorAll('.project-dot').forEach((dot, i) => {
    dot.classList.toggle('active-dot', i === index);
  });
}

function changeProjectSlide(direction) {
  goToProjectSlide((projectCurrentSlide + direction + PROJECT_TOTAL) % PROJECT_TOTAL);
}

function startProjectAutoPlay() {
  if (projectAutoPlayTimer) return;
  projectAutoPlayTimer = setInterval(() => changeProjectSlide(1), 5000);
}

function stopProjectAutoPlay() {
  clearInterval(projectAutoPlayTimer);
  projectAutoPlayTimer = null;
}

document.addEventListener('DOMContentLoaded', function() {
  const wrapper = document.getElementById('projects-carousel-wrapper');
  if (!wrapper) return;
  goToProjectSlide(0);
  startProjectAutoPlay();
  // Re-snap on resize so the translate stays correct
  window.addEventListener('resize', () => goToProjectSlide(projectCurrentSlide));
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


