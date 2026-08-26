const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Parse .env for database info
const envPath = path.join(__dirname, '.env');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  console.error('File .env tidak ditemukan di root directory!');
  process.exit(1);
}

const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    env[key] = val;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || '';
const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
const projectRef = match ? match[1] : 'nfoarhurrdelgkrxnwnn';

const dbHost = `db.${projectRef}.supabase.co`;
const dbPort = 5432;
const dbUser = 'postgres';
const dbName = 'postgres';

console.log('====================================================');
console.log('   MIGRASI KOLOM image_url - SIMPEL KULIAH');
console.log('====================================================');
console.log('Host Database:', dbHost);
console.log('User:', dbUser);
console.log('Database:', dbName);
console.log('====================================================\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Masukkan Password Database Supabase Anda: ', (password) => {
  rl.close();
  
  if (!password) {
    console.error('Error: Password tidak boleh kosong!');
    process.exit(1);
  }
  
  console.log('\nMemeriksa library pg...');
  try {
    require.resolve('pg');
    runMigration(password);
  } catch (e) {
    console.log('Library "pg" belum terpasang. Menginstall "pg" terlebih dahulu...');
    const { execSync } = require('child_process');
    try {
      execSync('npm install pg', { stdio: 'inherit' });
      console.log('Library "pg" berhasil diinstall!\n');
      runMigration(password);
    } catch (err) {
      console.error('Gagal menginstall pg:', err.message);
      process.exit(1);
    }
  }
});

function runMigration(password) {
  const { Client } = require('pg');
  
  const connectionString = `postgresql://${dbUser}:${encodeURIComponent(password)}@${dbHost}:${dbPort}/${dbName}`;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20260826_add_image_url_to_equipment.sql');
  let sql = '';
  try {
    sql = fs.readFileSync(sqlPath, 'utf8');
  } catch (e) {
    console.error('File SQL migration tidak ditemukan di:', sqlPath);
    process.exit(1);
  }
  
  console.log('Menghubungkan ke database...');
  
  client.connect()
    .then(() => {
      console.log('Berhasil terhubung ke database! Menjalankan SQL...');
      return client.query(sql);
    })
    .then((res) => {
      console.log('\n==================================================');
      console.log('🎉 EKSEKUSI SQL BERHASIL!');
      console.log('Kolom `image_url` berhasil ditambahkan pada tabel `equipment`.');
      console.log('==================================================\n');
    })
    .catch((err) => {
      console.error('\n❌ Eksekusi migrasi database gagal!');
      console.error('Detail Error:', err.message);
    })
    .finally(() => {
      client.end();
    });
}
