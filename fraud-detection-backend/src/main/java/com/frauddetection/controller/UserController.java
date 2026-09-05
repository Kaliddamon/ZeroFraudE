package com.frauddetection.controller;

import com.frauddetection.dto.response.PagedResponse;
import com.frauddetection.dto.response.TransactionSummaryResponse;
import com.frauddetection.dto.response.UserBehaviorResponse;
import com.frauddetection.service.TransactionService;
import com.frauddetection.service.UserBehaviorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "Users", description = "E-commerce user behavior and transaction history")
public class UserController {

    private final TransactionService transactionService;
    private final UserBehaviorService userBehaviorService;

    public UserController(TransactionService transactionService,
                           UserBehaviorService userBehaviorService) {
        this.transactionService = transactionService;
        this.userBehaviorService = userBehaviorService;
    }

    @GetMapping("/{externalUserId}/transactions")
    @Operation(summary = "List transaction history for an e-commerce user")
    public ResponseEntity<PagedResponse<TransactionSummaryResponse>> getUserTransactions(
            @PathVariable String externalUserId,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, Math.min(size, 100),
                Sort.by(Sort.Direction.DESC, "timestamp"));
        return ResponseEntity.ok(transactionService.findByExternalUserId(externalUserId, pageable));
    }

    @GetMapping("/{externalUserId}/behavior")
    @Operation(summary = "Get behavioral profile for an e-commerce user")
    public ResponseEntity<UserBehaviorResponse> getUserBehavior(
            @PathVariable String externalUserId) {
        return ResponseEntity.ok(userBehaviorService.getUserBehavior(externalUserId));
    }
}
