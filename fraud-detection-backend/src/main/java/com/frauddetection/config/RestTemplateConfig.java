package com.frauddetection.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * RestTemplate bean configured with timeouts for ML Service communication.
 * Per TDD §14: connect 2s, read 5s.
 */
@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate(
            RestTemplateBuilder builder,
            @Value("${ml.service.timeout.connect:2000}") int connectTimeout,
            @Value("${ml.service.timeout.read:5000}") int readTimeout) {

        return builder
                .connectTimeout(Duration.ofMillis(connectTimeout))
                .readTimeout(Duration.ofMillis(readTimeout))
                .build();
    }
}
