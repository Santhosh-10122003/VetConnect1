package com.vetconnect.common;

import java.util.regex.Pattern;

/** What may be typed into any text field: no emoji or pictographic symbols, and no hidden control characters. */
public final class TextRules {

    public static final String MESSAGE = "Emoji and special symbols are not allowed. Use letters, numbers and normal punctuation.";

    // Emoji blocks, dingbats, arrows/box symbols used as pictures, flags, joiners, variation selectors and tag characters.
    private static final Pattern EMOJI = Pattern.compile(
            "[\\x{1F000}-\\x{1FAFF}\\x{2190}-\\x{21FF}\\x{2300}-\\x{23FF}\\x{2460}-\\x{24FF}\\x{25A0}-\\x{27BF}"
                    + "\\x{2900}-\\x{297F}\\x{2B00}-\\x{2BFF}\\x{FE00}-\\x{FE0F}\\x{200D}\\x{20E3}\\x{E0020}-\\x{E007F}\\x{00A9}\\x{00AE}\\x{2122}]");
    // Control characters other than tab / newline, zero-width and bidirectional-override characters.
    private static final Pattern HIDDEN = Pattern.compile(
            "[\\p{Cc}&&[^\\t\\n\\r]]|[\\x{200B}\\x{200C}\\x{200E}\\x{200F}\\x{202A}-\\x{202E}\\x{2060}-\\x{2064}\\x{FEFF}]");

    private TextRules() {
    }

    public static boolean isClean(String s) {
        return s == null || (!EMOJI.matcher(s).find() && !HIDDEN.matcher(s).find());
    }
}
