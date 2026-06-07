(function () {
  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function findAuthInputs() {
    const inputs = Array.from(document.querySelectorAll('.auth-form-container input')).filter((input) => {
      return input.type !== 'hidden' && !input.disabled;
    });
    const email = inputs.find((input) => {
      const name = (input.name || input.id || input.autocomplete || '').toLowerCase();
      return input.type === 'email' || name.includes('email') || name.includes('username') || name.includes('login') || name.includes('account');
    });
    const password = inputs.find((input) => input.type === 'password') || inputs.find((input) => {
      const name = (input.name || input.id || input.autocomplete || '').toLowerCase();
      return name.includes('password') || name.includes('plainpassword');
    });

    return { email, password, inputs };
  }

  ready(() => {
    const brand = document.querySelector('.auth-brand');
    const characters = Array.from(document.querySelectorAll('.auth-character'));
    if (!brand || characters.length === 0) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const { email, password, inputs } = findAuthInputs();
    let focusedInput = null;
    let pointer = { x: window.innerWidth * 0.34, y: window.innerHeight * 0.34 };
    let raf = 0;
    let peekTimer = 0;

    function setState(state) {
      brand.classList.remove('auth-state-email', 'auth-state-secret', 'auth-state-peek');
      if (state) brand.classList.add(state);
    }

    function isPasswordVisible() {
      return password && password.type !== 'password' && password.value.length > 0;
    }

    function updateState() {
      if (isPasswordVisible()) {
        setState('auth-state-peek');
        schedulePeek();
      } else if (focusedInput === password) {
        setState('auth-state-secret');
      } else if (focusedInput === email) {
        setState('auth-state-email');
      } else {
        setState('');
      }
    }

    function updateEyes() {
      raf = 0;
      characters.forEach((character) => {
        const depth = Number(character.dataset.depth || 1);
        const rect = character.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = clamp((pointer.x - centerX) / rect.width, -0.55, 0.55);
        const dy = clamp((pointer.y - centerY) / rect.height, -0.55, 0.55);

        character.style.setProperty('--watch-x', `${(dx * 7 * depth).toFixed(2)}px`);
        character.style.setProperty('--watch-y', `${(dy * 6 * depth).toFixed(2)}px`);
        character.querySelectorAll('.auth-pupil').forEach((pupil) => {
          pupil.style.setProperty('--pupil-x', `${(dx * 8).toFixed(2)}px`);
          pupil.style.setProperty('--pupil-y', `${(dy * 6).toFixed(2)}px`);
        });
      });
    }

    function scheduleEyes() {
      if (raf) return;
      raf = window.requestAnimationFrame(updateEyes);
    }

    function focusTarget(input) {
      if (!input) return;
      const rect = input.getBoundingClientRect();
      pointer = {
        x: rect.left + rect.width * 0.62,
        y: rect.top + rect.height * 0.5
      };
      scheduleEyes();
    }

    function schedulePeek() {
      if (peekTimer || !password) return;
      peekTimer = window.setTimeout(() => {
        peekTimer = 0;
        if (!isPasswordVisible()) {
          characters.forEach((character) => character.classList.remove('auth-is-peeking'));
          return;
        }

        const character = characters[Math.floor(Math.random() * characters.length)];
        character.classList.add('auth-is-peeking');
        window.setTimeout(() => character.classList.remove('auth-is-peeking'), 680);
        schedulePeek();
      }, 1200 + Math.random() * 1800);
    }

    if (!reducedMotion) {
      brand.addEventListener('pointermove', (event) => {
        pointer = { x: event.clientX, y: event.clientY };
        scheduleEyes();
      }, { passive: true });

      window.setInterval(() => {
        if (document.hidden) return;
        const character = characters[Math.floor(Math.random() * characters.length)];
        character.classList.add('is-blinking');
        window.setTimeout(() => character.classList.remove('is-blinking'), 140);
      }, 2200);
    }

    inputs.forEach((input) => {
      input.addEventListener('focus', () => {
        focusedInput = input;
        focusTarget(input);
        updateState();
      });

      input.addEventListener('blur', () => {
        if (focusedInput === input) focusedInput = null;
        window.setTimeout(updateState, 80);
      });

      input.addEventListener('input', () => {
        focusTarget(input);
        updateState();
      });
    });

    if (password) {
      const observer = new MutationObserver(updateState);
      observer.observe(password, { attributes: true, attributeFilter: ['type'] });
    }

    updateState();
    scheduleEyes();
  });
})();
