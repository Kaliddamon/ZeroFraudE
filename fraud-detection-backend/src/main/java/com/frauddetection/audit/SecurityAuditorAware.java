package com.frauddetection.audit;

import org.springframework.data.domain.AuditorAware;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

/**
 * Provides the current authenticated user's ID for JPA auditing (@CreatedBy).
 * Per TDD §17: extracts from SecurityContext.
 */
@Component
public class SecurityAuditorAware implements AuditorAware<UUID> {

    @Override
    public Optional<UUID> getCurrentAuditor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getPrincipal() == null) {
            return Optional.empty();
        }

        Object principal = auth.getPrincipal();
        if (principal instanceof UUID userId) {
            return Optional.of(userId);
        }

        return Optional.empty();
    }
}
