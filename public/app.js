(function () {
  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const dropzoneHint = document.getElementById('dropzoneHint');
  const preview = document.getElementById('preview');
  const optionsCard = document.getElementById('optionsCard');
  const sizeSelect = document.getElementById('sizeSelect');
  const customSizeFields = document.getElementById('customSizeFields');
  const customWidth = document.getElementById('customWidth');
  const customHeight = document.getElementById('customHeight');
  const submitBtn = document.getElementById('submitBtn');
  const newUploadBtn = document.getElementById('newUploadBtn');
  const statusEl = document.getElementById('status');

  const CUSTOM_KEY = 'custom';
  const MIN_CM = 1;
  const MAX_CM = 120;

  let selectedFile = null;
  let previewUrl = null;

  function setStatus(message, kind) {
    statusEl.textContent = message || '';
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  function showPreview(hidden) {
    preview.hidden = hidden;
    dropzoneHint.hidden = !hidden;
  }

  async function loadSizes() {
    const res = await fetch('/api/sizes');
    const sizes = await res.json();
    sizeSelect.innerHTML = '';
    for (const s of sizes) {
      const opt = document.createElement('option');
      opt.value = s.key;
      opt.textContent = s.label;
      sizeSelect.appendChild(opt);
    }
    const customOpt = document.createElement('option');
    customOpt.value = CUSTOM_KEY;
    customOpt.textContent = 'Egyéni méret';
    sizeSelect.appendChild(customOpt);
  }

  sizeSelect.addEventListener('change', () => {
    customSizeFields.hidden = sizeSelect.value !== CUSTOM_KEY;
  });

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      setStatus('Kérlek képfájlt válassz.', 'error');
      return;
    }

    selectedFile = file;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
  }

  preview.addEventListener('load', () => {
    showPreview(false);
    optionsCard.hidden = false;
    setStatus('');

    const isLandscape = preview.naturalWidth >= preview.naturalHeight;
    const orientationValue = isLandscape ? 'landscape' : 'portrait';
    const orientationInput = document.querySelector(`input[name="orientation"][value="${orientationValue}"]`);
    if (orientationInput) {
      orientationInput.checked = true;
    }
  });

  preview.addEventListener('error', () => {
    showPreview(true);
    optionsCard.hidden = true;
    setStatus('Nem sikerült betölteni a képet. Kérlek próbálj másik fájlt.', 'error');
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      handleFile(fileInput.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  newUploadBtn.addEventListener('click', () => {
    window.location.reload();
  });

  submitBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      setStatus('Először tölts fel egy képet.', 'error');
      return;
    }

    const mode = document.querySelector('input[name="mode"]:checked').value;
    const orientation = document.querySelector('input[name="orientation"]:checked').value;
    const size = sizeSelect.value;

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('size', size);
    formData.append('mode', mode);
    formData.append('orientation', orientation);

    if (size === CUSTOM_KEY) {
      const width = parseFloat(customWidth.value);
      const height = parseFloat(customHeight.value);

      if (!Number.isFinite(width) || !Number.isFinite(height)) {
        setStatus('Kérlek add meg a szélességet és a magasságot centiméterben.', 'error');
        return;
      }
      if (width < MIN_CM || width > MAX_CM || height < MIN_CM || height > MAX_CM) {
        setStatus(`A méretek ${MIN_CM} és ${MAX_CM} cm között lehetnek.`, 'error');
        return;
      }

      formData.append('width_cm', width);
      formData.append('height_cm', height);
    }

    submitBtn.disabled = true;
    setStatus('Feldolgozás folyamatban...');

    try {
      const res = await fetch('/api/resize', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Hiba történt.');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : 'atmeretezett_kep.jpg';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setStatus('Kész! A letöltés elindult.', 'success');
    } catch (err) {
      setStatus(err.message || 'Ismeretlen hiba történt.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  loadSizes().catch(() => setStatus('Nem sikerült betölteni a méretlistát.', 'error'));
})();
