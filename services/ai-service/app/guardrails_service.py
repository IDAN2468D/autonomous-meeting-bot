import re
from dataclasses import dataclass

_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+instructions", re.IGNORECASE),
    re.compile(r"reveal\s+(your\s+)?system\s+prompt", re.IGNORECASE),
    re.compile(r"override\s+(system|safety)\s+rules", re.IGNORECASE),
    re.compile(r"התעלם\s+מכל\s+ההוראות\s+הקודמות"),
    re.compile(r"חשוף\s+את\s+הפרומפט\s+של\s+המערכת"),
]

_SECRET_PATTERNS = [
    (re.compile(r"\b(?:sk|AIza)[A-Za-z0-9_\-]{16,}\b"), "[REDACTED_KEY]"),
    (re.compile(r"\b(?:\d[ -]*?){13,16}\b"), "[REDACTED_CARD]"),
]


@dataclass
class GuardrailResult:
    allowed: bool
    sanitized_text: str
    triggered: bool = False
    reason: str | None = None


class GuardrailsService:
    def check_input(self, text: str, language: str = "he") -> GuardrailResult:
        cleaned = text.strip()
        if not cleaned:
            return GuardrailResult(allowed=False, sanitized_text="", reason="Empty input")

        for pattern in _INJECTION_PATTERNS:
            if pattern.search(cleaned):
                refusal = (
                    "איני יכול לשנות את הגדרות המערכת או לחשוף הנחיות פנימיות, אך אשמח להמשיך בנושאי הפגישה."
                    if language == "he"
                    else "I cannot override my system instructions or reveal internal prompts, but I'm happy to continue with our meeting agenda."
                )
                return GuardrailResult(
                    allowed=False,
                    sanitized_text=refusal,
                    triggered=True,
                    reason="Prompt injection blocked",
                )

        triggered = False
        for pattern, replacement in _SECRET_PATTERNS:
            new_text = pattern.sub(replacement, cleaned)
            if new_text != cleaned:
                triggered = True
                cleaned = new_text

        return GuardrailResult(
            allowed=True,
            sanitized_text=cleaned,
            triggered=triggered,
            reason="Sensitive data redacted" if triggered else None,
        )

    def sanitize_output(self, text: str, max_chars: int = 420) -> GuardrailResult:
        cleaned = text.strip()
        triggered = False

        cleaned = re.sub(r"```[\s\S]*?```", "", cleaned)
        cleaned = re.sub(r"[*_`#>-]+", " ", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()

        for pattern, replacement in _SECRET_PATTERNS:
            new_text = pattern.sub(replacement, cleaned)
            if new_text != cleaned:
                triggered = True
                cleaned = new_text

        if len(cleaned) > max_chars:
            cleaned = cleaned[:max_chars].rsplit(" ", 1)[0].rstrip(".,;:") + "."
            triggered = True

        return GuardrailResult(
            allowed=True,
            sanitized_text=cleaned,
            triggered=triggered,
            reason="Output sanitized for spoken delivery" if triggered else None,
        )


guardrails_service = GuardrailsService()
