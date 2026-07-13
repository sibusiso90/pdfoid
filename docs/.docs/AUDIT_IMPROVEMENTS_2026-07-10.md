# Audit & Improvements — 2026-07-10

Product: **PDFoid**

## Audit findings addressed
- Root package.json already present; constellation install UX hardening

## Improvements applied
- Ensured Bun metadata, bunfig, INSTALL.md

## Install verification
- JS/TS packages: run `bun install` from the directory containing `package.json` (repo root for workspace packages).
- Python packages: use venv + pip (`INSTALL.md`).

## Related
- [How to Use](./how-to-use.md)
- [Security](./security.md)
- [ADR-0003 Package Manager](./adr-0003-package-manager-bun.md)
