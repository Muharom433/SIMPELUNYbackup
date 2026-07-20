/**
 * Menerapkan RLS fix ke Supabase menggunakan Supabase REST API
 * Menggunakan rpc() untuk menjalankan SQL melalui PostgreSQL function
 * 
 * Jalankan dengan: node apply_rls_fix.cjs
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

// Helper to make HTTP requests
function makeRequest(method, urlStr, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        ...headers
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

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function checkTableExists() {
  console.log('1. Checking if equipment_mutations table exists...');
  const result = await makeRequest('GET', `${SUPABASE_URL}/rest/v1/equipment_mutations?limit=0&select=id`);
  console.log(`   Status: ${result.status}`);
  
  if (result.status === 200 || result.status === 406) {
    console.log('   ✅ Table EXISTS');
    return true;
  } else if (result.status === 404) {
    console.log('   ❌ Table does NOT exist (404)');
    return false;
  } else if (result.status === 401 || result.status === 403) {
    console.log('   ⚠️  Table may exist but RLS is blocking access (401/403)');
    console.log(`   Response: ${result.data.substring(0, 200)}`);
    return 'rls_blocked';
  } else {
    console.log(`   ⚠️  Unexpected status: ${result.status}`);
    console.log(`   Response: ${result.data.substring(0, 300)}`);
    return 'unknown';
  }
}

async function testInsert() {
  console.log('\n2. Testing INSERT to equipment_mutations...');
  
  // Get first equipment and room
  const eqRes = await makeRequest('GET', `${SUPABASE_URL}/rest/v1/equipment?select=id&limit=1`);
  const roomRes = await makeRequest('GET', `${SUPABASE_URL}/rest/v1/rooms?select=id&limit=1`);

  if (eqRes.status !== 200 || roomRes.status !== 200) {
    console.log(`   ❌ Cannot get test data. Equipment: ${eqRes.status}, Rooms: ${roomRes.status}`);
    return false;
  }

  const equipment = JSON.parse(eqRes.data);
  const rooms = JSON.parse(roomRes.data);

  if (!equipment.length || !rooms.length) {
    console.log('   ⚠️  No equipment or rooms found to test with');
    return false;
  }

  const testData = {
    equipment_id: equipment[0].id,
    new_room_id: rooms[0].id,
    pic_name: 'TEST_AUTO_DELETE',
    pic_phone: null,
    notes: 'AUTO TEST - PLEASE DELETE',
    previous_room_id: null
  };

  console.log(`   Testing with equipment_id=${equipment[0].id}, room_id=${rooms[0].id}`);

  const insertRes = await makeRequest('POST', `${SUPABASE_URL}/rest/v1/equipment_mutations`, testData, {
    'Prefer': 'return=minimal'
  });

  console.log(`   INSERT Status: ${insertRes.status}`);
  
  if (insertRes.status === 201 || insertRes.status === 200) {
    console.log('   ✅ INSERT SUCCESS - RLS is working correctly for anon!');
    return true;
  } else if (insertRes.status === 403 || insertRes.status === 401) {
    console.log('   ❌ INSERT DENIED by RLS policy!');
    console.log(`   Response: ${insertRes.data}`);
    return false;
  } else {
    console.log(`   ⚠️  INSERT failed with status ${insertRes.status}`);
    console.log(`   Response: ${insertRes.data.substring(0, 300)}`);
    return false;
  }
}

async function main() {
  console.log('====================================================');
  console.log('   CHECK & TEST EQUIPMENT_MUTATIONS RLS');
  console.log('====================================================');
  console.log('URL:', SUPABASE_URL);
  console.log('');

  const tableStatus = await checkTableExists();
  const insertWorking = await testInsert();

  console.log('\n====================================================');
  console.log('SUMMARY');
  console.log('====================================================');
  console.log(`Table exists: ${tableStatus}`);
  console.log(`INSERT works for anon: ${insertWorking}`);

  if (!insertWorking) {
    console.log('\n❌ PROBLEM CONFIRMED: INSERT ke equipment_mutations GAGAL untuk anon user');
    console.log('\nSOLUSI: Anda harus menjalankan SQL fix di Supabase SQL Editor secara manual.');
    console.log('\nLangkah-langkah:');
    console.log('1. Buka browser dan login ke https://supabase.com/dashboard');
    console.log('2. Pilih project: nfoarhurrdelgkrxnwnn');
    console.log('3. Klik "SQL Editor" di sidebar kiri');
    console.log('4. Klik "New Query"');
    console.log('5. Copy-paste isi file: supabase/migrations/20260720_fix_mutations_final_complete.sql');
    console.log('6. Klik tombol "Run" (atau Ctrl+Enter)');
    console.log('\nFile SQL tersedia di:');
    console.log(path.join(__dirname, 'supabase', 'migrations', '20260720_fix_mutations_final_complete.sql'));
  } else {
    console.log('\n✅ Database OK - INSERT berhasil!');
    console.log('Masalah mungkin ada di kode aplikasi, bukan di database.');
  }
}

main().catch(console.error);
