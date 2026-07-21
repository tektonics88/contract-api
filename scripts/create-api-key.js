#!/usr/bin/env node
'use strict';

/**
 * Creates (or reuses) a user and issues a new API key.
 *
 * Usage:
 *   node scripts/create-api-key.js <email> [key name]
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in the environment (.env).
 * The plaintext key is printed ONCE — only its hash is stored, so save it now.
 */

const crypto = require('crypto');
const { getClient, hashApiKey } = require('../src/db/supabase');

async function main() {
  const email = process.argv[2];
  const keyName = process.argv[3] || 'default';

  if (!email) {
    console.error('Usage: node scripts/create-api-key.js <email> [key name]');
    process.exit(1);
  }

  const supabase = getClient();

  // Upsert the user by email.
  const { data: user, error: userErr } = await supabase
    .from('users')
    .upsert({ email }, { onConflict: 'email' })
    .select('id, email')
    .single();
  if (userErr) throw new Error(`Failed to upsert user: ${userErr.message}`);

  // Generate a high-entropy key: sk_<48 hex chars>.
  const secret = crypto.randomBytes(24).toString('hex');
  const plaintextKey = `sk_${secret}`;
  const keyPrefix = plaintextKey.slice(0, 11); // e.g. "sk_a1b2c3d4"

  const { error: keyErr } = await supabase.from('api_keys').insert({
    user_id: user.id,
    key_hash: hashApiKey(plaintextKey),
    key_prefix: keyPrefix,
    name: keyName,
  });
  if (keyErr) throw new Error(`Failed to insert API key: ${keyErr.message}`);

  console.log('\nAPI key created successfully.');
  console.log(`  User:   ${user.email} (${user.id})`);
  console.log(`  Name:   ${keyName}`);
  console.log(`  Prefix: ${keyPrefix}`);
  console.log('\n  Save this key now — it will not be shown again:\n');
  console.log(`    ${plaintextKey}\n`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
