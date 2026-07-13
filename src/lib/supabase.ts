import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = 'https://sxvpumolwegjtyzodmoi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Fi9qIFvQTooMLEFQsnOmvw_wO9kjnr0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});