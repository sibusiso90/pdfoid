# PDFoid - Production Guide

## Deployment Model
- Web/API service for document operations.
- Worker queue for heavy OCR and batch jobs.
- Secure object storage for input/output artifacts.

## Required Configuration
- `MAX_UPLOAD_MB`
- `OCR_PROVIDER`
- `OUTPUT_RETENTION_DAYS`
- `PDFOID_PRIVACY_MODE`

## Runtime Flow
1. Validate and fingerprint upload.
2. Execute requested pipeline steps.
3. Generate output with optional redaction policy.
4. Return artifact references and audit metadata.

## Reliability
- Idempotent processing by document fingerprint.
- Worker retry policy with dead-letter queue.
- Progress status checkpoints for long jobs.

