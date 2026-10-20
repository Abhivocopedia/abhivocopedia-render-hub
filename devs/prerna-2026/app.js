(() => {
  "use strict";

  const book = document.getElementById("book");
  const loadState = document.getElementById("loadState");
  const loadTitle = loadState.querySelector(".load-title");
  const loadMessage = document.getElementById("loadMessage");
  const pageCounter = document.getElementById("pageCounter");
  const turnHint = document.getElementById("turnHint");
  const guide = document.getElementById("coverGuide");
  const guideClose = document.getElementById("guideClose");
  const audio = document.getElementById("natyakshaBackgroundMusic");
  const PDF_URL = new URLSearchParams(window.location.search).get("pdf") || "brochure.pdf";
  const CREDIT_URL = "https://abhivocopedia.github.io";
  const FLIP_MS = 900;
  const MOBILE_QUERY = window.matchMedia("(max-width: 700px), (hover: none) and (pointer: coarse)");

  let pdfDoc = null;
  let leaves = [];
  let pages = [];
  let currentIndex = 0;
  let isAnimating = false;
  let animatingLeaf = null;
  let reflowTimer = null;
  let guideTimer = null;
  let lastClickAt = 0;
  let rapidClickCount = 0;
  const renderedPages = new Map();

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  function isPhoneView() { return MOBILE_QUERY.matches; }

  function setStatus(title, message, error = false) {
    loadTitle.textContent = title;
    loadMessage.textContent = message;
    loadState.classList.toggle("is-error", error);
    loadState.classList.remove("is-hidden");
  }
  function hideStatus() { loadState.classList.add("is-hidden"); }
  loadState.addEventListener("click", () => { if (loadState.classList.contains("is-error")) hideStatus(); });

  function hideGuide() {
    if (!guide) return;
    guide.classList.add("is-hidden");
    if (guideTimer) window.clearTimeout(guideTimer);
  }
  if (guide) {
    guide.addEventListener("click", event => event.stopPropagation());
    guideClose?.addEventListener("click", event => { event.preventDefault(); hideGuide(); });
    guideTimer = window.setTimeout(hideGuide, 5000);
  }

  function createFace(descriptor, side) {
    const face = document.createElement("div");
    face.className = `face ${side}`;
    if (!descriptor) {
      face.classList.add("blank-face");
      face.setAttribute("aria-hidden", "true");
      return face;
    }

    face.dataset.visualPage = String(descriptor.visualIndex);
    if (descriptor.type === "cover") {
      face.classList.add("cover-face");
      const img = document.createElement("img");
      img.className = "cover-image";
      img.src = "cover.jpg";
      img.alt = "Natyaksha 2026 cover";
      img.draggable = false;
      face.appendChild(img);
      if (side === "front") {
        if (guide) face.appendChild(guide);
      }
      return face;
    }

    const surface = document.createElement("div");
    surface.className = "page-surface";
    if (descriptor.type === "developer") {
      face.classList.add("developer-page");
      const card = document.createElement("div");
      card.className = "developer-card";
      card.innerHTML = `<div class="developer-ornament" aria-hidden="true">❖ ✦ ❖</div><div class="developer-eyebrow">Natyaksha · Digital Brochure</div><h2 class="developer-title">Thank you for exploring</h2><p class="developer-credit">Developer @<a href="${CREDIT_URL}" target="_blank" rel="noopener noreferrer">abhivocopedia</a></p>`;
      surface.appendChild(card);
    } else if (descriptor.type === "pdf") {
      const loading = document.createElement("div");
      loading.className = "pdf-loading";
      loading.textContent = `Page ${descriptor.pdfPage}`;
      surface.appendChild(loading);
      descriptor.surface = surface;
    }
    face.appendChild(surface);
    return face;
  }

  function makeLeaf(leafIndex, descriptorList) {
    const leaf = document.createElement("div");
    leaf.className = "leaf";
    leaf.dataset.leafIndex = String(leafIndex);
    const frontDescriptor = descriptorList[leafIndex * 2] || null;
    const backDescriptor = descriptorList[leafIndex * 2 + 1] || null;
    leaf.appendChild(createFace(frontDescriptor, "front"));
    leaf.appendChild(createFace(backDescriptor, "back"));
    return leaf;
  }

  function buildPageDescriptors() {
    pages = [{ type: "cover", visualIndex: 0, label: "Cover" }];
    if (pdfDoc) {
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        pages.push({ type: "pdf", visualIndex: pages.length, pdfPage: i, label: `PDF page ${i}` });
      }
    }
    if (isPhoneView()) {
      pages.push({ type: "developer", visualIndex: pages.length, label: "Developer credit" });
    }
  }

  function buildBook() {
    buildPageDescriptors();
    book.replaceChildren();
    leaves = [];
    renderedPages.clear();
    currentIndex = 0;
    isAnimating = false;
    animatingLeaf = null;
    const leafCount = Math.ceil(pages.length / 2);

    // DOM order is intentionally reversed. The first element in the interaction array is the cover,
    // matching the source flipbook's z-index and spine animation.
    for (let i = leafCount - 1; i >= 0; i--) book.appendChild(makeLeaf(i, pages));
    leaves = Array.from(book.querySelectorAll(".leaf")).reverse();
    renderState();
    renderNearCurrent();
  }

  function renderState() {
    const stackPages = Math.max(0, leaves.length - currentIndex);
    const stackDepth = Math.min(7, 1.5 + stackPages);
    book.style.setProperty("--stack-depth", `${stackDepth}px`);
    book.style.setProperty("--stack-inner-depth", `${Math.max(.8, stackDepth * .54)}px`);

    leaves.forEach((leaf, i) => {
      const flipped = i < currentIndex;
      leaf.classList.toggle("flipped", flipped);
      if (leaf === animatingLeaf) leaf.style.zIndex = "999";
      else if (flipped) leaf.style.zIndex = String(10 + i);
      else leaf.style.zIndex = String(100 - i);
    });
    book.classList.toggle("open", currentIndex > 0);
    updateCounter();
  }

  function updateCounter() {
    if (!pageCounter) return;
    if (currentIndex === 0) {
      pageCounter.textContent = "Cover";
      turnHint.textContent = "Tap to open";
      turnHint.classList.remove("is-hidden");
      return;
    }
    const pageIndex = Math.min(pages.length - 1, currentIndex * 2 - 1);
    const rightIndex = Math.min(pages.length - 1, currentIndex * 2);
    const left = pages[pageIndex]?.label || "Cover";
    const right = pages[rightIndex]?.label;
    pageCounter.textContent = right ? `${left} · ${right}` : left;
    turnHint.classList.add("is-hidden");
  }

  async function renderPdfPage(descriptor) {
    if (!pdfDoc || descriptor.type !== "pdf") return;
    if (renderedPages.has(descriptor.pdfPage)) return renderedPages.get(descriptor.pdfPage);
    const task = (async () => {
      const page = await pdfDoc.getPage(descriptor.pdfPage);
      const baseViewport = page.getViewport({ scale: 1 });
      // A sharp but bounded canvas prevents extremely large brochures exhausting phone memory.
      const maxSide = Math.min(1800, Math.max(900, (window.devicePixelRatio || 1) * 900));
      const scale = Math.min(3, maxSide / Math.max(baseViewport.width, baseViewport.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: context, viewport, background: "#fff8e4" }).promise;

      // The user may have flipped far ahead while this page was rendering. Keep only nearby
      // canvases resident so long PDFs do not accumulate hundreds of large bitmap surfaces.
      if (!isNearCurrent(descriptor)) { page.cleanup(); return; }
      const surface = descriptor.surface || book.querySelector(`[data-visual-page="${descriptor.visualIndex}"] .page-surface`);
      if (surface) {
        surface.replaceChildren(canvas);
        canvas.setAttribute("aria-label", `PDF page ${descriptor.pdfPage}`);
      }
      page.cleanup();
    })().catch(error => {
      console.error(`Could not render PDF page ${descriptor.pdfPage}`, error);
      const surface = descriptor.surface || book.querySelector(`[data-visual-page="${descriptor.visualIndex}"] .page-surface`);
      if (surface) {
        const note = document.createElement("div");
        note.className = "pdf-loading";
        note.textContent = `Page ${descriptor.pdfPage} could not be rendered.`;
        surface.replaceChildren(note);
      }
    });
    renderedPages.set(descriptor.pdfPage, task);
    return task;
  }

  function currentRenderRange() {
    return {
      low: Math.max(1, currentIndex * 2 - 2),
      high: Math.min(pages.length - 1, currentIndex * 2 + 3)
    };
  }

  function isNearCurrent(descriptor) {
    const { low, high } = currentRenderRange();
    return descriptor.visualIndex >= low && descriptor.visualIndex <= high;
  }

  function renderNearCurrent() {
    if (!pdfDoc) return;
    const { low, high } = currentRenderRange();
    // Release canvases well away from the current spread and its preload window.
    pages.filter(p => p.type === "pdf" && !isNearCurrent(p)).forEach(descriptor => {
      const surface = descriptor.surface || book.querySelector(`[data-visual-page="${descriptor.visualIndex}"] .page-surface`);
      if (surface?.querySelector("canvas")) {
        const note = document.createElement("div");
        note.className = "pdf-loading";
        note.textContent = `Page ${descriptor.pdfPage}`;
        surface.replaceChildren(note);
      }
      renderedPages.delete(descriptor.pdfPage);
    });
    const jobs = pages.slice(low, high + 1).filter(p => p.type === "pdf").map(renderPdfPage);
    Promise.all(jobs).catch(console.error);
  }

  function turnNext() {
    if (isAnimating || currentIndex >= leaves.length) return;
    hideGuide();
    isAnimating = true;
    animatingLeaf = leaves[currentIndex];
    currentIndex++;
    renderState();
    renderNearCurrent();
    window.setTimeout(() => { isAnimating = false; animatingLeaf = null; renderState(); }, FLIP_MS);
  }
  function turnPrevious() {
    if (isAnimating || currentIndex <= 0) return;
    hideGuide();
    isAnimating = true;
    animatingLeaf = leaves[currentIndex - 1];
    currentIndex--;
    renderState();
    renderNearCurrent();
    window.setTimeout(() => { isAnimating = false; animatingLeaf = null; renderState(); }, FLIP_MS);
  }

  function isRotatedPhone() {
    return window.matchMedia("(orientation: portrait) and (max-width: 900px)").matches;
  }
  function clickBelongsToControl(target) {
    return Boolean(target.closest("a,button,#coverGuide,iframe,[data-no-flip],.load-state,.desktop-footer"));
  }

  document.addEventListener("click", event => {
    if (clickBelongsToControl(event.target)) return;
    if (isAnimating) return;
    // Match the source behavior: the screen's left/right tap zones remain usable outside the book.
    if (currentIndex === 0) { turnNext(); return; }
    const isLeft = isRotatedPhone() ? event.clientY > window.innerHeight / 2 : event.clientX < window.innerWidth / 2;
    if (isLeft) turnPrevious(); else turnNext();
  });
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    book.addEventListener("mouseenter", () => { if (currentIndex === 0) turnNext(); });
  }
  document.addEventListener("keydown", event => {
    if (["INPUT", "TEXTAREA", "BUTTON", "A"].includes(document.activeElement?.tagName)) return;
    if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") { event.preventDefault(); turnNext(); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); turnPrevious(); }
  });

  // Start the background music at the first permitted interaction; browsers may block autoplay.
  let musicStarting = false;
  let burstStartedWithMusic = false;

  async function startMusic() {
    if (!audio || musicStarting || !audio.paused) return;
    musicStarting = true;
    audio.loop = true;
    audio.volume = 0;
    try {
      await audio.play();
      const startedAt = performance.now();
      const duration = 1800;
      const fade = now => {
        if (audio.paused) return;
        const t = Math.min(1, (now - startedAt) / duration);
        audio.volume = 0.55 * t;
        if (t < 1) requestAnimationFrame(fade);
      };
      requestAnimationFrame(fade);
    } catch (error) {
      // Autoplay may be blocked. The first real page click retries playback.
      console.info('Background music is waiting for a user interaction.', error);
    } finally {
      musicStarting = false;
    }
  }

  function stopMusic() {
    if (!audio) return;
    audio.pause();
    audio.volume = 0;
  }

  document.addEventListener('click', event => {
    if (clickBelongsToControl(event.target)) {
      rapidClickCount = 0;
      lastClickAt = 0;
      return;
    }

    const now = performance.now();
    if (!lastClickAt || now - lastClickAt > 650) {
      rapidClickCount = 1;
      // Remember whether music was already playing before this tap sequence.
      burstStartedWithMusic = Boolean(audio && !audio.paused);
    } else {
      rapidClickCount += 1;
    }
    lastClickAt = now;

    // A single page interaction starts music; no triple-tap is required to begin.
    if (audio?.paused) void startMusic();

    // Three quick taps can still stop music, but won't cancel music as it first starts.
    if (rapidClickCount >= 3) {
      rapidClickCount = 0;
      lastClickAt = 0;
      if (burstStartedWithMusic && audio && !audio.paused) stopMusic();
    }
  }, { passive: true });

  audio?.addEventListener('error', () => {
    console.error('Background music failed to load. Check that background-music.mp3 is beside index.html.', audio.currentSrc);
  });

  // Attempt autoplay where allowed; if blocked, startMusic() retries on the first page click.
  void startMusic();

  async function start() {
    // Keep a cover visible even while PDF parsing/loading happens.
    book.replaceChildren(document.getElementById("initialCover"));
    try {
      if (!window.pdfjsLib) throw new Error("PDF.js did not load. Check your internet connection and reload.");
      const loadingTask = window.pdfjsLib.getDocument({ url: PDF_URL, isEvalSupported: false });
      pdfDoc = await loadingTask.promise;
      if (!pdfDoc.numPages) throw new Error("The selected PDF does not contain any pages.");
      buildBook();
      hideStatus();
      // When the cover guide moves into the newly built leaf, the existing timeout remains attached.
    } catch (error) {
      console.error("Brochure initialization failed:", error);
      const extra = error?.message || "The brochure could not be loaded.";
      setStatus("PDF not ready", `Add your PDF as <code>brochure.pdf</code> beside index.html, then reload. You can also open <code>?pdf=another-file.pdf</code>. Details: ${escapeHtml(extra)}`, true);
      // Keep the cover clickable even without the PDF, so the artwork still previews.
      leaves = Array.from(book.querySelectorAll(".leaf"));
      leaves[0]?.addEventListener("click", hideStatus);
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  }

  // Crossing from desktop to a phone-sized viewport changes whether a final developer page is added.
  MOBILE_QUERY.addEventListener?.("change", () => {
    if (!pdfDoc) return;
    window.clearTimeout(reflowTimer);
    reflowTimer = window.setTimeout(buildBook, 120);
  });
  start();
})();
