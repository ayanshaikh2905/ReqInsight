import os
import json
import requests
from typing import Dict, Any, Optional, List
from backend.app.rag.rag_service import RAGService
from backend.app.ml.rewriting_service import RewritingService
from backend.app.ml.user_story_service import UserStoryService
from backend.app.ml.acceptance_criteria_service import AcceptanceCriteriaService


class LLMService:
    """
    Manages Large Language Model inference with academic safety and validation.
    
    Supports:
      - OpenAI compatible endpoints (OpenAI, Groq, Mistral, Ollama, vLLM)
      - Environment variables (LLM_PROVIDER, LLM_API_KEY, LLM_MODEL, LLM_API_BASE)
      - Deterministic offline fallback pipeline when no API key is set.
      - Rigorous output validation against hallucinations and schema corruption.
    """

    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "fallback").lower()
        self.api_key = os.getenv("LLM_API_KEY", "")
        self.model = os.getenv("LLM_MODEL", "gpt-4o-mini")
        self.api_base = os.getenv("LLM_API_BASE", "")
        self.rag = RAGService()
        self.rewriter = RewritingService()
        self.user_story_gen = UserStoryService()
        self.acceptance_gen = AcceptanceCriteriaService()

    def update_config(self, provider: str, api_key: str, model: str, api_base: str = ""):
        """Updates LLM configuration dynamically at runtime."""
        self.provider = provider.lower()
        self.api_key = api_key
        self.model = model
        self.api_base = api_base

    def is_api_configured(self) -> bool:
        """Returns True if a live API provider is configured with an API key or local server."""
        if self.provider in ["ollama", "local"]:
            return True
        return bool(self.api_key and self.provider not in ["fallback", "none", ""])

    def enhance_requirement(self, original_text: str) -> Dict[str, Any]:
        """
        Orchestrates requirement enhancement:
          1. Retrieves relevant RAG guidelines.
          2. If live API is active, prompts LLM with strict validation.
          3. Otherwise, utilizes deterministic rule-based template generation.
        """
        # Retrieve context from RAG
        rag_context = self.rag.build_augmented_context(original_text)

        if self.is_api_configured():
            try:
                llm_result = self._call_llm_api(original_text, rag_context)
                validated = self.validate_llm_output(original_text, llm_result)
                if validated:
                    return validated
            except Exception as e:
                print(f"[LLMService] Live API invocation failed ({e}). Reverting to fallback mode.")

        # Deterministic academic fallback
        rewritten = self.rewriter.rewrite(original_text)
        story = self.user_story_gen.generate_user_story(original_text)
        criteria = self.acceptance_gen.generate_criteria(original_text)

        return {
            "improved_text": rewritten["improved_text"],
            "user_story": story["user_story"],
            "acceptance_criteria": criteria["acceptance_criteria"],
            "generation_source": "Deterministic IEEE 830 & Gherkin Engine (Offline Mode)",
            "validation_passed": True
        }

    def _call_llm_api(self, requirement: str, rag_context: str) -> Dict[str, Any]:
        """Calls external OpenAI-compatible LLM endpoint."""
        url = self.api_base or "https://api.openai.com/v1/chat/completions"
        if self.provider == "groq":
            url = self.api_base or "https://api.groq.com/openai/v1/chat/completions"
        elif self.provider == "ollama":
            url = self.api_base or "http://localhost:11434/v1/chat/completions"

        prompt = f"""You are an expert Software Requirements Engineer and NLP specialist.
Analyze the following software requirement and return a STRICT JSON response.

REQUIREMENT: "{requirement}"

{rag_context}

RULES:
1. Do NOT invent arbitrary business requirements. If parameters like response latency or capacity are missing, mark them explicitly as '[Information required: specify <parameter>]'.
2. Provide:
   - "improved_text": An IEEE 830 compliant unambiguous statement.
   - "user_story": "As a [role], I want [action], so that [benefit]."
   - "acceptance_criteria": A Given-When-Then Gherkin scenario.
   - "recommendation": Concrete advice to improve testability.

JSON FORMAT:
{{
  "improved_text": "...",
  "user_story": "...",
  "acceptance_criteria": "...",
  "recommendation": "..."
}}
"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}" if self.api_key else ""
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a software engineering requirements analyzer. Output valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"}
        }

        resp = requests.post(url, headers=headers, json=payload, timeout=20)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return json.loads(content)

    def validate_llm_output(self, original_text: str, output: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Validates LLM output:
          - Mandatory keys exist and are non-empty.
          - Semantic overlap check (ensures the generated text still pertains to the requirement).
        """
        required_keys = ["improved_text", "user_story", "acceptance_criteria"]
        if not all(k in output and isinstance(output[k], str) and len(output[k].strip()) > 10 for k in required_keys):
            return None

        # Check semantic word overlap (avoid hallucinated drift)
        orig_words = set(original_text.lower().split()) - {"the", "a", "an", "is", "shall", "should", "must", "to", "of", "and"}
        gen_words = set(output["improved_text"].lower().split())
        overlap = len(orig_words & gen_words)

        if len(orig_words) > 0 and overlap == 0:
            print("[LLMService] Output validation warning: Zero semantic overlap with original text.")
            return None

        output["generation_source"] = f"LLM Inference ({self.provider}: {self.model})"
        output["validation_passed"] = True
        return output
