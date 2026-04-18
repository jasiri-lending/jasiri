import { supabaseAdmin } from "../supabaseClient.js";
import crypto from "crypto";

/**
 * Extracted helper to verify Supabase JWTs locally using HS256.
 * This guarantees the token was issued by our Supabase project, bypassing DNS/network issues.
 */
const verifySupabaseJwtLocal = (token) => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const header = parts[0];
        const payload = parts[1];
        const signature = parts[2];
        
        const secret = process.env.SUPABASE_JWT_SECRET;
        if (!secret) return null; // Fallback to network if no secret configured

        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(`${header}.${payload}`);
        const expectedSignature = hmac.digest('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
            
        if (signature === expectedSignature) {
            return JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
        }
    } catch (err) {
        console.error("❌ Local JWT Verification Error:", err);
    }
    return null;
};


/**
 * Middleware to verify Supabase JWT token and attach user to request.
 * Expects Authorization: Bearer <supabase_access_token>
 */
export const verifySupabaseToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                error: "No authorization token provided",
            });
        }

        const token = authHeader.split(" ")[1];

        if (!token || token === "undefined" || token === "null" || token.split(".").length !== 3) {
            console.error(`❌ Malformed JWT received: "${token?.substring(0, 20)}..." (Segments: ${token?.split(".").length})`);
            return res.status(401).json({
                success: false,
                error: "Malformed authorization token",
            });
        }

        // 1. Try local offline verification first to bypass network dependency entirely!
        let authUserId = null;
        let isExpiredByToken = false;
        const localPayload = verifySupabaseJwtLocal(token);

        if (localPayload) {
            authUserId = localPayload.sub;
            isExpiredByToken = localPayload.exp && (Date.now() >= localPayload.exp * 1000);
            
            if (isExpiredByToken) {
                 console.warn(`⚠️ [AUTH] Local validation: Token mathematically expired. Deferring to 7-day database session for user ${authUserId}...`);
            }
        } else {
            // 2. Fallback to Supabase API if local verification fails (e.g. no SUPABASE_JWT_SECRET)
            const { data: { user: authUser }, error } = await supabaseAdmin.auth.getUser(token);

            if (error || !authUser) {
                const isNetworkFailure = error?.message?.includes("fetch failed") || error?.message?.includes("ENOTFOUND");
                const isExpired = error?.message?.includes("expired");

                if (isNetworkFailure) {
                    console.error(`🚨 [AUTH] CRITICAL: Network failure reaching Supabase API (${error?.message}). To fix this permanently and enable offline verification, add SUPABASE_JWT_SECRET to your server/.env file.`);
                }
                
                console.error(`❌ [AUTH] ${isExpired ? "JWT Expired" : "JWT Invalid"}:`, error?.message || "Invalid token");
                return res.status(401).json({
                    success: false,
                    error: isExpired && !isNetworkFailure ? "Your session has expired. Please log in again." : "Invalid or expired session",
                    code: isExpired ? "JWT_EXPIRED" : "AUTH_ERROR"
                });
            }
            authUserId = authUser.id;
        }

        if (!authUserId) {
            return res.status(401).json({
                success: false,
                error: "Invalid authorization token format",
            });
        }

        // 🛡️ SECURITY ENFORCEMENT: Check session in our database
        // This ensures the session hasn't been revoked/expired in our DB even if the JWT is still valid.
        const { data: userData, error: dbError } = await supabaseAdmin
            .from("users")
            .select("id, email, role, tenant_id, session_expires_at")
            .or(`id.eq.${authUserId},auth_id.eq.${authUserId}`)
            .single();

        if (dbError || !userData) {
            console.error(`❌ [AUTH] User database lookup failed for Auth ID: ${authUserId}. Error:`, dbError?.message);
            return res.status(401).json({
                success: false,
                error: "User account verification failed",
                code: "USER_NOT_FOUND"
            });
        }
        
        // Check if session has expired in our DB
        const now = new Date();
        const expiry = userData.session_expires_at ? new Date(userData.session_expires_at) : null;
        const graceExpiry = expiry ? new Date(expiry.getTime() + 5 * 60 * 1000) : null;

        if (!expiry || graceExpiry < now) {
            console.warn(`⚠️ [AUTH] DB Session Expired: ${authUserId}. ExpiredAt: ${userData.session_expires_at}, Grace: ${graceExpiry?.toISOString()}, Now: ${now.toISOString()}`);
            return res.status(401).json({
                success: false,
                error: "Your Jasiri session has expired. Please log in again.",
                code: "SESSION_EXPIRED"
            });
        }

        // Attach user information to request (using DB values as the single source of truth)
        req.user = {
            id: userData.id,
            email: userData.email || localPayload?.email,
            role: userData.role,
            tenant_id: userData.tenant_id,
        };

        next();
    } catch (err) {
        console.error("💥 Auth Middleware Error:", err);
        res.status(500).json({
            success: false,
            error: "Authentication process failed",
        });
    }
};

/**
 * Middleware to enforce tenant isolation.
 * Ensures the resource being accessed belongs to the user's tenant.
 */
export const checkTenantAccess = (req, res, next) => {
    const userTenantId = req.user?.tenant_id;
    const userRole = req.user?.role;
    const resourceTenantId = req.body?.tenant_id || req.query?.tenant_id || req.params?.tenant_id;

    // Log for debugging
    if (resourceTenantId) {
        console.log(`🔍 [Tenant Check] User: ${userTenantId}, Role: ${userRole}, Resource: ${resourceTenantId}`);
    }

    // 🚀 Superadmins can bypass tenant isolation to manage all tenants
    if (userRole === "superadmin") {
        return next();
    }

    if (resourceTenantId && userTenantId !== resourceTenantId) {
        console.warn(`⚠️ [Tenant Violation] User ${req.user.id} (Role: ${userRole}) tried to access tenant ${resourceTenantId}`);
        return res.status(403).json({
            success: false,
            error: "Access denied: Tenant mismatch",
        });
    }

    next();
};

/**
 * Middleware to check if the authenticated user has a specific permission.
 * Fetches permission from DB based on role and tenant.
 */
export const requirePermission = (permissionName) => {
    return async (req, res, next) => {
        try {
            const { role, tenant_id } = req.user;

            // 🚀 Superadmins bypass all permission checks
            if (role === 'superadmin') {
                return next();
            }

            // check if role has this permission
            const { data, error } = await supabaseAdmin
                .from("roles")
                .select(`
                    id,
                    role_permissions!inner (
                        permissions!inner (
                            name
                        )
                    )
                `)
                .eq("name", role)
                .eq("tenant_id", tenant_id)
                .eq("role_permissions.permissions.name", permissionName)
                .maybeSingle();

            if (error) {
                console.error(`❌ [Permission Check Error] ${permissionName}:`, error.message);
                return res.status(500).json({
                    success: false,
                    error: "Internal server error during permission check"
                });
            }

            if (!data) {
                console.warn(`🚫 [Permission Denied] User ${req.user.id} (Role: ${role}) tried to access protected resource without '${permissionName}' permission.`);
                return res.status(403).json({
                    success: false,
                    error: `Access denied: Missing '${permissionName}' permission`
                });
            }

            next();
        } catch (err) {
            console.error("💥 requirePermission Error:", err);
            res.status(500).json({
                success: false,
                error: "Permission verification failed",
            });
        }
    };
};
