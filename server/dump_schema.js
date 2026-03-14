import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient('https://uoudlnyypludbdfylteo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdWRsbnl5cGx1ZGJkZnlsdGVvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQwMzY1OSwiZXhwIjoyMDcyOTc5NjU5fQ.fByY03qirqqDBwprCkIg2Vd_fe-htWOiHOgJuNpMxJg');

async function run() {
    const { data: cols } = await supabase.from('loans').select('*').limit(1);
    const { data: cols2 } = await supabase.from('loan_payments').select('*').limit(1);
    const { data: cols3 } = await supabase.from('loan_installments').select('*').limit(1);
    const { data: cols4 } = await supabase.from('users').select('*').limit(1);

    fs.writeFileSync('schema_info.json', JSON.stringify({
        loans: cols ? Object.keys(cols[0]) : null,
        payments: cols2 ? Object.keys(cols2[0]) : null,
        installments: cols3 ? Object.keys(cols3[0]) : null,
        users: cols4 ? Object.keys(cols4[0]) : null
    }, null, 2));
}
run();
