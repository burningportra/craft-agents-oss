# Research: Desktop App Architecture

> **Status:** Research Complete  
> **Date:** 2026-02-01

## Summary

For building a desktop app with Next.js, **Tauri** is recommended over Electron for our use case.

## Comparison: Tauri vs Electron

| Aspect | Tauri | Electron |
|--------|-------|----------|
| Memory (idle) | 30-40 MB | 150-300 MB |
| App size | < 10 MB | ~200 MB |
| Startup time | < 0.5s | 1-2s |
| Backend | Rust | Node.js |
| WebView | Native OS | Bundled Chromium |
| Ecosystem | Growing | Mature, extensive |

## Why Tauri for Our Use Case

1. **Resource efficiency** - Coding tools run alongside IDEs; we shouldn't hog memory
2. **Tauri 2.0** - Released late 2024, stable and feature-complete
3. **Security-first** - Opt-in approach to system API access
4. **Native performance** - Rust backend for file operations / codebase scanning

## Trade-offs

- **Rust learning curve** - Core features need Rust (custom plugins, OS APIs)
- **WebView variations** - Minor visual differences across OSes (vs Chromium consistency)
- **Smaller ecosystem** - Fewer pre-built plugins than Electron

## Next.js + Tauri Setup

Tauri requires Static-Site Generation (SSG) for Next.js:

```javascript
// next.config.js
module.exports = {
  output: 'export', // Generate static files
  images: {
    unoptimized: true,
  },
};
```

## Resources

- [Tauri Next.js Guide](https://tauri.app/guides/frontend/nextjs)
- [Tauri 2.0 Announcement](https://tauri.app)
