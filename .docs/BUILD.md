# PDFoid - Build Guide

## Purpose
PDFoid delivers privacy-first document processing: OCR, extraction, redaction, transformation, and metadata-safe automation.

## Local Build Scope (Phase 1)
- File ingestion and type validation.
- OCR/extraction pipeline contracts.
- Redaction and transformation operations.
- Export/reporting interfaces.

## Suggested Structure
- `src\ingest\` file validation and preprocessing.
- `src\pipeline\` OCR/extract/transform stages.
- `src\redaction\` privacy controls and masking.
- `tests\` document fixtures and regression validations.

## Quality Gates
- No document corruption through transformations.
- Deterministic metadata handling.
- Explicit failure reason for unsupported input types.

