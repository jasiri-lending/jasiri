import rateLimit from "express-rate-limit";

/**
 * Global rate limiter to prevent DDoS and brute-force attacks.
 */
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increased for stability during testing
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: "Too many requests, please try again later.",
    },
});

/**
 * Stricter rate limiter for authentication endpoints.
 */
export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30, // Increased for testing
    skipSuccessfulRequests: true,
    message: {
        success: false,
        error: "Too many login attempts, please try again in an hour.",
    },
});
