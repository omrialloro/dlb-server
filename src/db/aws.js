const AWS = require("aws-sdk");
// configure AWS SDK with your credentials
AWS.config.update({
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: "eu-central-1",
});

module.exports = { AWS };
