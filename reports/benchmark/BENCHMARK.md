# ReqInsight benchmark results

Generated 2026-10-26 05:42 UTC on Linux-6.18.44-fc-v153-x86_64-with-glibc2.39, Python 3.13.17.
Regenerate with `python scripts/benchmark.py`.

## Dataset

PROMISE_exp: 969 requirements from 47 software projects, labelled by the dataset authors as Functional or one of 11 Non-Functional categories.

> Lima, M., Valle, V., Costa, E., Lira, F., Gadelha, B. (2019). Software Engineering Repositories: Expanding the PROMISE Database. *Proceedings of SBES 2019*.

## 1. Functional vs Non-Functional

| Test | Accuracy | Macro F1 |
|---|---:|---:|
| Majority-class baseline (Always predict 'Non-Functional') | 54.2% | n/a |
| Leave-one-project-out (47 projects) | 80.4% | 79.8% |
| 10-fold cross-validation | **90.0%** ± 2.8% | **89.9%** |
| 10-fold cross-validation, model without rules | 89.9% | 89.8% |

Attribute rules decided 38 requirements and were correct on 97.4% of them.

Confusion matrix (cross-validation, rows are the true label):

| | Predicted Functional | Predicted Non-Functional |
|---|---:|---:|
| **Functional** | 396 | 48 |
| **Non-Functional** | 49 | 476 |

| Class | Precision | Recall | F1 | Support |
|---|---:|---:|---:|---:|
| Functional | 89.0% | 89.2% | 89.1% | 444 |
| Non-Functional | 90.8% | 90.7% | 90.8% | 525 |

## 2. Non-Functional category (11 classes)

5-fold stratified cross-validation on the 525 Non-Functional requirements: accuracy **72.4%**, macro F1 64.3%, weighted F1 71.4%. Baseline (Always predict 'Security'): 23.8%.

| Category | Precision | Recall | F1 | Support |
|---|---:|---:|---:|---:|
| Security | 80.3% | 91.2% | 85.4% | 125 |
| Usability | 64.6% | 75.3% | 69.6% | 85 |
| Operational | 69.0% | 63.6% | 66.2% | 77 |
| Performance | 69.2% | 80.6% | 74.5% | 67 |
| Look & Feel | 72.1% | 63.3% | 67.4% | 49 |
| Availability | 84.4% | 87.1% | 85.7% | 31 |
| Maintainability | 71.4% | 41.7% | 52.6% | 24 |
| Scalability | 59.1% | 59.1% | 59.1% | 22 |
| Fault Tolerance | 72.7% | 44.4% | 55.2% | 18 |
| Legal | 88.9% | 53.3% | 66.7% | 15 |
| Portability | 50.0% | 16.7% | 25.0% | 12 |

## 3. Model comparison

Same splits for every model. Rules are not applied here, so only the text models are compared.

| Model | CV accuracy | CV macro F1 | Unseen-project accuracy | Unseen-project macro F1 |
|---|---:|---:|---:|---:|
| TF-IDF 1-2 + Complement NB (deployed, no rules) | 89.9% | 89.8% | 80.3% | 79.7% |
| TF-IDF 1-3 + Logistic Regression (previous model) | 89.1% | 88.9% | 75.9% | 74.4% |
| TF-IDF 1-2 + Logistic Regression | 90.2% | 90.1% | 75.9% | 74.5% |
| TF-IDF 1-2 + Linear SVM | 90.1% | 90.0% | 75.2% | 73.8% |

## 4. Scalability of the full pipeline

All 16 stages on random samples of PROMISE_exp. Embedding backend: `tfidf-fallback`.

| Requirements | Extracted | Time | Per requirement | Duplicate pairs | Conflicts |
|---:|---:|---:|---:|---:|---:|
| 100 | 100 | 0.38 s | 3.8 ms | 0 | 3 |
| 250 | 250 | 1.01 s | 4.1 ms | 3 | 43 |
| 500 | 500 | 2.91 s | 5.8 ms | 8 | 228 |
| 969 | 969 | 12.4 s | 12.8 ms | 35 | 930 |

This test measures speed and robustness, not detection accuracy. The samples mix requirements from 47 unrelated projects, so the conflict count is inflated: two systems with different response-time or password rules are flagged against each other. Pairwise stages (similarity, conflicts) grow with the square of the document size, which is why time per requirement rises.

## Method notes and limits

- In every test, a requirement is only ever predicted by a model that was not trained on it. Identical requirement texts (3 pairs in the dataset) are kept in the same fold.
- Leave-one-project-out is the harder test: the model has never seen any requirement from that project, so it shows how the classifier behaves on a new SRS.
- The deployed model was chosen by comparing the candidates in section 3 on this same data, so the cross-validation figure is slightly optimistic. The unseen-project figure is the safer number to quote.
- The attribute rules were audited on this dataset; rules that were wrong more often than right were removed.
- Ambiguity and duplicate detection are not part of this benchmark: there is no public labelled dataset of that size. The app reports them on small hand-written sanity sets.
