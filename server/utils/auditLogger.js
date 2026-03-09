import pino from "pino";

const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true
        }
    }
});

/**
 * Log sensitive operations for audit trails.
 */
export const auditLog = (operation, details) => {
    logger.info({
        type: "AUDIT",
        operation,
        ...details,
        timestamp: new Date().toISOString()
    });
};

/**
 * Middleware to audit log requests.
 */
export const auditMiddleware = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        if (req.user) {
            auditLog("API_REQUEST", {
                userId: req.user.id,
                email: req.user.email,
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip
            });
        }
    });

    next();
};

export default logger;
