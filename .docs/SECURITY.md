# PDFoid - Security Guide

## Threat Model
- Malicious document payloads.
- Unauthorized access to uploaded documents.
- PII leakage in transformed outputs.

## Controls
- Strict MIME/content validation and sandboxed processing.
- Encrypted storage and signed temporary URLs.
- Default redaction/masking safeguards.
- Access logging and tenant isolation.

## Privacy Controls
- Data minimization for metadata retention.
- Configurable retention and secure deletion.
- Disable persistent storage in strict privacy mode.

## Incident Response
- Quarantine suspicious artifacts.
- Revoke signed URLs/tokens.
- Reprocess impacted jobs with patched pipeline.

