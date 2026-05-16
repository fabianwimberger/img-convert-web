# img-convert-web

[![CI](https://github.com/fabianwimberger/img-convert-web/actions/workflows/ci.yml/badge.svg)](https://github.com/fabianwimberger/img-convert-web/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A browser image conversion service for resizing and exporting images without uploading them to a server.

## Background

Small web publishing jobs often need the same image handoff as the desktop `img-convert` tool: resize to a predictable short side, choose a web format, and download the result. GitHub Pages cannot run native encoders, so this service keeps the workflow public and zero-hosting-cost by using browser canvas encoders for formats the visitor's browser supports.

## Features

- **Local conversion** — images stay in the browser
- **Format choice** — JPG, PNG, WebP, and AVIF when supported by the browser
- **Resize targets** — original, common short-side presets, megapixel presets, and custom values
- **Quality control** — browser encoder quality slider for lossy formats
- **Alpha handling** — configurable background color for JPG output
- **Batch download** — converted files are packaged as a dependency-free ZIP
- **Light / dark theme** — matches the `img-convert` palette
- **GitHub Pages deployment** — workflow publishes the static app from `docs/`

## Live Service

View the service at **[fabianwimberger.github.io/img-convert-web](https://fabianwimberger.github.io/img-convert-web/)**.

## Quick Start

```bash
# Clone
git clone https://github.com/fabianwimberger/img-convert-web.git
cd img-convert-web

# Serve locally
python3 -m http.server 8000 --directory docs
```

Open `http://localhost:8000`.

## How It Works

```text
Source images -> Browser decode -> Canvas resize -> Browser encode -> ZIP download
```

## Configuration

No environment variables are required.

| Variable | Default | Description |
| -------- | ------- | ----------- |
| N/A      | N/A     | Static GitHub Pages deployment from `docs/` |

## License

MIT License - see [LICENSE](LICENSE).

### Third-Party Licenses

| Component | License | Source |
| --------- | ------- | ------ |
| None      | N/A     | N/A    |
