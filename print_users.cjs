const fs = require("fs");
const schema = JSON.parse(fs.readFileSync("schema.json", "utf8"));
if (schema.definitions && schema.definitions.users) {
  console.log(Object.keys(schema.definitions.users.properties));
} else {
  console.log("No users definition found");
}
