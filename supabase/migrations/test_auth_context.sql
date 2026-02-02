-- Test if auth.uid() is working
-- Run this query to check if you have an active Supabase session

SELECT 
    auth.uid() as current_user_id,
    auth.role() as current_role,
    (auth.uid() IS NOT NULL) as is_authenticated;

-- If current_user_id is NULL, then RLS policies using auth.uid() won't work!
