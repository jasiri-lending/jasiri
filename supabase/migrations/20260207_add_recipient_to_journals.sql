-- Add recipient_id to journals table for transfer functionality
ALTER TABLE public.journals 
ADD COLUMN IF NOT EXISTS recipient_id bigint REFERENCES public.customers(id);

-- Add index for recipient_id
CREATE INDEX IF NOT EXISTS idx_journals_recipient_id ON public.journals(recipient_id);

-- Update customer_wallets check constraint if needed (though user provided one, good to ensure 'transfer' type if we use it)
-- The user provided constraint allows 'credit' and 'debit'. 
-- For transfers, we will create two wallet entries: one 'debit' for sender, one 'credit' for recipient.
-- So the existing constraint is fine.
