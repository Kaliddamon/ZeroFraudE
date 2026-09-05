package com.frauddetection.exception;

import com.frauddetection.dto.response.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.List;

/**
 * Centralized exception handler per TDD §13.
 * No Controller handles its own errors — all exceptions are intercepted here.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // ── Validation Errors (400) ───────────────────────────────────────────────

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex,
                                                           HttpServletRequest request) {
        List<ErrorResponse.FieldError> details = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> ErrorResponse.FieldError.builder()
                        .field(fe.getField())
                        .rejectedValue(fe.getRejectedValue())
                        .message(fe.getDefaultMessage())
                        .build())
                .toList();

        return buildResponse(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                "The request contains invalid fields", request, details);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleMalformedRequest(HttpMessageNotReadableException ex,
                                                                 HttpServletRequest request) {
        return buildResponse(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST",
                "The request body is malformed or missing", request, null);
    }

    // ── Authentication / Authorization (401, 403) ─────────────────────────────

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleBadCredentials(BadCredentialsException ex,
                                                               HttpServletRequest request) {
        return buildResponse(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS",
                "Invalid email or password", request, null);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthentication(AuthenticationException ex,
                                                               HttpServletRequest request) {
        return buildResponse(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED",
                "Authentication is required to access this resource", request, null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex,
                                                             HttpServletRequest request) {
        return buildResponse(HttpStatus.FORBIDDEN, "FORBIDDEN",
                "You do not have permission to perform this action", request, null);
    }

    // ── Domain Exceptions (404, 409, 422) ─────────────────────────────────────

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex,
                                                         HttpServletRequest request) {
        return buildResponse(HttpStatus.NOT_FOUND, ex.getErrorCode(), ex.getMessage(), request, null);
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ErrorResponse> handleDuplicate(DuplicateResourceException ex,
                                                          HttpServletRequest request) {
        return buildResponse(HttpStatus.CONFLICT, ex.getErrorCode(), ex.getMessage(), request, null);
    }

    @ExceptionHandler(BusinessRuleException.class)
    public ResponseEntity<ErrorResponse> handleBusinessRule(BusinessRuleException ex,
                                                             HttpServletRequest request) {
        return buildResponse(HttpStatus.UNPROCESSABLE_ENTITY, ex.getErrorCode(),
                ex.getMessage(), request, null);
    }

    // ── ML Service Exceptions (502, 503) ──────────────────────────────────────

    @ExceptionHandler(InvalidMLResponseException.class)
    public ResponseEntity<ErrorResponse> handleInvalidMLResponse(InvalidMLResponseException ex,
                                                                   HttpServletRequest request) {
        log.error("Invalid ML response: {}", ex.getMessage(), ex);
        return buildResponse(HttpStatus.BAD_GATEWAY, ex.getErrorCode(), ex.getMessage(), request, null);
    }

    @ExceptionHandler(MLServiceException.class)
    public ResponseEntity<ErrorResponse> handleMLService(MLServiceException ex,
                                                          HttpServletRequest request) {
        log.error("ML Service error: {}", ex.getMessage(), ex);
        return buildResponse(HttpStatus.SERVICE_UNAVAILABLE, ex.getErrorCode(),
                ex.getMessage(), request, null);
    }

    // ── Catch-all (500) ───────────────────────────────────────────────────────

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneral(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception: {}", ex.getMessage(), ex);
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
                "An unexpected error occurred. Please try again later.", request, null);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private ResponseEntity<ErrorResponse> buildResponse(HttpStatus status, String error,
                                                         String message, HttpServletRequest request,
                                                         List<ErrorResponse.FieldError> details) {
        ErrorResponse body = ErrorResponse.builder()
                .timestamp(Instant.now())
                .status(status.value())
                .error(error)
                .message(message)
                .path(request.getRequestURI())
                .requestId(MDC.get("requestId"))
                .details(details)
                .build();

        return ResponseEntity.status(status).body(body);
    }
}
