package com.frauddetection.service;

import com.frauddetection.domain.User;
import com.frauddetection.dto.request.LoginRequest;
import com.frauddetection.dto.response.AuthResponse;
import com.frauddetection.repository.UserRepository;
import com.frauddetection.security.JwtService;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Authentication service — validates credentials and issues JWT tokens.
 */
@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository,
                        PasswordEncoder passwordEncoder,
                        JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!user.getActive()) {
            throw new BadCredentialsException("Account is deactivated");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }

        String token = jwtService.generateToken(user);
        long expiresInSeconds = jwtService.getExpirationMs() / 1000;

        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresIn(expiresInSeconds)
                .userId(user.getId().toString())
                .role(user.getRole().name())
                .build();
    }
}
