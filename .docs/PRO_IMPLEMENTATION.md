# PDFoid PRO — Implementation Specification
> **Classification:** Lehro Solutions Internal — Strategic Roadmap  
> **Source Intelligence:** TOOLS-OPENSOURCE/RESEARCH-2026-OPENSOURCE-TOOLS.md §3.5  
> **Competitive Context:** Stirling PDF (74,400+ stars) owns utility PDF tools. PDFoid MUST own **AI document intelligence** — not basic editing.  
> **Architecture Principle:** _Your documents never leave your device._ This is a legal selling point post-EU AI Act (Aug 2025) and POPIA enforcement.

---

## Table of Contents
1. [Strategic Positioning](#1-strategic-positioning)
2. [PRO Feature Architecture](#2-pro-feature-architecture)
3. [Implementation Plan — Phase by Phase](#3-implementation-plan)
4. [AI Intelligence Layer](#4-ai-intelligence-layer)
5. [SA-Specific Document Engine](#5-sa-specific-document-engine)
6. [CV Engine v2](#6-cv-engine-v2)
7. [Enterprise Features](#7-enterprise-features)
8. [Technical Stack Decisions](#8-technical-stack-decisions)
9. [Performance Targets](#9-performance-targets)
10. [Security Scan Findings](#10-security-scan-findings)
11. [Claude Security Remediation Plan](#11-claude-security-remediation-plan)

---

## 1. Strategic Positioning

### Why "Privacy-First Document Intelligence" wins

| Competitor | Strength | Weakness (our opening) |
|---|---|---|
| Stirling PDF | 74K stars, 50+ tools, desktop app | Zero AI intelligence — just transformations |
| Adobe Acrobat | Feature-complete | Cloud upload required, expensive, slow |
| IlovePDF / Smallpdf | Easy UX | Everything goes to servers — POPIA/GDPR problem |
| ChatPDF, Docsumo | AI intelligence | Server-side processing violates data sovereignty |
| **PDFoid PRO** | **Local AI + privacy + SA compliance** | **None — this is the moat** |

**The one-liner:** "The only AI-powered document platform where your documents are processed 100% on your device."

---

## 2. PRO Feature Architecture

```
PDFoid PRO v2.0
├── LAYER 0: Core Editor (EXISTING — maintain)
│   ├── PDF Viewer + Navigation ✅
│   ├── Annotations (highlight, draw, notes) ✅
│   ├── Crop, Signature Pad ✅
│   └── CV Generator (4 templates) ✅
│
├── LAYER 1: AI Intelligence Layer (NEW — HIGH PRIORITY)
│   ├── Local LLM Integration (Transformers.js / WebLLM)
│   │   ├── Document Q&A — "Chat with your PDF"
│   │   ├── Smart Summarization (upgrade existing graph-based to LLM)
│   │   ├── Document Comparison — diff two PDFs, explain changes
│   │   ├── Contract Clause Extractor — key dates, parties, obligations
│   │   └── Form Auto-Fill — learn from completed forms
│   └── On-Device OCR (Tesseract.js upgrade to v6)
│       ├── Scanned document text extraction
│       └── SA ID card/passport OCR
│
├── LAYER 2: Format Expansion (NEW — MEDIUM PRIORITY)
│   ├── DOCX/ODT Processing (mammoth.js)
│   ├── Spreadsheet Intelligence (SheetJS + AI summarization)
│   ├── Email Parsing (.eml, .mbox via email-parser)
│   └── Presentation Analysis (pptx2json)
│
├── LAYER 3: SA-Specific Document Engine (NEW — HIGH PRIORITY)
│   ├── SA ID Number Parser + Validator (Luhn algorithm + DOB extraction)
│   ├── SARS Document Templates (IRP5, IT12, VAT201)
│   ├── Bank Statement Analyzer (FNB, Standard Bank, ABSA, Nedbank, Capitec formats)
│   ├── Municipal Account Parser (City of Joburg, eThekwini, City of Cape Town)
│   └── CIPC Document Generator (CoR14.3, CoR39, annual returns)
│
├── LAYER 4: CV Engine v2 (UPGRADE EXISTING)
│   ├── 20+ ATS-Optimized Templates (up from 4)
│   ├── SA Job Market Keyword Optimizer
│   ├── Cover Letter Generator (local AI)
│   ├── LinkedIn Export Parser (profile.json → CV)
│   └── ATS Score Checker (simulate ATS ranking)
│
└── LAYER 5: Enterprise Features (PREMIUM TIER)
    ├── Batch Processing — process entire folder offline
    ├── Headless API Mode (Electron + local server)
    ├── POPIA Auto-Redaction (integrate ComplianceKit scanner)
    ├── Encrypted Team Collaboration (CRDTs + E2E encryption)
    └── Custom LLM Injection (point at local Ollama endpoint)
```

---

## 3. Implementation Plan

### Phase 1: AI Intelligence Layer — Local LLM (Weeks 1–4)

**Goal:** Ship "Chat with your PDF" as the PRO flagship feature. This is the #1 differentiator vs Stirling PDF.

#### 3.1 Install WebLLM / Transformers.js

```bash
# Option A: Transformers.js (Hugging Face) — smaller models, WASM
npm install @xenova/transformers

# Option B: WebLLM — GPU-accelerated via WebGPU
npm install @mlc-ai/web-llm
```

**Decision logic:**
- Use `@xenova/transformers` with `Xenova/distilbert-base-uncased` for Q&A on modest hardware
- Progressive enhance to WebLLM (`Llama-3.2-1B-Instruct`) when `navigator.gpu` is available
- Always fall back to existing `summarizeText()` in `src/utils/ai.ts` if no LLM available

#### 3.2 New file: `src/utils/localLlm.ts`

```typescript
// Detection + progressive enhancement pattern
export async function getInferenceBackend(): Promise<'webllm' | 'transformers' | 'fallback'> {
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) return 'webllm';
    } catch {}
  }
  if (typeof SharedArrayBuffer !== 'undefined') return 'transformers';
  return 'fallback';
}

// Unified interface regardless of backend
export interface LLMProvider {
  ask(question: string, context: string): Promise<string>;
  summarize(text: string, maxSentences?: number): Promise<string>;
  extractFields(text: string, fieldNames: string[]): Promise<Record<string, string>>;
}
```

#### 3.3 New component: `src/components/DocumentChat.tsx`

- Sidebar panel that opens when user clicks "Chat with document"
- Message thread UI (user message → AI response)
- Streams tokens to avoid perceived latency
- "Page reference" citations in AI responses (e.g., "based on page 4")
- Loading skeleton while model loads from CDN (first use only, then IndexedDB cached)

**IndexedDB model caching pattern:**
```typescript
// Cache model weights in IndexedDB so second load is instant
const MODEL_CACHE_KEY = 'pdfoid.llm.weights.v1';
// On first use: download from CDN (~250MB for Llama-3.2-1B quantized)
// Subsequent uses: serve from IndexedDB — zero network requests
```

#### 3.4 Upgrade `src/utils/ai.ts` `summarizeText()`

Current: Graph-based sentence ranking (good, fast, no network).  
PRO upgrade: LLM-powered summarization when model is loaded; fall back to existing when not.

```typescript
export async function summarizeTextPro(
  text: string,
  opts: { maxSentences?: number; style?: 'bullet' | 'paragraph' } = {}
): Promise<string> {
  const backend = await getInferenceBackend();
  if (backend !== 'fallback') {
    return await llmSummarize(text, opts);
  }
  // Graceful fallback to existing implementation
  return summarizeText(text, opts);
}
```

---

### Phase 2: SA Document Engine (Weeks 3–6)

#### 3.5 SA ID Number Validator — `src/utils/saDocuments.ts`

```typescript
// SA ID: YYMMDDGSSSSCAZ
// Y=DOB, G=gender (0-4=female, 5-9=male), S=sequence, C=citizenship, A=obsolete, Z=Luhn check digit
export function parseSaId(idNumber: string): SAIdResult {
  if (!/^\d{13}$/.test(idNumber)) return { valid: false, reason: 'Must be 13 digits' };
  
  const dob = idNumber.slice(0, 6);    // YYMMDD
  const gender = parseInt(idNumber[6]); // 0-4=F, 5-9=M
  const citizenship = idNumber[10];     // 0=SA citizen, 1=permanent resident
  
  // Luhn check digit validation
  if (!luhnCheck(idNumber)) return { valid: false, reason: 'Invalid check digit' };
  
  return {
    valid: true,
    dob: parseDob(dob),
    gender: gender >= 5 ? 'M' : 'F',
    citizen: citizenship === '0',
  };
}
```

#### 3.6 Bank Statement Parser

Support the 5 major SA bank statement PDF formats:

```typescript
// Pattern matching approach — no server needed
const BANK_PATTERNS: Record<string, BankPattern> = {
  FNB: {
    datePattern: /(\d{2}\s+\w{3}\s+\d{4})/,
    amountPattern: /R\s*([\d,]+\.\d{2})/,
    descriptionPattern: /^([A-Z\s0-9\/\-]+)\s{2,}/m,
  },
  ABSA: { /* ... */ },
  STANDARD_BANK: { /* ... */ },
  NEDBANK: { /* ... */ },
  CAPITEC: { /* ... */ },
};

export function analyzeBankStatement(text: string): BankStatementResult {
  const bank = detectBank(text);
  const transactions = extractTransactions(text, BANK_PATTERNS[bank]);
  return {
    bank,
    accountHolder: extractAccountHolder(text, bank),
    period: extractPeriod(text, bank),
    openingBalance: extractBalance(text, 'opening', bank),
    closingBalance: extractBalance(text, 'closing', bank),
    transactions,
    summary: {
      totalCredits: transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0),
      totalDebits: transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0),
      largestTransaction: transactions.sort((a,b) => b.amount - a.amount)[0],
    }
  };
}
```

---

### Phase 3: CV Engine v2 (Weeks 4–8)

#### 3.7 Template Expansion Strategy

Current: 4 templates (modern, classic, minimal, creative)  
Target: 20+ templates with ATS scoring

```
templates/
├── professional/    (corporate SA market)
│   ├── executive.ts   — C-suite / board level
│   ├── finance.ts     — CA(SA) / CFA / banking
│   ├── legal.ts       — attorney / advocate formats
│   └── government.ts  — SA public sector / SOE format (DPSA compliant)
│
├── technical/       (developer / engineering market)
│   ├── developer.ts   — GitHub links, project portfolio
│   ├── data-science.ts — publications, model metrics
│   └── devops.ts      — cert badges, cloud stack
│
├── creative/        (design / media / marketing)
│   ├── designer.ts    — portfolio-focused, visual
│   └── media.ts       — broadcast, journalism
│
└── sa-specific/     (uniquely SA formats)
    ├── bbbee.ts       — B-BBEE contributor level highlight
    ├── matric.ts      — matric certificate focus (entry-level)
    └── nqf.ts         — NQF level framework alignment
```

#### 3.8 ATS Score Checker

```typescript
// Simulate how ATS systems rank CVs for a given job description
export function checkAtsScore(
  cvText: string,
  jobDescription: string
): ATSResult {
  const cvKeywords = extractKeywords(cvText);
  const jobKeywords = extractKeywords(jobDescription);
  
  const matched = jobKeywords.filter(k => cvKeywords.includes(k));
  const score = (matched.length / jobKeywords.length) * 100;
  
  return {
    score: Math.round(score),
    matchedKeywords: matched,
    missingKeywords: jobKeywords.filter(k => !cvKeywords.includes(k)),
    suggestions: generateSuggestions(matched, jobKeywords),
  };
}
```

---

### Phase 4: Format Expansion (Weeks 6–10)

#### 3.9 DOCX Processing

```bash
npm install mammoth  # DOCX → clean HTML
```

```typescript
// src/utils/docxProcessor.ts
import * as mammoth from 'mammoth';

export async function processDocx(file: File): Promise<ProcessedDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return {
    text: result.value,
    format: 'docx',
    messages: result.messages,
  };
}
```

#### 3.10 Spreadsheet Intelligence

```bash
npm install xlsx  # SheetJS — 100% client-side
```

```typescript
// src/utils/spreadsheetAnalyzer.ts
export function analyzeSpreadsheet(file: File): Promise<SpreadsheetAnalysis> {
  // Detect patterns: dates, financial figures, PII
  // Run anomaly detection (outlier values, formula errors)
  // Generate natural language summary of each sheet
}
```

---

## 4. AI Intelligence Layer

### 4.1 Model Selection Matrix

| Use Case | Model | Size | Backend |
|---|---|---|---|
| Document Q&A | `Xenova/distilbert-base-uncased-distilled-squad` | 67MB | Transformers.js |
| Summarization | `Xenova/facebook-bart-large-cnn` | 408MB | Transformers.js (progressive) |
| Contract extraction | `Xenova/bert-base-NER` | 108MB | Transformers.js |
| General chat | `Llama-3.2-1B-Instruct-q4f16_1` | ~1.2GB | WebLLM (WebGPU only) |
| SA language detection | `Xenova/xlm-roberta-base` | 278MB | Transformers.js |

### 4.2 Progressive Loading Strategy

```typescript
// src/store/llmStore.ts (new Zustand slice)
interface LLMState {
  status: 'idle' | 'downloading' | 'loading' | 'ready' | 'error';
  progress: number;           // 0-100 download progress
  backend: 'webllm' | 'transformers' | 'fallback';
  modelId: string | null;
  loadModel: (modelId: string) => Promise<void>;
  unloadModel: () => void;
}
```

**UI requirements:**
- First-use modal: "PDFoid will download a ~250MB AI model. It stays on your device forever."
- Progress bar with estimated time
- Cancel button (abort download)
- "Use faster summary" fallback if user cancels

### 4.3 Document Q&A Pipeline

```
User types question
       ↓
Extract PDF text for current page + 2 surrounding pages (context window budget)
       ↓
Chunk text into 512-token segments with 50-token overlap
       ↓
Rank chunks by TF-IDF similarity to question
       ↓
Take top 3 chunks → feed to LLM as context
       ↓
Stream response tokens → render in chat UI
       ↓
Append page reference(s) to response
```

---

## 5. SA-Specific Document Engine

### 5.1 SA ID Parser Full Specification

```typescript
interface SAIdResult {
  valid: boolean;
  reason?: string;
  dob?: Date;
  age?: number;
  gender?: 'M' | 'F';
  citizen?: boolean;         // true=SA citizen, false=permanent resident
  votingEligible?: boolean;  // age >= 18 and citizen
}

// Luhn algorithm for check digit validation
function luhnCheck(id: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = id.length - 1; i >= 0; i--) {
    let n = parseInt(id[i]);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}
```

### 5.2 SARS Tax Document Templates

Implement as client-side PDF generation using `pdf-lib`:

```typescript
// src/utils/sarsTemplates.ts
export async function generateIrp5(data: IRP5Data): Promise<Uint8Array> {
  // Use pdf-lib to programmatically fill the IRP5 form template
  // Template stored as base64-encoded empty IRP5 PDF in public/templates/
  const templateBytes = await fetch('/templates/irp5_blank.pdf').then(r => r.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  
  form.getTextField('employee_name').setText(data.employeeName);
  form.getTextField('sa_id').setText(data.saIdNumber);
  form.getTextField('income_code_3601').setText(data.basicSalary.toFixed(2));
  // ... all IRP5 fields
  
  return await pdfDoc.save();
}
```

### 5.3 Municipal Account Parser

Detect account format from header, extract:
- Account number, property description, meter readings
- Breakdown: electricity, water, sewage, refuse, rates
- Due date, arrears, payment methods

---

## 6. CV Engine v2

### 6.1 LinkedIn Import

LinkedIn allows exporting your profile as JSON. Parse this format:

```typescript
// src/utils/linkedinImporter.ts
export function parseLinkedInExport(jsonData: LinkedInExport): CVData {
  return {
    name: jsonData.profile.firstName + ' ' + jsonData.profile.lastName,
    headline: jsonData.profile.headline,
    summary: jsonData.profile.summary,
    workHistory: jsonData.positions.values.map(p => ({
      company: p.company.name,
      title: p.title,
      startDate: p.startDate,
      endDate: p.endDate,
      description: p.description,
    })),
    education: jsonData.educations.values.map(e => ({
      institution: e.schoolName,
      degree: e.degree,
      field: e.fieldOfStudy,
      endDate: e.endDate,
    })),
    skills: jsonData.skills.values.map(s => s.skill.name),
  };
}
```

### 6.2 SA Job Market Keyword Optimizer

Map job titles to high-value keywords for the SA market:

```typescript
const SA_JOB_KEYWORDS: Record<string, string[]> = {
  'software developer': ['agile', 'scrum', 'CI/CD', 'cloud', 'REST API', 'microservices', 'Docker'],
  'data scientist': ['Python', 'R', 'ML', 'TensorFlow', 'Pandas', 'SQL', 'Power BI'],
  'accountant': ['IFRS', 'SARS', 'VAT', 'PAYE', 'Sage', 'Pastel', 'GAAP', 'AFS'],
  'project manager': ['PMP', 'Prince2', 'agile', 'PMBOK', 'risk management', 'stakeholder'],
  // ... all major SA job categories
};
```

---

## 7. Enterprise Features

### 7.1 POPIA Auto-Redaction

Integrate ComplianceKit's PII scanner as a PDFoid plugin:

```typescript
// src/plugins/popiaRedaction.ts
export async function scanAndRedactPii(
  pdfText: string,
  pdfDoc: PDFDocument,
  options: RedactionOptions = {}
): Promise<RedactionResult> {
  // 1. Run PII scanner (same patterns as ComplianceKit)
  const findings = await scanForPii(pdfText);
  
  // 2. For each finding, calculate bounding box on PDF page
  const redactions = await mapFindingsToBoundingBoxes(findings, pdfDoc);
  
  // 3. Apply black rectangle redaction boxes
  for (const r of redactions) {
    const page = pdfDoc.getPage(r.pageIndex);
    page.drawRectangle({
      x: r.x, y: r.y,
      width: r.width, height: r.height,
      color: rgb(0, 0, 0),
    });
  }
  
  return { redacted: redactions.length, findings };
}
```

### 7.2 Batch Processing (Electron Packaging)

```typescript
// src/electron/batchProcessor.ts
export async function processBatch(
  inputDir: string,
  outputDir: string,
  operation: BatchOperation
): Promise<BatchResult> {
  const files = await fs.promises.readdir(inputDir);
  const results: OperationResult[] = [];
  
  for (const file of files.filter(f => f.endsWith('.pdf'))) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file);
    try {
      const result = await applyOperation(inputPath, outputPath, operation);
      results.push({ file, success: true, result });
    } catch (err) {
      results.push({ file, success: false, error: String(err) });
    }
  }
  
  return { processed: results.length, succeeded: results.filter(r => r.success).length, results };
}
```

---

## 8. Technical Stack Decisions

| Concern | Current | PRO Decision | Rationale |
|---|---|---|---|
| LLM inference | None | Transformers.js + WebLLM | 100% client-side, privacy maintained |
| OCR | None | Tesseract.js v6 | WebAssembly, no network required |
| DOCX | None | mammoth.js | Battle-tested, clean HTML output |
| Spreadsheet | None | SheetJS (xlsx) | Industry standard, 100% client-side |
| State management | Zustand | Zustand + Immer | Immer for complex LLM state mutations |
| PDF generation | pdf-lib | pdf-lib (keep) | Already present, solid API |
| Routing | None (SPA) | React Router v7 | Needed once multiple views added |
| IndexedDB | None | Dexie.js | For model caching and batch state |

---

## 9. Performance Targets

| Metric | Current | PRO Target |
|---|---|---|
| Initial load (first visit) | < 3s | < 2s (code split LLM) |
| PDF render (10-page doc) | < 500ms | < 300ms |
| AI summarization (5 pages) | ~200ms (graph algo) | < 3s (LLM, progressive) |
| Model download (first use) | N/A | Show progress bar, cache permanently |
| Batch process (100 PDFs) | N/A | Parallel workers, 10-at-a-time |
| Memory (large PDF, 200 pages) | Monitor | < 500MB, page-virtualization |

### Bundle Strategy

```typescript
// vite.config.ts — add manual chunks
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'pdfjs': ['pdfjs-dist'],
        'llm-core': ['@xenova/transformers'],  // lazy-loaded only
        'cv-engine': ['./src/utils/cvPdfGenerator'],
        'sa-docs': ['./src/utils/saDocuments'],
      }
    }
  }
}
```

---

## 10. Security Scan Findings

### 🔴 CRITICAL

**[PDFoid-SEC-001] File type validation bypass in PDFUploader**  
`src/components/PDFUploader.tsx`  
- **Issue:** File type validation relies only on MIME type from `File.type` which is set by the browser using the file extension — trivially spoofable. A `.pdf` renamed from `.exe` will pass.  
- **Fix:** Read the first 4 bytes of the file and verify PDF magic number `%PDF` (hex `25 50 44 46`).
```typescript
async function verifyPdfMagicBytes(file: File): Promise<boolean> {
  const header = await file.slice(0, 4).arrayBuffer();
  const bytes = new Uint8Array(header);
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}
```

**[PDFoid-SEC-002] No size limit on uploaded files**  
`src/components/PDFUploader.tsx`  
- **Issue:** No maximum file size check before loading into memory. A 2GB PDF will OOM-crash the browser tab, potentially causing data loss.  
- **Fix:** Add explicit size gate before processing.
```typescript
const MAX_PDF_SIZE_MB = 200;
if (file.size > MAX_PDF_SIZE_MB * 1024 * 1024) {
  throw new Error(`File too large. Maximum size is ${MAX_PDF_SIZE_MB}MB.`);
}
```

### 🟡 HIGH

**[PDFoid-SEC-003] Unsafe use of text content in annotation rendering**  
`src/components/AnnotationCanvas.tsx`  
- **Issue:** Annotation text content may be rendered via canvas `fillText()` without sanitization. While canvas doesn't execute HTML, stored annotation data in `annotationStore` is serialized to JSON and could contain malicious content if annotations are imported from untrusted sources.  
- **Fix:** Sanitize annotation text on import/load with DOMPurify (text-only mode).

**[PDFoid-SEC-004] CV extraction confidence bypass**  
`src/utils/cvExtractor.ts` — `MIN_CV_PARSE_CONFIDENCE`  
- **Issue:** If `MIN_CV_PARSE_CONFIDENCE` threshold allows low-confidence parses through, the CV generator may populate professional fields with garbage OCR output displayed as if authoritative.  
- **Fix:** Enforce threshold at both extraction AND display layer. Show "low confidence" badge on auto-filled fields.

**[PDFoid-SEC-005] No Content Security Policy defined**  
`index.html` / Vite config  
- **Issue:** No CSP header/meta tag. If XSS is introduced, there is no secondary defence layer.  
- **Fix:** Add to `vite.config.ts`:
```typescript
headers: {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; worker-src 'self' blob:",
}
```

### 🟢 MEDIUM

**[PDFoid-SEC-006] localStorage used without encryption for annotation data**  
`src/store/annotationStore.ts`  
- **Issue:** Annotations are persisted in localStorage in plaintext. If annotations contain sensitive PII discovered during document review, they are accessible to any script running on the same origin.  
- **Fix:** Encrypt localStorage values with a session-derived key using the Web Crypto API.

**[PDFoid-SEC-007] No rate limiting on AI inference calls**  
`src/utils/ai.ts`  
- **Issue:** No debounce or throttle on `summarizeText` / `semanticAnswer` calls. A misbehaving component could trigger hundreds of inference calls in rapid succession, freezing the UI.  
- **Fix:** Wrap LLM calls with a mutex/semaphore pattern and add a 500ms debounce.

---

## 11. Claude Security Remediation Plan

### Immediate (before PRO launch)

```
Priority | File | Action
---------|------|-------
CRITICAL | PDFUploader.tsx | Add magic byte validation + size limit
HIGH     | index.html | Add Content Security Policy meta tag
HIGH     | annotationStore.ts | Encrypt localStorage with Web Crypto API
```

### Short-term (within Sprint 1)

```
Priority | File | Action
---------|------|-------
HIGH     | cvExtractor.ts | Enforce confidence threshold at display layer
MEDIUM   | ai.ts | Add inference call debounce + mutex
MEDIUM   | annotationStore.ts | Add input sanitization on import
```

### Before Enterprise Features

```
Priority | Concern | Action
---------|---------|-------
HIGH | Batch processor | Validate all input paths are within allowed directory (path traversal)
HIGH | POPIA redactor | Ensure redaction is burn-in (not just visual layer) before export
MEDIUM | LLM model cache | Verify IndexedDB entry integrity before loading (tampered weights = arbitrary code)
```

---

## Pricing Model (Open-Core)

| Tier | Features | Price |
|---|---|---|
| **Free (Open-Source)** | Core editor, annotations, CV generator (4 templates), basic summarization | Free forever |
| **Pro** | AI Q&A, 20+ CV templates, SA doc engine, ATS checker, multi-format, DOCX | R2,500/month |
| **Enterprise** | Batch processing, POPIA redaction, custom LLM, team collaboration, headless API | R12,000+/month |
