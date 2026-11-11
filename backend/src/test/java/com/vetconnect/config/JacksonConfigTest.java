package com.vetconnect.config;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vetconnect.common.TextRules;
import com.vetconnect.dto.pet.CreatePetRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JacksonConfigTest {

    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JacksonConfig().cleanTextModule());
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void aRequestWithEmojiInAnyTextFieldIsRefused() {
        JsonMappingException e = assertThrows(JsonMappingException.class,
                () -> mapper.readValue("{\"name\":\"Bruno 🐶\",\"species\":\"DOG\"}", CreatePetRequest.class));
        assertTrue(e.getMessage().contains(TextRules.MESSAGE));
    }

    @Test
    void normalTextPasses() throws Exception {
        CreatePetRequest r = mapper.readValue("{\"name\":\"Bruno\",\"species\":\"DOG\",\"gender\":\"MALE\"}", CreatePetRequest.class);
        assertEquals("Bruno", r.getName());
    }

    @Test
    void aPetNameHasToLookLikeAName() {
        CreatePetRequest bad = new CreatePetRequest();
        bad.setName("<script>");
        assertTrue(validator.validateProperty(bad, "name").stream().anyMatch(v -> v.getMessage().startsWith("Pet name can have only")));
        CreatePetRequest ok = new CreatePetRequest();
        ok.setName("Mr. Bruno 2");
        assertTrue(validator.validateProperty(ok, "name").isEmpty());
    }
}
