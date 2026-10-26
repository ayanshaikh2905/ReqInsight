"""ReqInsight benchmark on PROMISE_exp (969 expert-labelled requirements, 47 projects).

Run from the repository root:

    python scripts/benchmark.py

What it measures:
  1. Functional vs Non-Functional classification: 10-fold cross-validation,
     leave-one-project-out, majority baseline, with and without attribute rules.
  2. Non-Functional category (11 classes): 5-fold cross-validation.
  3. Model comparison: the deployed model against standard alternatives, all under
     the same two protocols.
  4. Scalability: the full 16-stage analysis pipeline on 100 to 969 requirements.

Results are written to reports/benchmark/results.json and reports/benchmark/BENCHMARK.md.
"""
import argparse
import json
import platform
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sklearn.feature_extraction.text import TfidfVectorizer  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.metrics import accuracy_score, f1_score  # noqa: E402
from sklearn.model_selection import GroupKFold, StratifiedGroupKFold, cross_val_predict  # noqa: E402
from sklearn.naive_bayes import ComplementNB  # noqa: E402
from sklearn.pipeline import make_pipeline  # noqa: E402
from sklearn.svm import LinearSVC  # noqa: E402

from backend.app.ml.classification_service import ClassificationService, normalize_for_grouping  # noqa: E402
from backend.app.services.evaluation_service import (  # noqa: E402
    CV_FOLDS,
    RANDOM_STATE,
    evaluate_nfr_category,
    evaluate_type_classification,
)

OUT_DIR = ROOT / "reports" / "benchmark"


def compare_models(records):
    """Every candidate under the same splits. The deployed model is the first row."""
    texts = np.array([r["text"] for r in records])
    labels = np.array([r["label"] for r in records])
    dup_groups = [normalize_for_grouping(t) for t in texts]
    projects = [r["project"] for r in records]
    word12 = lambda: TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, strip_accents="unicode")  # noqa: E731
    word13 = lambda: TfidfVectorizer(ngram_range=(1, 3), sublinear_tf=True, strip_accents="unicode")  # noqa: E731
    candidates = {
        "TF-IDF 1-2 + Complement NB (deployed, no rules)": ClassificationService.build_model,
        "TF-IDF 1-3 + Logistic Regression (previous model)": lambda: make_pipeline(
            word13(), LogisticRegression(C=2.5, max_iter=1000, class_weight="balanced")),
        "TF-IDF 1-2 + Logistic Regression": lambda: make_pipeline(
            word12(), LogisticRegression(C=10, max_iter=1000, class_weight="balanced")),
        "TF-IDF 1-2 + Linear SVM": lambda: make_pipeline(word12(), LinearSVC(C=1, class_weight="balanced")),
    }
    cv = StratifiedGroupKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    lopo = GroupKFold(n_splits=len(set(projects)))
    rows = []
    for name, factory in candidates.items():
        p_cv = cross_val_predict(factory(), texts, labels, cv=cv, groups=dup_groups)
        p_lopo = cross_val_predict(factory(), texts, labels, cv=lopo, groups=projects)
        rows.append({
            "model": name,
            "cv_accuracy": round(accuracy_score(labels, p_cv), 3),
            "cv_macro_f1": round(f1_score(labels, p_cv, average="macro"), 3),
            "lopo_accuracy": round(accuracy_score(labels, p_lopo), 3),
            "lopo_macro_f1": round(f1_score(labels, p_lopo, average="macro"), 3),
        })
    return rows


def scalability(records, sizes):
    """Times the full analysis pipeline on documents of increasing size."""
    from backend.app.services.pipeline_service import AnalysisPipeline

    pipeline = AnalysisPipeline()
    pipeline.run_pipeline("REQ-001: The system shall allow users to log in.\n"
                          "REQ-002: The system shall respond within 2 seconds.")  # warm-up: load models
    rng = np.random.default_rng(RANDOM_STATE)
    order = rng.permutation(len(records))
    rows = []
    for n in sizes:
        n = min(n, len(records))
        chosen = [records[i] for i in order[:n]]
        text = "\n".join(f"REQ-{i + 1:04d}: {r['text']}" for i, r in enumerate(chosen))
        started = time.perf_counter()
        result = pipeline.run_pipeline(text, document_name=f"PROMISE_exp sample of {n}")
        seconds = time.perf_counter() - started
        found = len(result["requirements"])
        rows.append({
            "requirements": n,
            "extracted": found,
            "seconds": round(seconds, 2),
            "ms_per_requirement": round(1000 * seconds / max(found, 1), 1),
            "duplicate_pairs": len(result.get("duplicates", [])),
            "conflicts": len(result.get("conflicts", [])),
        })
        print(f"  {n:4d} requirements: {seconds:6.2f}s, extracted {found}")
    return rows, pipeline.similarity.embedding_backend


def pct(v):
    return f"{100 * v:.1f}%"


def write_markdown(res):
    c, k = res["classification"], res["nfr_category"]
    cm = c["confusion_matrix"]
    lines = [
        "# ReqInsight benchmark results",
        "",
        f"Generated {res['generated_at']} on {res['environment']['platform']}, Python {res['environment']['python']}.",
        "Regenerate with `python scripts/benchmark.py`.",
        "",
        "## Dataset",
        "",
        f"PROMISE_exp: {c['sample_size']} requirements from {c['n_projects']} software projects, labelled by the "
        "dataset authors as Functional or one of 11 Non-Functional categories.",
        "",
        "> Lima, M., Valle, V., Costa, E., Lira, F., Gadelha, B. (2019). Software Engineering Repositories: "
        "Expanding the PROMISE Database. *Proceedings of SBES 2019*.",
        "",
        "## 1. Functional vs Non-Functional",
        "",
        "| Test | Accuracy | Macro F1 |",
        "|---|---:|---:|",
        f"| Majority-class baseline ({c['baseline']['description']}) | {pct(c['baseline']['accuracy'])} | n/a |",
        f"| Leave-one-project-out ({c['n_projects']} projects) | {pct(c['cross_project']['accuracy'])} | {pct(c['cross_project']['f1_score'])} |",
        f"| {CV_FOLDS}-fold cross-validation | **{pct(c['accuracy'])}** ± {pct(c['accuracy_std'])} | **{pct(c['f1_score'])}** |",
        f"| {CV_FOLDS}-fold cross-validation, model without rules | {pct(c['model_only']['accuracy'])} | {pct(c['model_only']['f1_score'])} |",
        "",
        f"Attribute rules decided {c['rules']['requirements_decided']} requirements and were correct on "
        f"{pct(c['rules']['accuracy'])} of them.",
        "",
        "Confusion matrix (cross-validation, rows are the true label):",
        "",
        "| | " + " | ".join(f"Predicted {l}" for l in cm["labels"]) + " |",
        "|---|" + "---:|" * len(cm["labels"]),
    ]
    for label, row in zip(cm["labels"], cm["matrix"]):
        lines.append(f"| **{label}** | " + " | ".join(str(v) for v in row) + " |")
    lines += ["", "| Class | Precision | Recall | F1 | Support |", "|---|---:|---:|---:|---:|"]
    for name, m in c["per_class"].items():
        lines.append(f"| {name} | {pct(m['precision'])} | {pct(m['recall'])} | {pct(m['f1_score'])} | {m['support']} |")

    lines += [
        "",
        "## 2. Non-Functional category (11 classes)",
        "",
        f"{k['protocol']} on the {k['sample_size']} Non-Functional requirements: accuracy **{pct(k['accuracy'])}**, "
        f"macro F1 {pct(k['f1_score'])}, weighted F1 {pct(k['f1_weighted'])}. "
        f"Baseline ({k['baseline']['description']}): {pct(k['baseline']['accuracy'])}.",
        "",
        "| Category | Precision | Recall | F1 | Support |",
        "|---|---:|---:|---:|---:|",
    ]
    for name, m in sorted(k["per_class"].items(), key=lambda kv: -kv[1]["support"]):
        lines.append(f"| {name} | {pct(m['precision'])} | {pct(m['recall'])} | {pct(m['f1_score'])} | {m['support']} |")

    lines += [
        "",
        "## 3. Model comparison",
        "",
        "Same splits for every model. Rules are not applied here, so only the text models are compared.",
        "",
        "| Model | CV accuracy | CV macro F1 | Unseen-project accuracy | Unseen-project macro F1 |",
        "|---|---:|---:|---:|---:|",
    ]
    for r in res["model_comparison"]:
        lines.append(f"| {r['model']} | {pct(r['cv_accuracy'])} | {pct(r['cv_macro_f1'])} | "
                     f"{pct(r['lopo_accuracy'])} | {pct(r['lopo_macro_f1'])} |")

    if res.get("scalability"):
        lines += [
            "",
            "## 4. Scalability of the full pipeline",
            "",
            f"All 16 stages on random samples of PROMISE_exp. Embedding backend: `{res['embedding_backend']}`.",
            "",
            "| Requirements | Extracted | Time | Per requirement | Duplicate pairs | Conflicts |",
            "|---:|---:|---:|---:|---:|---:|",
        ]
        for r in res["scalability"]:
            lines.append(f"| {r['requirements']} | {r['extracted']} | {r['seconds']} s | {r['ms_per_requirement']} ms | "
                         f"{r['duplicate_pairs']} | {r['conflicts']} |")
        lines += [
            "",
            "This test measures speed and robustness, not detection accuracy. The samples mix requirements from "
            f"{c['n_projects']} unrelated projects, so the conflict count is inflated: two systems with different "
            "response-time or password rules are flagged against each other. Pairwise stages (similarity, "
            "conflicts) grow with the square of the document size, which is why time per requirement rises.",
        ]

    lines += [
        "",
        "## Method notes and limits",
        "",
        "- In every test, a requirement is only ever predicted by a model that was not trained on it. "
        "Identical requirement texts (3 pairs in the dataset) are kept in the same fold.",
        "- Leave-one-project-out is the harder test: the model has never seen any requirement from that project, "
        "so it shows how the classifier behaves on a new SRS.",
        "- The deployed model was chosen by comparing the candidates in section 3 on this same data, so the "
        "cross-validation figure is slightly optimistic. The unseen-project figure is the safer number to quote.",
        "- The attribute rules were audited on this dataset; rules that were wrong more often than right were removed.",
        "- Ambiguity and duplicate detection are not part of this benchmark: there is no public labelled dataset "
        "of that size. The app reports them on small hand-written sanity sets.",
        "",
    ]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sizes", default="100,250,500,969", help="Pipeline sizes to time (comma separated)")
    parser.add_argument("--skip-scale", action="store_true", help="Skip the pipeline scalability test")
    args = parser.parse_args()

    records = ClassificationService.load_records()
    if not records:
        sys.exit(f"Dataset not found: {ClassificationService.DATASET_PATH}")
    print(f"PROMISE_exp: {len(records)} requirements")

    t = time.perf_counter()
    print("1/4 Functional vs Non-Functional ...")
    classification = evaluate_type_classification(records)
    print("2/4 Non-Functional category ...")
    nfr_category = evaluate_nfr_category(records)
    print("3/4 Model comparison ...")
    comparison = compare_models(records)

    result = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "environment": {"platform": platform.platform(), "python": platform.python_version()},
        "classification": classification,
        "nfr_category": nfr_category,
        "model_comparison": comparison,
    }
    if not args.skip_scale:
        print("4/4 Pipeline scalability ...")
        sizes = [int(s) for s in args.sizes.split(",") if s.strip()]
        result["scalability"], result["embedding_backend"] = scalability(records, sizes)
    result["benchmark_seconds"] = round(time.perf_counter() - t, 1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    (OUT_DIR / "BENCHMARK.md").write_text(write_markdown(result), encoding="utf-8")

    c = classification
    print()
    print(f"F vs NFR, {CV_FOLDS}-fold CV : {pct(c['accuracy'])} accuracy (± {pct(c['accuracy_std'])}), macro F1 {pct(c['f1_score'])}")
    print(f"F vs NFR, unseen projects: {pct(c['cross_project']['accuracy'])} accuracy")
    print(f"Majority baseline        : {pct(c['baseline']['accuracy'])}")
    print(f"NFR category (11 classes): {pct(nfr_category['accuracy'])} accuracy")
    print(f"Wrote {OUT_DIR / 'BENCHMARK.md'}")


if __name__ == "__main__":
    main()
