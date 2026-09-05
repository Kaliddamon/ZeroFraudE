package com.frauddetection.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Generic paginated response wrapper.
 * Compatible with any table/grid library on the Frontend.
 *
 * @param <T> The type of elements in the page.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PagedResponse<T> {

    private List<T> content;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
}
