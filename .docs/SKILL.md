# PDFoid - Copilot Skill

---
name: pdfoid-dev
description: Build and improve PDFoid ingestion, OCR/extraction, redaction, and secure document transformation workflows.
---

## Use This Skill For
- Implementing document pipeline steps.
- Extending OCR/extraction behavior.
- Hardening redaction and privacy controls.

## Rules
- Preserve document integrity through all transforms.
- Never expose raw sensitive fields in logs.
- Add fixture-driven regression tests for pipeline changes.

## Standard Workflow
1. Implement pipeline enhancement.
2. Add/refresh document fixtures and tests.
3. Validate output quality and privacy guarantees.
4. Document operation contract changes.

## Frontend Skill Track (Detailed)
### Frontend Scope
- Document upload workspace, processing pipeline builder, redaction preview, and artifact history panel.

### Context Gathering
- Read pipeline step contracts and redaction policy outputs.
- Confirm retention and privacy mode flags.

### UI Execution Protocol
1. Build upload + file validation UX.
2. Add pipeline step selection and execution options.
3. Add side-by-side redaction preview before export.
4. Add artifact timeline with status and expiry metadata.

### Frontend Quality Gates
- UI warnings for unsupported/dangerous file states are explicit.
- Redaction preview must never reveal masked output once applied.
- Processing status remains observable for long-running tasks.

