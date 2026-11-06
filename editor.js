(function () {
  const MAX_CHARS = 300000;

  const SAMPLE = [
    '# Photosynthesis',
    '',
    '## Introduction',
    'Photosynthesis is the process by which green plants make their own food using sunlight, water and carbon dioxide.',
    '',
    'Requirements:',
    '1. Sunlight',
    '2. Water',
    '3. Carbon dioxide',
    '',
    '## Key Points',
    '- It takes place in the chloroplasts',
    '- Chlorophyll absorbs the sunlight',
    '- Oxygen is released as a by-product',
    '',
    '## हिंदी सारांश',
    'प्रकाश संश्लेषण वह क्रिया है जिसमें पौधे अपना भोजन बनाते हैं।'
  ].join('\n');

  const input = document.getElementById('textInput');
  const wordEl = document.getElementById('wordCount');
  const charEl = document.getElementById('charCount');
  const saveEl = document.getElementById('saveState');
  const structEl = document.getElementById('structure');
  const fileInput = document.getElementById('fileInput');

  /* ---------- Text parser (wording unchanged) ---------- */
  function isAutoHeading(t) {
    return t.length <= 60 &&
      t === t.toUpperCase() &&
      t !== t.toLowerCase() &&
      !/[.!?]$/.test(t);
  }

  function parseText(raw) {
    const lines = String(raw).replace(/\r\n?/g, '\n').split('\n');
    const blocks = [];
    for (const line of lines) {
      const t = line.trim();
      let m;
      if (!t) {
        blocks.push({ type: 'space', text: '' });
      } else if ((m = t.match(/^(#{1,6})\s+(.+)$/))) {
        blocks.push({ type: m[1].length === 1 ? 'heading' : 'subheading', text: m[2].trim() });
      } else if ((m = t.match(/^(\d+)[.)]\s+(.+)$/))) {
        blocks.push({ type: 'number', num: m[1], text: m[2].trim() });
      } else if ((m = t.match(/^[-*•]\s+(.+)$/))) {
        blocks.push({ type: 'bullet', text: m[1].trim() });
      } else if (isAutoHeading(t)) {
        blocks.push({ type: 'heading', text: t });
      } else if (t.length <= 60 && /:$/.test(t)) {
        blocks.push({ type: 'subheading', text: t });
      } else {
        blocks.push({ type: 'paragraph', text: t });
      }
    }
    // Remove extra blank lines (keep max one) and blanks at start/end
    const clean = [];
    for (const b of blocks) {
      const last = clean[clean.length - 1];
      if (b.type === 'space' && (!last || last.type === 'space')) continue;
      clean.push(b);
    }
    while (clean.length && clean[clean.length - 1].type === 'space') clean.pop();
    return clean;
  }

  /* ---------- Counts ---------- */
  function updateCounts() {
    const text = input.value;
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = Array.from(text).length;
    wordEl.textContent = words + (words === 1 ? ' word' : ' words');
    charEl.textContent = chars + (chars === 1 ? ' character' : ' characters');
  }

  /* ---------- Structure preview ---------- */
  const BADGES = { heading: 'H1', subheading: 'H2', bullet: '•', paragraph: '¶' };

  function renderStructure() {
    const blocks = parseText(input.value);
    structEl.textContent = '';
    if (!blocks.length) {
      const p = document.createElement('p');
      p.className = 'sempty';
      p.textContent = 'Text likhoge to yahan structure dikhega.';
      structEl.appendChild(p);
      return;
    }
    const LIMIT = 300;
    blocks.slice(0, LIMIT).forEach(b => {
      const row = document.createElement('div');
      row.className = 'sline ' + b.type;
      if (b.type !== 'space') {
        const badge = document.createElement('span');
        badge.className = 'sbadge';
        badge.textContent = b.type === 'number' ? b.num + '.' : BADGES[b.type];
        const txt = document.createElement('span');
        txt.className = 'stext';
        txt.textContent = b.text;
        row.appendChild(badge);
        row.appendChild(txt);
      }
      structEl.appendChild(row);
    });
    if (blocks.length > LIMIT) {
      const more = document.createElement('div');
      more.className = 'smore';
      more.textContent = '... aur ' + (blocks.length - LIMIT) + ' lines (preview mein sirf pehli ' + LIMIT + ' dikhti hain)';
      structEl.appendChild(more);
    }
  }

  /* ---------- Auto-save ---------- */
  let timer = null;
  function onChange() {
    updateCounts();
    saveEl.textContent = 'Saving...';
    clearTimeout(timer);
    timer = setTimeout(() => {
      store('wmn_text', input.value);
      renderStructure();
      saveEl.textContent = '✓ Saved';
    }, 300);
  }

  input.addEventListener('input', onChange);

  /* ---------- Buttons ---------- */
  document.getElementById('btnSample').addEventListener('click', () => {
    if (input.value.trim() && !confirm('Abhi ka text hat jayega aur sample aa jayega. Continue?')) return;
    input.value = SAMPLE;
    onChange();
    toast('Sample assignment load ho gaya', 'success');
  });

  document.getElementById('btnClear').addEventListener('click', () => {
    if (!input.value) { toast('Text pehle se khaali hai'); return; }
    if (!confirm('Saara text delete kar dein?')) return;
    input.value = '';
    onChange();
    toast('Text clear ho gaya', 'success');
  });

  document.getElementById('btnUpload').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const okType = /\.txt$/i.test(file.name) || file.type === 'text/plain';
    if (!okType) { toast('Sirf .txt file upload karo', 'error'); fileInput.value = ''; return; }
    if (file.size > 2 * 1024 * 1024) { toast('File 2MB se badi hai', 'error'); fileInput.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      let text = String(reader.result || '');
      if (text.length > MAX_CHARS) {
        text = text.slice(0, MAX_CHARS);
        toast('File bahut badi thi, pehle ' + MAX_CHARS + ' characters hi liye gaye', 'error');
      } else {
        toast('File load ho gayi', 'success');
      }
      input.value = text;
      onChange();
    };
    reader.onerror = () => toast('File padh nahi paaye', 'error');
    reader.readAsText(file, 'UTF-8');
    fileInput.value = '';
  });

  /* ---------- Start ---------- */
  input.value = load('wmn_text') || '';
  updateCounts();
  renderStructure();
  if (input.value) saveEl.textContent = '✓ Saved';

  window.WMN = { parseText: parseText, getText: () => input.value };
})();
