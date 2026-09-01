const fs = require("fs");
const schema = JSON.parse(fs.readFileSync("schema.json", "utf8"));
console.log(Object.keys(schema.paths).map(p => p.substring(1)));
