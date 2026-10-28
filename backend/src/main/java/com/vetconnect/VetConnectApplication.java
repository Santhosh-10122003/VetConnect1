package com.vetconnect;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class VetConnectApplication {

    public static void main(String[] args) {
        SpringApplication.run(VetConnectApplication.class, args);
    }
}
