import { supabase } from './src/config/supabase.js';

async function applyMigration() {
  console.log("Checking and updating users table schema for multi-role capability...");
  const { data: users, error } = await supabase.from('users').select('*').limit(1);
  if (error) {
    console.error("Error checking users:", error);
    return;
  }
  console.log("Current user record columns:", Object.keys(users[0] || {}));
}

applyMigration();
