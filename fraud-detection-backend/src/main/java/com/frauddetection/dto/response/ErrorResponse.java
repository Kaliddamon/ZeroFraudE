package com.frauddetection.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Standard error response format per TDD §13.
 * Used by GlobalExceptionHandler for all error responses.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponse {

    private Instant timestamp;
    private int status;
    private String error;
    private String message;
    private String path;
    private String requestId;
    private List<FieldError> details;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FieldError {
        private String field;
        private Object rejectedValue;
        private String message;
    }
}
