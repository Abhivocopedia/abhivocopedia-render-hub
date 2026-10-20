# Abhivocopedia Render Hub

- `/` redirects visitors to https://abhivocopedia.github.io/
- `/devs/` explains the project slug convention.
- `/devs/prerna-2026/` contains the Prerana 2026 flipbook.
- Future projects go in `devs/<project-slug>/`.

## Render Static Site settings

- Service name: `abhivocopedia` (if available)
- Build command: `echo "Static files ready"`
- Publish directory: `.`
- Branch: `main` (or your chosen deploy branch)

Connect this repository to the Render static site and push commits to deploy updates. The `onrender.com` hostname must be available for the service name; otherwise choose an available name in Render.
