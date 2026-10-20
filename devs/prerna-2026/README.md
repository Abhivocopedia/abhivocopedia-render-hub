# Natyaksha PDF Flipbook Replica

A lightweight, static-site recreation of the Natyaksha brochure's page-turn experience. It keeps the animated maroon/gold background, the 3D book stack and leaf-flip motion, keyboard navigation, and the phone portrait-to-landscape layout. PDF.js renders brochure pages from a PDF instead of hand-authored HTML page content.

## Put your actual assets here

1. Replace `cover.png` with the original project's cover artwork. The provided `cover.png` is a **visual placeholder** because the original cover image was not included in the uploaded source files.
2. Place the brochure PDF in this folder and name it `brochure.pdf`. The PDF was not included with the uploaded files, so the archive intentionally does not invent a brochure file.
3. Optional: place `background-music.mp3` in this folder to enable the original quick-triple-click music toggle.

The cover is loaded directly from `cover.png`. Pages are discovered from the PDF at runtime, so the app supports PDFs with 1, 2, or many pages. It treats the cover image as the outside cover, then maps the PDF pages onto the book's inside faces. On phone/touch layouts, a final developer-credit page is added after the PDF content. On PC layouts, that credit appears in the footer instead.

## Run locally

Use a local web server; opening `index.html` directly as a `file://` URL will not work because browsers restrict PDF fetching and PDF.js workers.

**Windows CMD** (run in this folder):

```bat
py -m http.server 8000
```

**WSL / Linux**:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser. PDF.js is loaded from cdnjs, so an internet connection is needed. If your PDF has a different filename, open `http://localhost:8000/?pdf=your-file.pdf` (URL-encode spaces in the name).

## Navigation

- Click/tap the cover to open it.
- In the opened book, click/tap the left half to go back and the right half to go forward.
- Keyboard: `←` previous, `→` / `Enter` next.
- The initial instructions fade out after five seconds.
- Triple-click/tap quickly to toggle optional background music if `background-music.mp3` exists.

## Deploy

Upload the folder contents to any static host (Vercel, Render Static Site, GitHub Pages, etc.). Ensure `brochure.pdf` and `cover.png` are included in the published directory and that the host serves `.pdf` files with a PDF content type.
