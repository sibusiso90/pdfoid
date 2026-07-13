# How to Use PDFoid

Browser PDF viewer/editor with annotations and local text tools.

## 1) Install & start

```bash
bun install
bun run dev
```

Open http://localhost:5173

Production preview:

```bash
bun run build
bun run preview
```

## 2) Core workflow
1. Upload a PDF
2. Navigate pages / zoom
3. Annotate (highlight, text, signature tools as available)
4. Summarize/extract keywords locally when needed
5. Export/download results

## 3) Local data
- Annotations can persist in IndexedDB, scoped by document id
- No server secrets required for core local use

## 4) Production notes
- Prefer self-hosted PDF.js worker assets
- Validate upload limits if fronted by a backend

## Related
- [INSTALL.md](../../INSTALL.md)
- [Architecture](./architecture.md)
- [Security](./security.md)
