#!/usr/bin/env bash
set -euo pipefail

# Run this script from the project's devs/prerna-2026 directory.
for f in index.html app.js styles.css; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: $f not found. Run this script from the devs/prerna-2026 project directory." >&2
    exit 1
  fi
done

python3 - <<'PY'
from pathlib import Path
import re

# Rename all case variants in the project's main source files while keeping
# the original style (Natyaksha -> Prerna, NATYAKSHA -> PRERNA, natyaksha -> prerna).
def rename_brand(match):
    value = match.group(0)
    if value.isupper():
        return "PRERNA"
    if value[:1].isupper():
        return "Prerna"
    return "prerna"

for filename in ("index.html", "app.js", "styles.css"):
    path = Path(filename)
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"natyaksha", rename_brand, text, flags=re.IGNORECASE)
    path.write_text(text, encoding="utf-8")

# Force relative assets to resolve within this Render subdirectory, including
# visits without a trailing slash.
path = Path("index.html")
html = path.read_text(encoding="utf-8")
base_tag = '<base href="/devs/prerna-2026/">'
if re.search(r'<base\s+[^>]*href=["\'][^"\']*["\'][^>]*>', html, flags=re.IGNORECASE):
    html = re.sub(r'<base\s+[^>]*href=["\'][^"\']*["\'][^>]*>', base_tag, html, count=1, flags=re.IGNORECASE)
else:
    html = re.sub(r'(<head\s*>)', r'\1\n  ' + base_tag, html, count=1, flags=re.IGNORECASE)

# Hide the initial loading notice; JavaScript will reveal it only for real errors.
html = re.sub(r'class="load-state(?:\s+is-hidden)?"', 'class="load-state is-hidden"', html, count=1)

# Do not attach the event/program name to the developer credit.
html = html.replace('<span class="footer-credit">Developer @<a', '<span class="footer-credit">Developed by <a')
path.write_text(html, encoding="utf-8")

# Fix the credit on the generated mobile developer page and remove the eyebrow
# that previously repeated the event/program name.
path = Path("app.js")
js = path.read_text(encoding="utf-8")
js, removed = re.subn(r'<div class="developer-eyebrow">.*?</div>', '', js, count=1)
js = js.replace('<p class="developer-credit">Developer @<a', '<p class="developer-credit">Developed by @<a')

# Resolve the PDF URL against the HTML base URL. This prevents no-trailing-slash
# requests from accidentally looking for /devs/brochure.pdf.
old_pdf = 'const PDF_URL = new URLSearchParams(window.location.search).get("pdf") || "brochure.pdf";'
new_pdf = '''const requestedPdf = new URLSearchParams(window.location.search).get("pdf");
  const PDF_URL = new URL(requestedPdf || "brochure.pdf", document.baseURI).href;'''
if old_pdf in js:
    js = js.replace(old_pdf, new_pdf, 1)
elif new_pdf not in js:
    raise SystemExit('Could not find the expected PDF_URL line in app.js; no PDF-path change was made.')

path.write_text(js, encoding="utf-8")
print("Updated branding, developer credits, initial loading state, and asset/PDF base paths.")
PY

echo
echo '--- Remaining Natyaksha references in source files (should be none) ---'
if grep -niE 'natyaksha' index.html app.js styles.css; then
  echo 'Review the matches above.'
else
  echo 'None.'
fi

echo
echo '--- Required asset check ---'
for f in cover.jpg brochure.pdf background-music.mp3; do
  if [[ -s "$f" ]]; then
    ls -lh "$f"
  else
    echo "MISSING: $f"
  fi
done

echo
echo 'Patch complete. Review with: git --no-pager diff --check && git --no-pager diff -- index.html app.js styles.css'
