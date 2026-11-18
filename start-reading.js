(() => {
  'use strict';
  const key = 'jesusStartReadingV1';
  const items = Array.from(document.querySelectorAll('[data-reading-stop]'));
  const status = document.getElementById('pathProgressStatus');
  const resume = document.getElementById('pathResume');
  let completed;

  try {
    const stored = JSON.parse(localStorage.getItem(key));
    completed = new Set(Array.isArray(stored) ? stored : []);
  } catch (_) {
    completed = new Set();
  }

  function render() {
    const remaining = items.filter(item => !completed.has(item.id));
    status.textContent = (items.length - remaining.length) + ' of ' + items.length + ' readings complete';
    const next = remaining[0];
    resume.href = next ? '#' + next.id : '#continue-reading';
    resume.textContent = next ? 'Go to next unread passage' : 'Choose what to read next';
  }

  for (const item of items) {
    const label = item.querySelector('[data-reading-check]');
    const input = label.querySelector('input');
    input.checked = completed.has(item.id);
    input.addEventListener('change', () => {
      if (input.checked) completed.add(item.id);
      else completed.delete(item.id);
      try {
        localStorage.setItem(key, JSON.stringify([...completed]));
      } catch (_) {}
      render();
    });
    label.hidden = false;
  }
  render();
  document.getElementById('pathProgress').hidden = false;
})();
