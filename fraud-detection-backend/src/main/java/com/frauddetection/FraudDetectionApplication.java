package com.frauddetection;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class FraudDetectionApplication {

    public static void main(String[] args) {
        SpringApplication.run(FraudDetectionApplication.class, args);
    }
}
