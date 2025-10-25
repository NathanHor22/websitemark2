
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
  const words = ['My Projects'];
  const wait = 6000;
  
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
  
  // Hide all slides in this carousel
  slides.forEach(slide => {
    slide.classList.remove('active');
    slide.style.opacity = '0';
  });
  
  // Show current slide in this carousel
  slides[index].classList.add('active');
  slides[index].style.opacity = '1';
  
  // Update the current slide data attribute
  carousel.setAttribute('data-current-slide', index);
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

// Initialize both carousels when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Initialize sports carousel
  const sportsCarousel = document.getElementById('sports-carousel');
  if (sportsCarousel) {
    showSlide(0, 'sports-carousel');
  }
  
  // Initialize posters carousel
  const postersCarousel = document.getElementById('posters-carousel');
  if (postersCarousel) {
    showSlide(0, 'posters-carousel');
  }
});


