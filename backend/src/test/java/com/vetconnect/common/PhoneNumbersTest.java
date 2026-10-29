package com.vetconnect.common;

import com.vetconnect.common.exceptions.BadRequestException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PhoneNumbersTest {

    @Test
    void differentWaysOfWritingTheSameNumberBecomeOne() {
        assertEquals("+919876543210", PhoneNumbers.normalize("+91 98765 43210"));
        assertEquals("+919876543210", PhoneNumbers.normalize("+91-98765-43210"));
        assertEquals("+919876543210", PhoneNumbers.normalize("  +91 (98765) 43210 "));
        assertEquals("+919876543210", PhoneNumbers.normalize("0091 98765 43210"));
        assertEquals("+919876543210", PhoneNumbers.normalize("+919876543210"));
        assertEquals("+15550201", PhoneNumbers.normalize("+1 555-0201"));
    }

    @Test
    void numbersWithoutACountryCodeOrOfTheWrongShapeAreRefused() {
        for (String bad : new String[]{"9876543210", "+0123456789", "+12", "+91 98765 4321012345678", "abc", "+91 98765 4321a", "", "   ", null}) {
            assertThrows(BadRequestException.class, () -> PhoneNumbers.normalize(bad), String.valueOf(bad));
        }
    }

    @Test
    void anAccountWithoutAnEmailGetsAnInternalAddressThatIsRecognisable() {
        String internal = PhoneNumbers.placeholderEmail("+919876543210");
        assertEquals("m919876543210@mobile.vetconnect.local", internal);
        assertTrue(PhoneNumbers.isPlaceholderEmail(internal));
        assertFalse(PhoneNumbers.isPlaceholderEmail("someone@example.com"));
        assertFalse(PhoneNumbers.isPlaceholderEmail(null));
    }
}
