import rateLimit from "express-rate-limit";

/**
 * Global rate limiter to prevent DDoS and brute-force attacks.
 */
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per windowMs
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
    max: 10, // Limit each IP to 10 failed attempts per hour
    skipSuccessfulRequests: true,
    message: {
        success: false,
        error: "Too many login attempts, please try again in an hour.",
    },
});
