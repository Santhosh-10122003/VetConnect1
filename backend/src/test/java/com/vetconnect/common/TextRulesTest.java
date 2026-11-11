package com.vetconnect.common;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TextRulesTest {

    @Test
    void normalTextIsClean() {
        assertTrue(TextRules.isClean(null));
        assertTrue(TextRules.isClean("Dr. Asha Rao-Nair"));
        assertTrue(TextRules.isClean("வணக்கம் नमस्ते Zoë"));
        assertTrue(TextRules.isClean("12, 5th Cross\nKoramangala #4 (rear) & more!"));
        assertTrue(TextRules.isClean("Price ₹500 – 50% off"));
    }

    @Test
    void emojiAndHiddenCharactersAreRejected() {
        assertFalse(TextRules.isClean("Bruno 🐶"));
        assertFalse(TextRules.isClean("Great vet ❤️"));
        assertFalse(TextRules.isClean("🇮🇳"));
        assertFalse(TextRules.isClean("ok ✅"));
        assertFalse(TextRules.isClean("na​me"));
        assertFalse(TextRules.isClean("bell\u0007"));
        assertFalse(TextRules.isClean("evil ‮txt"));
    }
}
