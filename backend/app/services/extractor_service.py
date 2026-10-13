import re
from typing import List, Dict, Any, Optional
from backend.app.services.preprocessing_service import PreprocessingService


class ExtractorService:
    """
    Intelligent Requirement Extraction Service.
    Detects requirement sentences from raw SRS text using:
      1. Explicit IDs (e.g., REQ-001, FR-02, NFR-10, Requirement 3.1)
      2. Modal verb constructions (shall, must, should, will, is required to, needs to)
      3. Action-oriented structural indicators (allows, provides, verifies, prevents, stores)
      4. Section context tracking (e.g. Functional Requirements, Security, Performance)
    """

    # Modal patterns and action keywords
    MODAL_PATTERN = re.compile(
        r"\b(shall|must|should|will|is required to|are required to|needs to|need to|ought to|can)\b",
        re.IGNORECASE,
    )
    
    ACTION_PATTERN = re.compile(
        r"\b(allows?|enables?|provides?|generates?|stores?|processes?|transmits?|verifies?|authenticates?|displays?|notifies?|calculates?|logs?|restricts?|encrypts?|supports?)\b",
        re.IGNORECASE,
    )

    # Explicit Requirement ID patterns
    ID_PREFIX_PATTERN = re.compile(
        r"^\s*\[?((?:REQ|FR|NFR|SR|BR|UR|SRS)[-_ ]*\d{1,4}[a-z]?)\]?[:\.\-]?\s*"
    )

    LIST_MARKER_PATTERN = re.compile(r"^\s*(?:\d+[\.)]|[-*\u2022])\s+")

    # Numbered pattern: e.g. "3.2.1 The system shall..."
    NUMBERED_PATTERN = re.compile(
        r"^\s*(\d+(?:\.\d+){1,4})[\.\)\s\-]+(?=[A-Z])"
    )

    # Section header detector
    SECTION_HEADER_PATTERN = re.compile(
        r"^(?:\d+(?:\.\d+)*\s+)?(Functional\s+Requirements?|Non[- ]Functional\s+Requirements?|System\s+Features?|Security\s+Requirements?|Performance\s+Requirements?|User\s+Interface\s+Requirements?|Interface\s+Requirements?|Operational\s+Requirements?|General\s+Requirements?|Data\s+Requirements?|Scope|Overview|Specifications?)\b",
        re.IGNORECASE,
    )

    def extract_requirements(self, raw_text: str) -> List[Dict[str, Any]]:
        """
        Parses full document text and extracts candidate requirements.
        Returns a list of structured requirement dictionaries.
        """
        raw_text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
        lines = raw_text.split("\n")
        
        extracted: List[Dict[str, Any]] = []
        current_section = "General Requirements"
        req_counter = 1

        # We first group lines into potential paragraphs or structured items
        paragraphs: List[Dict[str, Any]] = []
        buf: List[str] = []
        buf_start_line = 1

        for line_idx, line in enumerate(lines, start=1):
            stripped = line.strip()
            if not stripped:
                if buf:
                    paragraphs.append({
                        "text": " ".join(buf),
                        "line": buf_start_line,
                    })
                    buf = []
                continue

            # Check if this line looks like a Section Header
            sec_match = self.SECTION_HEADER_PATTERN.match(stripped)
            if sec_match and len(stripped.split()) <= 7:
                if buf:
                    paragraphs.append({
                        "text": " ".join(buf),
                        "line": buf_start_line,
                    })
                    buf = []
                current_section = stripped.strip("#* -:")
                continue

            # A list item is a separate candidate even when the previous line has no blank separator.
            if self.LIST_MARKER_PATTERN.match(stripped):
                if buf:
                    paragraphs.append({
                        "text": " ".join(buf),
                        "line": buf_start_line,
                    })
                    buf = []
                buf_start_line = line_idx
                buf.append(stripped)
                continue

            # Check if this line starts a new explicit requirement ID
            if self.ID_PREFIX_PATTERN.match(stripped):
                if buf:
                    paragraphs.append({
                        "text": " ".join(buf),
                        "line": buf_start_line,
                    })
                    buf = []
                buf.append(stripped)
                buf_start_line = line_idx
                continue

            if not buf:
                buf_start_line = line_idx
            buf.append(stripped)

        if buf:
            paragraphs.append({
                "text": " ".join(buf),
                "line": buf_start_line,
            })

        # Now inspect each paragraph or sentence
        for p in paragraphs:
            p_text = p["text"]
            p_line = p["line"]

            # Check if the whole block starts with an explicit ID
            id_match = self.ID_PREFIX_PATTERN.match(p_text)
            num_match = self.NUMBERED_PATTERN.match(p_text)

            if id_match:
                matched_id_raw = id_match.group(0).strip(" :.-[]\t")
                req_text = p_text[id_match.end():].strip()
                cleaned_req = PreprocessingService.clean_requirement_text(req_text)
                
                # Format a canonical ID if needed, e.g. REQ-001
                canon_id = self._canonicalize_id(matched_id_raw, req_counter)
                
                if len(cleaned_req) >= 10:
                    extracted.append({
                        "id": canon_id,
                        "text": cleaned_req,
                        "original_text": p_text,
                        "section": current_section,
                        "line_number": p_line,
                    })
                    req_counter += 1
                continue

            elif num_match and self.is_requirement_candidate(p_text):
                matched_num = num_match.group(1).strip()
                req_text = p_text[num_match.end():].strip()
                cleaned_req = PreprocessingService.clean_requirement_text(req_text)
                canon_id = f"REQ-{req_counter:03d}"
                if len(cleaned_req) >= 10:
                    extracted.append({
                        "id": canon_id,
                        "text": cleaned_req,
                        "original_text": p_text,
                        "section": f"{current_section} ({matched_num})",
                        "line_number": p_line,
                    })
                    req_counter += 1
                continue

            # Otherwise, split into sentences and check candidate requirement structure
            sentences = PreprocessingService.split_sentences(p_text)
            for s in sentences:
                if self.is_requirement_candidate(s):
                    cleaned_s = PreprocessingService.clean_requirement_text(s)
                    if len(cleaned_s) >= 12:
                        extracted.append({
                            "id": f"REQ-{req_counter:03d}",
                            "text": cleaned_s,
                            "original_text": s,
                            "section": current_section,
                            "line_number": p_line,
                        })
                        req_counter += 1

        # Fallback: if no requirements were detected (e.g. plain list of sentences),
        # treat all non-trivial lines as candidates
        if not extracted and raw_text.strip():
            for line_idx, line in enumerate(lines, start=1):
                clean_line = PreprocessingService.clean_requirement_text(line)
                if len(clean_line) > 15:
                    extracted.append({
                        "id": f"REQ-{req_counter:03d}",
                        "text": clean_line,
                        "original_text": line.strip(),
                        "section": current_section,
                        "line_number": line_idx,
                    })
                    req_counter += 1

        return extracted

    def is_requirement_candidate(self, sentence: str) -> bool:
        """
        Determines whether a sentence looks like a requirement statement.
        Considers modal verbs, action verbs, and system actors.
        """
        lower = sentence.lower()
        
        # Explicit modal verb?
        if self.MODAL_PATTERN.search(lower):
            return True
            
        # Common requirement actor + action pattern
        actor_indicators = ["the system", "the software", "the user", "users", "the administrator", 
                            "the client", "the application", "the platform", "the service", "the api"]
        has_actor = any(a in lower for a in actor_indicators)
        has_action = bool(self.ACTION_PATTERN.search(lower))
        
        if has_actor and has_action:
            return True

        # Imperative or security constraints
        if any(term in lower for term in ["passwords must", "response time", "availability shall", 
                                          "throughput must", "encrypted using", "authenticated via"]):
            return True

        return False

    def _canonicalize_id(self, raw_id: str, index: int) -> str:
        """Formats or standardizes requirement ID."""
        cleaned = re.sub(r"[^A-Za-z0-9]", "-", raw_id).strip("-").upper()
        if re.match(r"^[A-Z]+-\d+$", cleaned):
            return cleaned
        if re.match(r"^\d+(\.\d+)*$", cleaned):
            return f"REQ-{cleaned.replace('.', '-')}"
        if cleaned.startswith("REQ") or cleaned.startswith("FR") or cleaned.startswith("NFR"):
            return cleaned
        return f"REQ-{index:03d}"
