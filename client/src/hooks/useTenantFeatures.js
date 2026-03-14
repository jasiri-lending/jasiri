import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./userAuth";

export function useTenantFeatures() {
    const { profile } = useAuth();
    const [documentUploadEnabled, setDocumentUploadEnabled] = useState(false);
    const [imageUploadEnabled, setImageUploadEnabled] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTenantFeature = async () => {
            if (!profile?.tenant_id) {
                setLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('tenant_features')
                    .select('document_upload_enabled, image_upload_enabled')
                    .eq('tenant_id', profile.tenant_id)
                    .maybeSingle();

                if (error) {
                    console.error('Error fetching tenant features:', error);
                } else if (data) {
                    setDocumentUploadEnabled(data.document_upload_enabled);
                    setImageUploadEnabled(data.image_upload_enabled);
                } else {
                    // If no row exists, default false (no uploads)
                    setDocumentUploadEnabled(false);
                    setImageUploadEnabled(false);
                }
            } catch (err) {
                console.error('Unexpected error fetching tenant features:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTenantFeature();
    }, [profile?.tenant_id]);

    return { documentUploadEnabled, imageUploadEnabled, loading };
}

