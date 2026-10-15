# Known Limitations

## Find & Replace (PDF text editing)
- Current implementation uses overlay replacement (white rectangle + new text).
- It cannot guarantee perfect visual parity with the original font/kerning.
- Rotated/skewed text and glyph-by-glyph layouts may be skipped for safety.
- Replacement text is drawn with Helvetica, which only covers Western European
  characters (WinAnsi). Other characters are substituted (e.g. `→` becomes `->`)
  or shown as `?`.

## Redaction
- A page with redaction marks is replaced by an image of itself, with the boxes
  burned into the pixels. This guarantees the content is gone, but the whole page
  stops being selectable/searchable and its links and form fields are removed.
  Run OCR afterwards if the remaining text must be searchable.
- Redaction does not touch document-level data such as metadata, bookmarks or
  attachments.
- Export is blocked while redaction marks are unapplied (`PendingRedactionsError`);
  flatten annotations first.

## Password-protected PDFs
- Files are decrypted on open and edited unencrypted in memory. Exported copies are
  unencrypted unless you choose a password at export (AES-256).

## OCR
- English only for now. The language model (~4 MB) is downloaded from the
  tessdata CDN on first use; the OCR engine itself is self-hosted.
- The recognised text is added as an invisible layer, so selection boxes only
  approximate the scanned glyphs.

## Recent files
- Kept in this browser's IndexedDB (8 most recent, up to 50 MB each). Clearing
  site data removes them.
