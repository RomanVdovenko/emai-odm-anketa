/* ============================================================
   EMAI ODM Анкета v3.6 — JavaScript
   Логика: автосохранение, export/import JSON, прогресс,
           глоссарий, слайдеры, accept/change toggle
   ============================================================ */

'use strict';

const STORAGE_KEY = 'emai_odm_v36';
const VERSION     = '3.6.0';

/* =========================================================
   УТИЛИТЫ
   ========================================================= */

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function showToast(msg, icon = '✓') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.querySelector('.toast-icon').textContent = icon;
  t.querySelector('.toast-msg').textContent  = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function timestamp() {
  return new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
}

/* =========================================================
   СОХРАНЕНИЕ / ЗАГРУЗКА
   ========================================================= */

function collectFormData() {
  const data = { _version: VERSION, _saved: new Date().toISOString(), fields: {} };

  document.querySelectorAll('[data-field]').forEach(el => {
    const key = el.dataset.field;
    if (el.type === 'checkbox')      data.fields[key] = el.checked;
    else if (el.type === 'radio')    { if (el.checked) data.fields[key] = el.value; }
    else                             data.fields[key] = el.value;
  });
  return data;
}

function restoreFormData(data) {
  if (!data || !data.fields) return;
  const fields = data.fields;

  document.querySelectorAll('[data-field]').forEach(el => {
    const key = el.dataset.field;
    if (!(key in fields)) return;

    if (el.type === 'checkbox') {
      el.checked = Boolean(fields[key]);
    } else if (el.type === 'radio') {
      el.checked = (el.value === fields[key]);
      if (el.checked) el.dispatchEvent(new Event('change'));
    } else {
      el.value = fields[key];
      el.dispatchEvent(new Event('input'));
    }
  });

  updateProgress();
}

const autoSave = debounce(() => {
  const data = collectFormData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}, 600);

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    restoreFormData(data);
    showToast('Данные восстановлены из сессии', '📂');
  } catch (e) { console.warn('Ошибка загрузки:', e); }
}

/* =========================================================
   ЭКСПОРТ / ИМПОРТ JSON
   ========================================================= */

function exportJSON() {
  const data = collectFormData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `EMAI_ODM_Spec_${timestamp()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('JSON сохранён', '💾');
}

function importJSON() {
  const input = document.createElement('input');
  input.type  = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        restoreFormData(data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        showToast(`Загружено: ${file.name}`, '📥');
      } catch (err) {
        showToast('Ошибка формата файла', '❌');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function resetForm() {
  if (!confirm('Сбросить все данные анкеты? Это действие нельзя отменить.')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

/* =========================================================
   ПРОГРЕСС-БАР
   ========================================================= */

function updateProgress() {
  const required = document.querySelectorAll('[data-required]');
  if (!required.length) return;

  let filled = 0;
  required.forEach(el => {
    if (el.type === 'checkbox') { /* checkboxes не обязательны */ return; }
    if (el.type === 'radio') {
      const name = el.name;
      if (document.querySelector(`input[name="${name}"]:checked`)) filled++;
      return;
    }
    if (el.value && el.value.trim()) filled++;
  });

  // Считаем уникальные radio-группы
  const radioGroups = new Set();
  required.forEach(el => { if (el.type === 'radio') radioGroups.add(el.name); });

  const total = (required.length - document.querySelectorAll('[data-required][type="radio"]').length)
              + radioGroups.size;

  const pct = total ? Math.round((filled / total) * 100) : 0;

  const bar   = document.querySelector('.progress-bar-fill');
  const label = document.querySelector('.progress-pct');
  if (bar)   bar.style.width = pct + '%';
  if (label) label.textContent = pct + '% заполнено';
}

/* =========================================================
   СЛАЙДЕРЫ — обновление отображения значения
   ========================================================= */

function initSteppers() {
  document.querySelectorAll('.stepper').forEach(stepper => {
    const input  = stepper.querySelector('.stepper-input');
    const decBtn = stepper.querySelector('.stepper-dec');
    const incBtn = stepper.querySelector('.stepper-inc');
    if (!input) return;

    const step = parseFloat(input.step) || 1;
    const min  = input.min !== '' ? parseFloat(input.min) : -Infinity;
    const max  = input.max !== '' ? parseFloat(input.max) : Infinity;
    const dec  = (step.toString().split('.')[1] || '').length;

    const round  = v => parseFloat(v.toFixed(dec));
    const clamp  = v => Math.min(max, Math.max(min, v));
    const adjust = delta => {
      const newVal = round(clamp((parseFloat(input.value) || min) + delta));
      input.value = newVal;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    decBtn?.addEventListener('click', () => adjust(-step));
    incBtn?.addEventListener('click', () => adjust(+step));
    input.addEventListener('change', () => {
      input.value = round(clamp(parseFloat(input.value) || min));
    });
  });
}

/* =========================================================
   ACCEPT / CHANGE TOGGLE
   ========================================================= */

function initAcceptToggles() {
  document.querySelectorAll('.accept-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.accept-toggle');
      card.querySelectorAll('.accept-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const changeInput = card.nextElementSibling;
      if (changeInput && changeInput.classList.contains('change-input-wrap')) {
        changeInput.classList.toggle('visible', btn.classList.contains('change'));
      }
      autoSave();
    });
  });
}

/* =========================================================
   КОММЕНТАРИИ (TOGGLE)
   ========================================================= */

function initCommentToggles() {
  document.querySelectorAll('.comment-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const area = toggle.nextElementSibling;
      if (!area) return;
      const open = area.classList.toggle('visible');
      toggle.textContent = open ? '▲ Скрыть комментарий' : '▼ Добавить комментарий';
    });
  });
}

/* =========================================================
   RADIO ITEMS — визуальная подсветка
   ========================================================= */

function initRadioItems() {
  document.querySelectorAll('.radio-item input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const group = radio.closest('.radio-group');
      if (!group) return;
      group.querySelectorAll('.radio-item').forEach(item => item.classList.remove('selected'));
      radio.closest('.radio-item').classList.add('selected');
    });
  });
}

/* =========================================================
   НАВИГАЦИЯ — активный элемент при скролле
   ========================================================= */

function initNavHighlight() {
  const sections = document.querySelectorAll('.section-card[id]');
  const navItems = document.querySelectorAll('.nav-item[href]');

  if (!sections.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navItems.forEach(item => {
          item.classList.toggle('active', item.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { rootMargin: '-60px 0px -60% 0px' });

  sections.forEach(s => observer.observe(s));
}

/* =========================================================
   ГЛОССАРИЙ — открытие/закрытие, поиск, прокрутка к термину
   ========================================================= */

function initGlossary() {
  const overlay = document.getElementById('glossary-overlay');
  const drawer  = document.getElementById('glossary-drawer');
  const closeBtn = document.getElementById('glossary-close');
  const searchInput = document.getElementById('glossary-search');
  const openBtn  = document.getElementById('btn-glossary');

  if (!overlay || !drawer) return;

  function openGlossary(term) {
    overlay.classList.add('open');
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';

    if (term) {
      setTimeout(() => {
        const item = document.getElementById('gterm-' + term.toUpperCase());
        if (item) {
          item.scrollIntoView({ behavior: 'smooth', block: 'center' });
          item.classList.add('highlighted');
          setTimeout(() => item.classList.remove('highlighted'), 2000);
        }
      }, 200);
    }
  }

  function closeGlossary() {
    overlay.classList.remove('open');
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (openBtn)  openBtn.addEventListener('click', () => openGlossary());
  if (closeBtn) closeBtn.addEventListener('click', closeGlossary);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeGlossary(); });

  // Клик по кликабельным терминам в тексте
  document.querySelectorAll('a.term-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      openGlossary(link.dataset.term);
    });
  });

  // Поиск
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      document.querySelectorAll('.glossary-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }

  // Экспортируем функцию глобально (используется из onclick в HTML)
  window.openGlossary = openGlossary;
}

/* =========================================================
   МОБИЛЬНАЯ НАВИГАЦИЯ
   ========================================================= */

function initMobileNav() {
  const burger = document.getElementById('burger');
  const sidebar = document.querySelector('.sidebar');
  if (!burger || !sidebar) return;

  burger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth < 768) sidebar.classList.remove('open');
    });
  });
}

/* =========================================================
   ПЕЧАТЬ
   ========================================================= */

function printPage() {
  window.print();
}

/* =========================================================
   ИНИЦИАЛИЗАЦИЯ
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  // Привязать кнопки
  document.getElementById('btn-export')?.addEventListener('click', exportJSON);
  document.getElementById('btn-import')?.addEventListener('click', importJSON);
  document.getElementById('btn-reset')?.addEventListener('click', resetForm);
  document.getElementById('btn-print')?.addEventListener('click', printPage);

  // Инициализация компонентов
  initSteppers();
  initAcceptToggles();
  initCommentToggles();
  initRadioItems();
  initNavHighlight();
  initGlossary();
  initMobileNav();

  // Автосохранение на любое изменение формы
  document.addEventListener('input',  autoSave);
  document.addEventListener('change', autoSave);

  // Обновление прогресса
  document.addEventListener('input',  updateProgress);
  document.addEventListener('change', updateProgress);

  // Загрузить сохранённые данные
  loadSaved();

  // Начальный расчёт прогресса
  updateProgress();

  console.log('EMAI ODM Анкета v3.6 инициализирована');
});
