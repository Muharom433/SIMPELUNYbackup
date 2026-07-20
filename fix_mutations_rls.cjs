/**
 * Script untuk memperbaiki RLS policies equipment_mutations di Supabase
 * Jalankan dengan: node fix_mutations_rls.cjs
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Read .env
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim().replace('\r', '');
    const val = parts.slice(1).join('=').trim().replace('\r', '');
    env[key] = val;
  }
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing from .env');
  process.exit(1);
}

console.log('====================================================');
console.log('   FIX EQUIPMENT MUTATIONS - SIMPEL KULIAH');
console.log('====================================================');
console.log('Supabase URL:', SUPABASE_URL);
console.log('====================================================\n');

// Test connection to Supabase by reading equipment_mutations
async function testConnection() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/equipment_mutations?limit=1`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data, headers: res.headers });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Try to insert a test record to equipment_mutations
async function testInsert() {
  return new Promise((resolve, reject) => {
    // First we need valid equipment and room IDs
    const url = new URL(`${SUPABASE_URL}/rest/v1/equipment?select=id&limit=1`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('📡 Testing connection to Supabase...');

  try {
    const result = await testConnection();
    console.log(`Status: ${result.status}`);

    if (result.status === 200) {
      console.log('✅ Tabel equipment_mutations dapat diakses (SELECT berhasil)');
      const data = JSON.parse(result.data);
      console.log(`   Records tersedia: ${Array.isArray(data) ? data.length : 'N/A'}`);
    } else if (result.status === 406) {
      console.log('⚠️  Tabel dapat diakses tapi ada masalah format (406 Not Acceptable)');
      console.log('   Data:', result.data);
    } else if (result.status === 401 || result.status === 403) {
      console.log('❌ AKSES DITOLAK - RLS policy memblokir SELECT');
      console.log('   Ini adalah penyebab utama error "Gagal menambahkan barang baru"');
    } else if (result.status === 404) {
      console.log('❌ Endpoint tidak ditemukan - Tabel mungkin belum ada');
    } else {
      console.log('⚠️  Status tidak dikenal:', result.status);
      console.log('   Data:', result.data.substring(0, 200));
    }

    console.log('\n📋 DIAGNOSA:');
    console.log('============');
    console.log('App SIMPEL Kuliah ini menggunakan custom auth (bukan Supabase Auth).');
    console.log('Semua request ke Supabase berjalan sebagai role "anon".');
    console.log('');
    console.log('MASALAH UTAMA:');
    console.log('1. RLS policy "equipment_mutations" hanya mengizinkan "authenticated" role');
    console.log('   tapi app ini tidak pernah sign in ke Supabase Auth → semua jadi "anon"');
    console.log('2. Akibatnya INSERT ke equipment_mutations SELALU DITOLAK');
    console.log('');
    console.log('SOLUSI:');
    console.log('Jalankan SQL berikut di Supabase SQL Editor:');
    console.log('URL: https://supabase.com/dashboard/project/nfoarhurrdelgkrxnwnn/sql');
    console.log('');
    
    const sqlFix = fs.readFileSync(
      path.join(__dirname, 'supabase', 'migrations', '20260720_fix_mutations_final_complete.sql'),
      'utf8'
    );
    console.log('=== COPY SQL DI BAWAH INI ===');
    console.log(sqlFix);
    console.log('=== AKHIR SQL ===');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
