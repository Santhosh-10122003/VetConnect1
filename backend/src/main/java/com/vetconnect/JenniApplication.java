package com.vetconnect;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class JenniApplication {

    public static void main(String[] args) {
        SpringApplication.run(JenniApplication.class, args);
    }
}
