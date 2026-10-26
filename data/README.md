# ReqInsight AI — Datasets Documentation

This directory manages training, benchmark, and evaluation datasets for Software Requirements Specification (SRS) analysis.

---

## 1. PROMISE_exp (training and benchmark data)

`sample/promise_exp.csv` holds the PROMISE_exp dataset: **969 requirements from 47 software projects**, each labelled by the dataset authors as Functional (444) or one of 11 Non-Functional categories (525). It is the expanded version of the tera-PROMISE NFR dataset that most requirements-classification research reports on.

> Lima, M., Valle, V., Costa, E., Lira, F., Gadelha, B. (2019). Software Engineering Repositories: Expanding the PROMISE Database. *Proceedings of the XXXIII Brazilian Symposium on Software Engineering (SBES 2019)*.

Source file: `PROMISE_exp.csv` as published in [AleksandarMitrevski/se-requirements-classification](https://github.com/AleksandarMitrevski/se-requirements-classification). Only whitespace was normalised.

| Column | Meaning |
| :--- | :--- |
| `Id` | Row number, 1–969 |
| `ProjectID` | Source project, 1–47 (used for leave-one-project-out testing) |
| `RequirementText` | The requirement |
| `Class` | `Functional` or `Non-Functional` |
| `SubClass` | NFR category: Security, Usability, Operational, Performance, Look & Feel, Availability, Maintainability, Scalability, Fault Tolerance, Legal, Portability |
| `OriginalLabel` | The dataset's original code (F, SE, US, O, PE, LF, A, MN, SC, FT, L, PO) |

It is used in two places:
- **Training**: the classifier in `backend/app/ml/classification_service.py` is trained on all 969 rows at start-up.
- **Benchmark**: `python scripts/benchmark.py` runs cross-validation and leave-one-project-out tests on it and writes `reports/benchmark/BENCHMARK.md`. The Evaluation page shows the same measurements.

---

## 2. Directory Structure

```text
data/
└── sample/
    ├── promise_exp.csv            <-- 969 labelled requirements (training + benchmark)
    ├── evaluation_benchmark.json  <-- small hand-written ambiguity and duplicate sanity sets
    ├── demo_srs.txt               <-- Intentionally problematic SRS with all smell types
    ├── demo_srs.docx              <-- Microsoft Word format sample
    └── demo_srs.pdf               <-- PDF format sample
```

---

## 3. Other datasets (not included)

| Dataset | Domain | Citation | Possible use |
| :--- | :--- | :--- | :--- |
| **PURE** | 79 public SRS documents | Ferrari et al., IEEE RE 2017 | Requirement extraction from full documents |
| **Requirements Smells** | ISO 29148 smells | Femmer et al., JSS 2017 | Ambiguity detection (no public labelled set of comparable size) |
| **CrowdRE** | User feedback and feature requests | Groen et al., IEEE Software 2017 | User story extraction |

---

## 4. Built-in Academic Demo Data

ReqInsight AI includes a verified synthetic sample in `data/sample/demo_srs.txt` featuring:
- Intentional ambiguities (REQ-002: "The system should be very fast")
- Near duplicates (REQ-004 & REQ-005: password reset)
- Contradictory constraints (REQ-012: minimum 8 chars vs REQ-013: maximum 6 chars)
- High-quality measurable NFRs (REQ-003, REQ-009, REQ-014)
- Underspecified requirements (REQ-006: "The system shall generate reports")

This guarantees immediate testability during professor demonstrations without requiring large external network downloads.
