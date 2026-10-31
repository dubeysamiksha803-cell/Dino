import { createClient } from "@supabase/supabase-js";

// Optional separate Supabase project for storage (images/videos)
// If these envs are not provided, we fall back to the default app client.
const STORAGE_URL = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL;
const STORAGE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_ANON_KEY;

export const storageClient = STORAGE_URL && STORAGE_ANON_KEY
  ? createClient(STORAGE_URL, STORAGE_ANON_KEY)
  : null;
