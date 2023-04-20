// function to get user by email from DynamoDB
const { AWS } = require("./aws");

// create a new instance of the DynamoDB DocumentClient
const docClient = new AWS.DynamoDB.DocumentClient();

async function getUserByEmail(email) {
  const params = {
    TableName: "users",
    Key: {
      email,
    },
  };

  const data = await docClient.get(params).promise();
  return data.Item;
}

// function to create a new user in DynamoDB
async function createUser(email, password) {
  const params = {
    TableName: "users",
    Item: {
      email,
      password,
    },
  };

  await docClient.put(params).promise();
}

module.exports = { getUserByEmail, createUser };
