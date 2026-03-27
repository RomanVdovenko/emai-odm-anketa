/* ============================================================
   EMAI ODM Анкета v3.6 — JavaScript
   Логика: автосохранение, export/import JSON, прогресс,
           глоссарий, стeppers, accept/change toggle,
           участники (динамические), admin-панель
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
  const data = {
    _version: VERSION,
    _saved: new Date().toISOString(),
    participants: [],
    sectionLabels: {},
    fields: {}
  };

  // Поля формы
  document.querySelectorAll('[data-field]').forEach(el => {
    const key = el.dataset.field;
    if (el.type === 'checkbox')   data.fields[key] = el.checked;
    else if (el.type === 'radio') { if (el.checked) data.fields[key] = el.value; }
    else                          data.fields[key] = el.value;
  });

  // Метки разделов (для читаемости JSON)
  document.querySelectorAll('.section-card[id]').forEach(card => {
    const titleEl = card.querySelector('.section-title');
    data.sectionLabels[card.id] = titleEl ? titleEl.textContent.trim() : '';
  });

  // Участники
  document.querySelectorAll('#participants-list .participant-row').forEach(row => {
    const name = row.querySelector('.participant-name')?.value || '';
    const role = row.querySelector('.participant-role')?.value || '';
    data.participants.push({ name, role });
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

  // Восстановить участников
  if (data.participants && data.participants.length) {
    const list = document.getElementById('participants-list');
    if (list) {
      list.innerHTML = '';
      data.participants.forEach(p => {
        list.appendChild(_createParticipantRow(p.name || '', p.role || ''));
      });
    }
  }

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
  showToast('JSON скачан', '💾');
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
    if (el.type === 'checkbox') { return; }
    if (el.type === 'radio') {
      const name = el.name;
      if (document.querySelector(`input[name="${name}"]:checked`)) filled++;
      return;
    }
    if (el.value && el.value.trim()) filled++;
  });

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
   СТЕППЕРЫ
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
   ГЛОССАРИЙ
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

  document.querySelectorAll('a.term-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      openGlossary(link.dataset.term);
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      document.querySelectorAll('.glossary-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }

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
   УЧАСТНИКИ — динамический список
   ========================================================= */

function _createParticipantRow(name, role) {
  const row = document.createElement('div');
  row.className = 'participant-row';
  row.innerHTML = `
    <input type="text" class="participant-name signature-line" placeholder="Имя Фамилия">
    <input type="text" class="participant-role signature-line" placeholder="Роль в проекте">
    <button class="participant-remove" type="button" title="Убрать участника">−</button>
  `;
  const nameInput = row.querySelector('.participant-name');
  const roleInput = row.querySelector('.participant-role');
  nameInput.value = name || '';
  roleInput.value = role || '';

  nameInput.addEventListener('input', autoSave);
  roleInput.addEventListener('input', autoSave);

  row.querySelector('.participant-remove').addEventListener('click', () => {
    row.remove();
    autoSave();
  });
  return row;
}

function initParticipants() {
  const list   = document.getElementById('participants-list');
  const addBtn = document.getElementById('btn-add-participant');
  if (!list || !addBtn) return;

  // Начальная строка
  list.appendChild(_createParticipantRow('', ''));

  addBtn.addEventListener('click', () => {
    const row = _createParticipantRow('', '');
    list.appendChild(row);
    row.querySelector('.participant-name').focus();
    autoSave();
  });
}

/* =========================================================
   ADMIN-ПАНЕЛЬ
   ========================================================= */

function initAdminPanel() {
  const toggleBtn = document.getElementById('btn-admin');
  if (!toggleBtn) return;

  let customCount = 0;

  // Открыть модалку редактирования раздела
  function openEditModal(card) {
    const titleEl    = card.querySelector('.section-title');
    const subtitleEl = card.querySelector('.section-subtitle');

    document.getElementById('admin-edit-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'admin-edit-overlay';
    overlay.className = 'admin-edit-overlay';
    overlay.innerHTML = `
      <div class="admin-edit-inner">
        <div class="admin-edit-title">Редактирование раздела</div>
        <label class="form-label">Заголовок</label>
        <input type="text" id="aei-heading" value="${(titleEl?.textContent || '').trim().replace(/"/g, '&quot;')}">
        <label class="form-label" style="margin-top:10px">Подзаголовок</label>
        <input type="text" id="aei-sub" value="${(subtitleEl?.textContent || '').trim().replace(/"/g, '&quot;')}">
        <div class="admin-edit-actions">
          <button id="aei-save"   class="btn btn-primary btn-sm">Сохранить</button>
          <button id="aei-cancel" class="btn btn-ghost btn-sm">Отмена</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const headingInput = overlay.querySelector('#aei-heading');
    headingInput.focus();
    headingInput.select();

    overlay.querySelector('#aei-save').addEventListener('click', () => {
      const newHeading = overlay.querySelector('#aei-heading').value.trim();
      const newSub     = overlay.querySelector('#aei-sub').value.trim();
      if (titleEl && newHeading) {
        // Сохраняем ссылки на глоссарий — заменяем только текстовые узлы
        titleEl.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) node.textContent = '';
        });
        // Если нет дочерних элементов — просто ставим текст
        if (!titleEl.querySelector('a')) {
          titleEl.textContent = newHeading;
        } else {
          // Вставляем текст перед первой ссылкой
          titleEl.insertBefore(document.createTextNode(newHeading + ' '), titleEl.firstChild);
        }
      }
      if (subtitleEl) subtitleEl.textContent = newSub;
      overlay.remove();
      autoSave();
    });
    overlay.querySelector('#aei-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  // Добавить комментарий-тоггл для новых разделов
  function bindCommentToggle(card) {
    card.querySelectorAll('.comment-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const area = toggle.nextElementSibling;
        if (!area) return;
        const open = area.classList.toggle('visible');
        toggle.textContent = open ? '▲ Скрыть комментарий' : '▼ Добавить комментарий';
      });
    });
  }

  // Создать и добавить admin-bar к карточке
  function attachAdminBar(card, isCustom) {
    const bar = document.createElement('div');
    bar.className = 'admin-bar';
    bar.innerHTML = `
      <button class="admin-btn admin-btn-edit"  title="Редактировать заголовок">✎</button>
      <button class="admin-btn admin-btn-hide"  title="Скрыть/показать раздел">👁</button>
      <button class="admin-btn admin-btn-after" title="Добавить раздел после">＋</button>
      ${isCustom ? '<button class="admin-btn admin-btn-delete" title="Удалить раздел">✕</button>' : ''}
    `;
    card.appendChild(bar);

    bar.querySelector('.admin-btn-edit').addEventListener('click', () => openEditModal(card));

    bar.querySelector('.admin-btn-hide').addEventListener('click', () => {
      card.classList.toggle('section-hidden');
      const isHidden = card.classList.contains('section-hidden');
      bar.querySelector('.admin-btn-hide').style.cssText = isHidden
        ? 'background:#fce8e6;color:var(--red);border-color:var(--red)'
        : '';
      autoSave();
    });

    bar.querySelector('.admin-btn-after').addEventListener('click', () => addCustomSection(card));

    if (isCustom) {
      bar.querySelector('.admin-btn-delete').addEventListener('click', () => {
        if (confirm('Удалить этот раздел?')) { card.remove(); autoSave(); }
      });
    }
  }

  // Добавить новый кастомный раздел после указанного
  function addCustomSection(afterCard) {
    customCount++;
    const id = 'custom_' + customCount;

    const card = document.createElement('div');
    card.className = 'section-card custom-section';
    card.id = id;
    card.style.position = 'relative';
    card.innerHTML = `
      <div class="section-header">
        <div class="section-num" style="background:#e8f5e9;color:#2e7d32">＋</div>
        <div class="section-title-block">
          <div class="section-title">Новый вопрос</div>
          <div class="section-subtitle">Нажмите ✎ чтобы изменить заголовок</div>
        </div>
      </div>
      <div class="section-body">
        <textarea data-field="${id}_value" rows="3" placeholder="Введите ответ..."></textarea>
        <span class="comment-toggle">▼ Добавить комментарий</span>
        <div class="comment-area"><textarea data-field="${id}_comment" placeholder="Комментарий..."></textarea></div>
      </div>
    `;

    attachAdminBar(card, true);
    bindCommentToggle(card);
    afterCard.after(card);

    // Автосохранение для новых полей
    card.querySelectorAll('textarea').forEach(ta => ta.addEventListener('input', autoSave));

    card.querySelector('.section-title').click(); // не фокус, просто показываем
    showToast('Новый раздел добавлен', '＋');
    autoSave();
  }

  // Инжектируем admin-bar ко всем существующим разделам
  document.querySelectorAll('.section-card[id]').forEach(card => {
    card.style.position = 'relative';
    attachAdminBar(card, false);
  });

  // Переключение режима
  toggleBtn.addEventListener('click', () => {
    const on = document.body.classList.toggle('admin-mode');
    toggleBtn.classList.toggle('active', on);
    toggleBtn.textContent = on ? '🔒 Admin ON' : '⚙ Admin';
    showToast(on ? 'Режим редактирования включён' : 'Режим редактирования выключен', on ? '⚙' : '✓');
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
  initParticipants();
  initAdminPanel();

  // Автосохранение
  document.addEventListener('input',  autoSave);
  document.addEventListener('change', autoSave);

  // Прогресс
  document.addEventListener('input',  updateProgress);
  document.addEventListener('change', updateProgress);

  // Загрузить сохранённые данные
  loadSaved();
  updateProgress();

  console.log('EMAI ODM Анкета v3.6 инициализирована');
});
