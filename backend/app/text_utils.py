LOWERCASE_WORDS = {"for", "to", "of", "and", "the", "a", "an", "in", "on", "at", "by", "with"}


def smart_capitalize(text: str) -> str:
    """
    Capitalize the first letter of each significant word.
    Connecting words (for, to, of, and...) stay lowercase.
    Words that already contain a capital letter (H11, GHS, INR) are left as-is.
    The very first word of the sentence is always capitalized.
    """
    if not text:
        return text

    words = text.strip().split()
    result = []

    for i, word in enumerate(words):
        # If the word already has an internal capital (e.g. H11, GHS), leave it untouched
        if any(c.isupper() for c in word):
            result.append(word)
            continue

        lower_word = word.lower()

        if i > 0 and lower_word in LOWERCASE_WORDS:
            result.append(lower_word)
        else:
            result.append(lower_word[:1].upper() + lower_word[1:])

    return " ".join(result)