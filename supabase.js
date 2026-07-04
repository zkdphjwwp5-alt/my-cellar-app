import { createClient } from '@supabase/supabase-js';

const fallbackSupabaseUrl = 'https://zrbpwvzznubgsltewebw.supabase.co';
const fallbackSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYnB3dnp6bnViZ3NsdGV3ZWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMDIzNzAsImV4cCI6MjA5ODU3ODM3MH0.he4_iCMs3gvmWnbEqCyF78GWM3cAd0x8pmNHkMsG39M';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
