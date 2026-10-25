import re
from typing import Iterable, List, Dict, Any, Optional
import spacy


class NERService:
    """
    Named Entity Recognition for Software Requirement Specifications.
    Combines spaCy linguistic parsing (en_core_web_sm) with
    requirement-specific entity patterns:
      - ACTOR: Primary persona / stakeholder
      - SYSTEM: Architectural component / subsystem
      - TECHNOLOGY: Protocol, framework, library, standard
      - DATA: Data model entity / payload
      - ACTION: Core functional operation
      - OBJECT: Target entity of the action
    """

    KNOWN_ACTORS = {
        "user", "users", "registered user", "registered users", "administrator", "admin",
        "customer", "customers", "client", "clients", "operator", "operators", "cashier",
        "patient", "patients", "doctor", "doctors", "guest", "manager", "auditor"
    }

    KNOWN_SYSTEMS = {
        "system", "the system", "software", "application", "platform", "portal",
        "backend", "database", "api", "microservice", "service", "server", "client"
    }

    KNOWN_TECHS = {
        "postgresql", "mysql", "mongodb", "sqlite", "redis", "docker", "kubernetes",
        "oauth", "oauth 2.0", "jwt", "aes", "aes-256", "tls", "tls 1.3", "ssl",
        "rest", "rest api", "graphql", "react", "fastapi", "linux", "windows",
        "http", "https", "wcag", "gdpr", "hipaa", "luhn algorithm"
    }

    KNOWN_DATA = {
        "credentials", "password", "passwords", "username", "email", "token", "jwt",
        "invoice", "receipt", "audit log", "audit logs", "payment", "profile picture",
        "bio", "credit card", "credit card numbers", "barcode", "session"
    }

    def __init__(self):
        self.nlp = None
        self._load_spacy()
        # Pre-compiled once instead of building two regexes per term per requirement.
        self._tech_patterns = [
            (term, re.compile(r"\b" + re.escape(term) + r"\b", re.IGNORECASE))
            for term in sorted(self.KNOWN_TECHS)
        ]
        self._data_patterns = [
            (term, re.compile(r"\b" + re.escape(term) + r"\b", re.IGNORECASE))
            for term in sorted(self.KNOWN_DATA)
        ]

    def _load_spacy(self):
        """Loads spacy model with fallback if missing."""
        try:
            # The lemmatizer output is never read, so skip it.
            self.nlp = spacy.load("en_core_web_sm", disable=["lemmatizer"])
        except Exception:
            try:
                self.nlp = spacy.blank("en")
            except Exception as e:
                print(f"[NERService] Could not load spaCy: {e}")
                self.nlp = None

    def extract_entities_batch(self, texts: List[str], batch_size: int = 64) -> List[List[Dict[str, str]]]:
        """Extracts entities for many requirements, parsing them in spaCy batches."""
        if self.nlp is None:
            return [self._extract(text, None) for text in texts]
        docs: Iterable = self.nlp.pipe(texts, batch_size=batch_size)
        return [self._extract(text, doc) for text, doc in zip(texts, docs)]

    def extract_entities(self, text: str) -> List[Dict[str, str]]:
        """
        Extracts verified requirement entities. Strictly avoids hallucination.
        """
        doc = self.nlp(text) if self.nlp is not None else None
        return self._extract(text, doc)

    def _extract(self, text: str, doc) -> List[Dict[str, str]]:
        entities: List[Dict[str, str]] = []
        seen = set()

        # 1. spaCy Linguistic Parse (Subject, Object, Proper Nouns)
        if doc is not None:

            # Extract spaCy standard NER entities (ORG, PRODUCT, GPE, MONEY, TIME, PERCENT)
            for ent in doc.ents:
                val = ent.text.strip()
                if val.lower() in seen or len(val) < 2:
                    continue
                category = "TECHNOLOGY" if ent.label_ in ["PRODUCT", "ORG"] else "OBJECT"
                if ent.label_ in ["TIME", "PERCENT", "QUANTITY", "CARDINAL"]:
                    category = "CONSTRAINT"
                
                # Check if it matches a known tech
                if val.lower() in self.KNOWN_TECHS:
                    category = "TECHNOLOGY"

                entities.append({
                    "text": val,
                    "category": category,
                    "explanation": f"Linguistic {ent.label_} entity: {val}"
                })
                seen.add(val.lower())

            # Syntactic dependency extraction for Actor and Action
            for token in doc:
                # Find nominal subjects (Actors)
                if token.dep_ in ["nsubj", "nsubjpass"] and token.text.lower() not in seen:
                    tok_text = token.text
                    # Check multi-word phrase (e.g. registered users)
                    compound = " ".join([child.text for child in token.children if child.dep_ in ["compound", "amod"]] + [tok_text])
                    clean_actor = compound.strip()
                    if clean_actor.lower() in self.KNOWN_ACTORS or token.text.lower() in self.KNOWN_ACTORS:
                        entities.append({
                            "text": clean_actor,
                            "category": "ACTOR",
                            "explanation": "Primary initiating stakeholder/persona"
                        })
                        seen.add(clean_actor.lower())
                        seen.add(token.text.lower())
                    elif clean_actor.lower() in self.KNOWN_SYSTEMS or token.text.lower() in self.KNOWN_SYSTEMS:
                        entities.append({
                            "text": clean_actor,
                            "category": "SYSTEM",
                            "explanation": "Software system executing the requirement"
                        })
                        seen.add(clean_actor.lower())

                # Find root or main functional verbs (Actions)
                if token.pos_ == "VERB" and token.dep_ in ["ROOT", "xcomp", "conj"] and token.text.lower() not in ["shall", "must", "should", "will", "is", "be"]:
                    verb_phrase = token.text
                    # Check particle or direct object attached
                    prt = [c.text for c in token.children if c.dep_ == "prt"]
                    if prt:
                        verb_phrase += " " + prt[0]
                    if verb_phrase.lower() not in seen and len(verb_phrase) > 2:
                        entities.append({
                            "text": verb_phrase,
                            "category": "ACTION",
                            "explanation": "Functional operation performed"
                        })
                        seen.add(verb_phrase.lower())

                # Find direct objects
                if token.dep_ in ["dobj", "pobj"] and token.text.lower() not in seen:
                    compound = " ".join([c.text for c in token.children if c.dep_ in ["compound", "amod"]] + [token.text])
                    clean_obj = compound.strip()
                    if len(clean_obj) > 2 and clean_obj.lower() not in seen:
                        cat = "DATA" if clean_obj.lower() in self.KNOWN_DATA else "OBJECT"
                        entities.append({
                            "text": clean_obj,
                            "category": cat,
                            "explanation": f"Target entity of requirement ({cat.lower()})"
                        })
                        seen.add(clean_obj.lower())

        # 2. Direct rule-based scan for known domain technologies and data items
        for tech, pattern in self._tech_patterns:
            if tech in seen:
                continue
            m = pattern.search(text)
            if m:
                original_cased = m.group(0)
                entities.append({
                    "text": original_cased,
                    "category": "TECHNOLOGY",
                    "explanation": "Technical standard, protocol, or software dependency"
                })
                seen.add(tech)

        for data, pattern in self._data_patterns:
            if data in seen:
                continue
            m = pattern.search(text)
            if m:
                original_cased = m.group(0)
                entities.append({
                    "text": original_cased,
                    "category": "DATA",
                    "explanation": "Data artifact or security payload"
                })
                seen.add(data)

        return entities
