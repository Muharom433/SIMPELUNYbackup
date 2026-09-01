const fs = require("fs");
const schema = JSON.parse(fs.readFileSync("schema.json", "utf8"));
for (const key in schema.definitions) {
  if (key.includes("user")) {
    console.log("Definition:", key);
    console.log(Object.keys(schema.definitions[key].properties));
  }
}
