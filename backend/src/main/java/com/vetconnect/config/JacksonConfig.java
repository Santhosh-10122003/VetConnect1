package com.vetconnect.config;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.deser.std.StdScalarDeserializer;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.vetconnect.common.TextRules;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;

/** Every text value in every JSON request passes through here, so no field can carry emoji or hidden characters. */
@Configuration
public class JacksonConfig {

    @Bean
    public SimpleModule cleanTextModule() {
        SimpleModule m = new SimpleModule("clean-text");
        m.addDeserializer(String.class, new StdScalarDeserializer<String>(String.class) {
            @Override
            public String deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
                String s = p.getValueAsString();
                if (s == null) return (String) ctxt.handleUnexpectedToken(String.class, p);
                if (!TextRules.isClean(s)) throw JsonMappingException.from(p, TextRules.MESSAGE);
                return s;
            }
        });
        return m;
    }
}
