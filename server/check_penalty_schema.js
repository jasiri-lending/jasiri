
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    const { data, error } = await supabase
        .from('penalty_settings')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error selecting from penalty_settings:', error);
    } else {
        console.log('Sample row from penalty_settings:', data);
        if (data && data.length > 0) {
            console.log('Columns:', Object.keys(data[0]));
        }
    }
}

checkSchema();
