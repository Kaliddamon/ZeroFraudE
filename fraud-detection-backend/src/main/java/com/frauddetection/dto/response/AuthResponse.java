package com.frauddetection.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response for POST /api/v1/auth/login.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthResponse {

    private String token;
    private String tokenType;
    private long expiresIn;
    private String userId;
    private String role;
}
