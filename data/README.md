# ReqInsight AI — Datasets Documentation

This directory manages training, benchmark, and evaluation datasets for Software Requirements Specification (SRS) analysis.

---

## 1. Supported Research Datasets

| Dataset | Research Domain | Original Source / Citation | Intended Task in ReqInsight AI |
| :--- | :--- | :--- | :--- |
| **PROMISE NFR** | Non-Functional vs Functional Requirements | Menzies et al., Tera-PROMISE Repository | Classification of Functional vs NFR quality attributes |
| **PURE** | Public Unified Requirements Engineering Dataset | Ferrari et al., IEEE RE 2017 (79 SRS documents, ~4,000 reqs) | Requirement extraction & section parsing |
| **Requirements Smells** | ISO 29148 Smells & Ambiguity | Femmer et al., IEEE TSE 2017 | Ambiguity, subjective terms, and weak modal detection |
| **CrowdRE** | User-generated feedback and feature requests | Groen et al., IEEE Software 2017 | User story and intent extraction |

---

## 2. Directory Structure

```text
data/
├── raw/                  <-- Place downloaded raw datasets here (.csv, .json, .zip, .xml)
│   ├── promise/
│   ├── pure/
│   └── smells/
├── processed/            <-- Standardized normalized formats (.json, .parquet)
└── sample/               <-- Built-in demo & benchmark sets (works immediately out of the box)
    ├── demo_srs.txt      <-- Intentionally problematic SRS with all smell types
    ├── demo_srs.docx     <-- Microsoft Word format sample
    ├── demo_srs.pdf      <-- PDF format sample
    └── promise_nfr_sample.csv
```

---

## 3. How to Add External Datasets

1. **PROMISE NFR**:
   - Download `nfr.arff` or `nfr.csv` from the PROMISE repository.
   - Place into `data/raw/promise/`.
   - Run the preprocessing script to generate standardized columns `["Id", "RequirementText", "Class", "SubClass"]`.

2. **PURE Dataset**:
   - Download the raw PDF/XML collection of public SRS documents.
   - Place into `data/raw/pure/`.

---

## 4. Built-in Academic Demo Data

ReqInsight AI includes a verified synthetic sample in `data/sample/demo_srs.txt` featuring:
- Intentional ambiguities (REQ-002: "The system should be very fast")
- Near duplicates (REQ-004 & REQ-005: password reset)
- Contradictory constraints (REQ-012: minimum 8 chars vs REQ-013: maximum 6 chars)
- High-quality measurable NFRs (REQ-003, REQ-009, REQ-014)
- Underspecified requirements (REQ-006: "The system shall generate reports")

This guarantees immediate testability during professor demonstrations without requiring large external network downloads.
