import { createClient } from '@supabase/supabase-js';

// Replace with your actual Supabase project URL and public API key
const supabaseUrl = 'https://wclfjdympbthafdpigxv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjbGZqZHltcGJ0aGFmZHBpZ3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMjc0MDMsImV4cCI6MjA2MTYwMzQwM30.XDEDkpvyPcpJNc8rz_9f_zYDXQysTJ-lw7VWWpzsiwQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 