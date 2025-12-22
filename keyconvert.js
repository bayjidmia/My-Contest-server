const fs = require("fs");
const key = fs.readFileSync(
  "./contest-site-auth-firebase-adminsdk-fbsvc-cd36bc03f0.json",
  "utf8"
);
const base64 = Buffer.from(key).toString("base64");
console.log(base64);
