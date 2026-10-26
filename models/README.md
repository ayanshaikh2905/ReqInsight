# ReqInsight AI — Model Architecture & Registry

This document describes the NLP and Large Language Model architecture used in the ReqInsight AI pipeline.

---

## 1. Model Registry & Specifications

| Component | Default Architecture | Hugging Face / Source | Operational Role | Fallback Mode |
| :--- | :--- | :--- | :--- | :--- |
| **Requirement Classifier** | TF-IDF (word 1-2 grams) + Complement Naive Bayes | scikit-learn, trained on PROMISE_exp (969 requirements) | Functional vs Non-Functional, plus 11 NFR categories | Audited attribute rules for a few fixed patterns (e.g. response time) |
| **Semantic Similarity & Embeddings** | Sentence-BERT | `sentence-transformers/all-MiniLM-L6-v2` | Dense requirement embeddings, duplicate detection, clustering | High-dimensional subword TF-IDF cosine vectorizer |
| **Ambiguity & Smell Engine** | Hybrid Syntactic & Lexical Classifier | Rule-based + Dependency parser | Identifies vague terms, missing bounds, subjective language | Deterministic pattern scanner |
| **Named Entity Recognition (NER)** | spaCy English Core Model | `en_core_web_sm` + custom rule layers | Extracts ACTOR, SYSTEM, TECH, DATA, ACTION, OBJECT | Rule-based domain pattern matcher |
| **Topic Discovery** | Topic Clustering & c-TF-IDF | BERTopic / Agglomerative Clustering | Unsupervised grouping of requirement domains | Cosine Agglomerative / KMeans clustering |
| **Requirement Rewriter** | FLAN-T5 / LLM / IEEE 830 Engine | `google/flan-t5-base` / OpenAI / Groq / Fallback | Rewrites poor requirements into standard unambiguous format | Deterministic template-guided IEEE 830 engine |
| **User Story & Acceptance Criteria** | LLM / Gherkin Synthesizer | LLM API / Gherkin Rule Generator | Generates Agile User Stories and Given-When-Then scenarios | Deterministic scenario synthesizer |
| **RAG Knowledge Base** | Vector Retriever | Custom IEEE 830 & ISO 29148 guideline index | Retrieves relevant quality rules to augment prompts | Local guideline matcher |

---

## 2. Resource & Laptop Friendly Design

ReqInsight AI is engineered specifically to run smoothly on standard laptops:
1. **Lazy Loading**: Models are imported and initialized on demand.
2. **Deterministic Fallbacks**: If PyTorch models or external internet access is constrained, the system falls back to ultra-fast, zero-download scikit-learn and rule engines.
3. **No Hardcoded API Keys**: External LLMs (OpenAI, Groq, Mistral, Ollama) can be connected optionally via environment variables without breaking offline functionality.
