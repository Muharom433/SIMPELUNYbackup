const fs = require("fs");
const path = require("path");

const envContent = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
const env = {};
envContent.split("\n").forEach(line => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join("=").trim();
  }
});

async function getOpenAPI() {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/`, {
    headers: {
      "apikey": env.VITE_SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${env.VITE_SUPABASE_ANON_KEY}`
    }
  });
  const data = await res.json();
  fs.writeFileSync("schema.json", JSON.stringify(data, null, 2));
  console.log("Schema saved successfully!");
}

getOpenAPI();
