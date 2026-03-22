import { supabaseAdmin } from "../supabaseClient.js";

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

        // Verify the token with Supabase
        const { data: { user: authUser }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !authUser) {
            console.error("❌ JWT Verification failed:", error?.message || "Invalid token");
            return res.status(401).json({
                success: false,
                error: "Invalid or expired session",
            });
        }

        // 🛡️ SECURITY ENFORCEMENT: Check session in our database
        // This ensures the session hasn't been revoked/expired in our DB even if the JWT is still valid.
        // We check BOTH id and auth_id to handle cases where they might differ for older users.
        const { data: userData, error: dbError } = await supabaseAdmin
            .from("users")
            .select("id, role, tenant_id, session_expires_at")
            .or(`id.eq.${authUser.id},auth_id.eq.${authUser.id}`)
            .single();

        if (dbError || !userData) {
            console.error(`❌ User data lookup failed for Auth ID: ${authUser.id}. This usually means a profile mismatch. Error:`, dbError?.message);
            return res.status(401).json({
                success: false,
                error: "User account verification failed",
            });
        }
        
        console.log(`✅ [Identity Verified] Auth ID: ${authUser.id} maps to DB ID: ${userData.id}`);

        // Check if session has expired in our DB
        const now = new Date();
        const expiry = userData.session_expires_at ? new Date(userData.session_expires_at) : null;
        
        // Add a 5 minute grace period for clock skew
        const graceExpiry = expiry ? new Date(expiry.getTime() + 5 * 60 * 1000) : null;

        if (!expiry || graceExpiry < now) {
            console.warn(`⚠️ [Session Expired] User ${authUser.id}. Expiry: ${userData.session_expires_at}, Grace: ${graceExpiry?.toISOString()}, Now: ${now.toISOString()}`);
            return res.status(401).json({
                success: false,
                error: "Session expired",
            });
        }

        // Attach user information to request (using DB values as the single source of truth)
        req.user = {
            id: userData.id,
            email: authUser.email,
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
    const resourceTenantId = req.body?.tenant_id || req.query?.tenant_id || req.params?.tenant_id;

    // Log for debugging (can be removed later)
    if (resourceTenantId) {
        console.log(`🔍 [Tenant Check] User: ${userTenantId}, Resource: ${resourceTenantId}`);
    }

    if (resourceTenantId && userTenantId !== resourceTenantId) {
        console.warn(`⚠️ [Tenant Violation] User ${req.user.id} tried to access tenant ${resourceTenantId}`);
        return res.status(403).json({
            success: false,
            error: "Access denied: Tenant mismatch",
        });
    }

    next();
};
