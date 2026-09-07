import re

LOWERCASE_WORDS = {"for", "to", "of", "and", "the", "a", "an", "in", "on", "at", "by", "with"}

TAG_PATTERN = re.compile(r"\s*\[(EXPENSE|REFUND|MOMO|MACHINE INCOME)\]\s*", re.IGNORECASE)


def smart_capitalize(text: str) -> str:
    if not text:
        return text

    words = text.strip().split()
    result = []

    for i, word in enumerate(words):
        if any(c.isupper() for c in word):
            result.append(word)
            continue

        lower_word = word.lower()

        if i > 0 and lower_word in LOWERCASE_WORDS:
            result.append(lower_word)
        else:
            result.append(lower_word[:1].upper() + lower_word[1:])

    return " ".join(result)


def strip_tags(text: str) -> str:
    """Remove any existing [EXPENSE]/[REFUND]/[MOMO]/[MACHINE INCOME] tags before re-tagging."""
    if not text:
        return text
    cleaned = TAG_PATTERN.sub(" ", text)
    return cleaned.strip()