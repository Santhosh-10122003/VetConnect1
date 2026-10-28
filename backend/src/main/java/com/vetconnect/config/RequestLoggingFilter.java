package com.vetconnect.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;

/**
 * Logs one line per API request (method, path, status, duration, caller).
 * Request/response bodies and the query string are never logged, so credentials stay out of the logs.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestLoggingFilter extends OncePerRequestFilter {

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long start = System.currentTimeMillis();
        MDC.put("requestId", UUID.randomUUID().toString().substring(0, 8));
        try {
            chain.doFilter(request, response);
        } finally {
            long ms = System.currentTimeMillis() - start;
            int status = response.getStatus();
            Object attr = request.getAttribute(JwtAuthFilter.REQUEST_USER_ATTR);
            String caller = attr != null ? attr.toString() : "anonymous";
            String line = "{} {} -> {} ({} ms) user={} ip={}";
            if (status >= 500) {
                log.error(line, request.getMethod(), request.getRequestURI(), status, ms, caller, request.getRemoteAddr());
            } else if (status >= 400) {
                log.warn(line, request.getMethod(), request.getRequestURI(), status, ms, caller, request.getRemoteAddr());
            } else {
                log.info(line, request.getMethod(), request.getRequestURI(), status, ms, caller, request.getRemoteAddr());
            }
            MDC.remove("requestId");
        }
    }
}
