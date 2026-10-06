const photoTicker = document.getElementById('photoTicker');
const tickerToggle = document.getElementById('tickerToggle');
const nav = document.querySelector('.nav');
const navToggle = document.querySelector('.nav-toggle');
const dialog = document.getElementById('profileDialog');
const gallery = document.getElementById('galleryPhotos');
const galleryHint = document.getElementById('galleryHint');
const profileForm = document.getElementById('profileForm');
const formMessage = document.getElementById('formMessage');
const toast = document.getElementById('toast');
const notifyButton = document.getElementById('notifyButton');

function buildTicker() {
  if (!photoTicker) return;
  const ids = Array.from({length: 50}, (_, i) => (i + 1) % 99);
  const photos = ids.map((n, idx) =>
    '<img loading="lazy" src="https://randomuser.me/api/portraits/women/' + n + '.jpg" alt="Ілюстративне фото учасниці ' + (idx + 1) + '">'
  ).join('');
  photoTicker.innerHTML = photos + photos;
}
buildTicker();

tickerToggle?.addEventListener('click', () => {
  const paused = photoTicker.classList.toggle('paused');
  tickerToggle.textContent = paused ? 'Продовжити' : 'Пауза';
});

navToggle?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
});

nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  nav.classList.remove('open');
  navToggle?.setAttribute('aria-expanded', 'false');
}));

document.querySelectorAll('[data-open-profile]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (typeof dialog.showModal === 'function') dialog.showModal();
  });
});
document.querySelectorAll('[data-close-profile]').forEach(btn => {
  btn.addEventListener('click', () => dialog.close());
});

gallery?.addEventListener('change', () => {
  if (gallery.files.length > 10) {
    gallery.value = '';
    galleryHint.textContent = 'Можна обрати не більше 10 фото.';
    return;
  }
  galleryHint.textContent = gallery.files.length + ' / 10 фото';
});

profileForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const mainPhoto = document.getElementById('mainPhoto');
  if (!mainPhoto?.files?.length) {
    formMessage.textContent = 'Додайте основне фото — воно обов’язкове.';
    return;
  }
  if (gallery?.files?.length > 10) {
    formMessage.textContent = 'У галереї можна додати максимум 10 фото.';
    return;
  }
  formMessage.textContent = 'Профіль готовий до відправлення. Наступний крок — підключення бази даних.';
  setTimeout(() => {
    dialog.close();
    showToast('Дані профілю перевірені. Backend підключимо на наступному етапі.');
  }, 900);
});

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
}

notifyButton?.addEventListener('click', async () => {
  if (!('Notification' in window)) {
    showToast('Цей браузер не підтримує сповіщення.');
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    new Notification('СВОЯ', {
      body: 'Сповіщення увімкнено. Тут з’являтимуться нові зустрічі та події.',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="%2365182d"/><text x="32" y="40" text-anchor="middle" font-size="26" fill="white">С</text></svg>'
    });
    showToast('Сповіщення увімкнено.');
  } else {
    showToast('Дозвіл на сповіщення не надано.');
  }
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, {threshold: .12});

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
