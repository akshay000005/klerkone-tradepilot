import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

let supabase = null;

const isPlaceholder = (val) =>
  !val ||
  val.includes('your-project-id') ||
  val.includes('your_supabase_service_role');

if (env.NODE_ENV !== 'test' && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && !isPlaceholder(env.SUPABASE_URL) && !isPlaceholder(env.SUPABASE_SERVICE_ROLE_KEY)) {
  try {
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log('✅ Supabase PostgreSQL client initialized.');
  } catch (err) {
    console.warn('⚠️ Failed to initialize Supabase client:', err.message);
  }
} else {
  console.log('ℹ️ Supabase credentials not configured or in test mode. Using high-fidelity in-memory transactional repository.');
}

export { supabase };
