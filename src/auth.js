const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const AWS = require("aws-sdk");
const router = express.Router();

// configure AWS SDK with your credentials
AWS.config.update({
  accessKeyId: "your_access_key_id",
  secretAccessKey: "your_secret_access_key",
  region: "your_region",
});

// create a new instance of the DynamoDB DocumentClient
const docClient = new AWS.DynamoDB.DocumentClient();

// middleware to check JWT token and populate request with user record

router.post("/auth", async (req, res) => {
  const { email, password, isRegister } = req.body;

  try {
    let user = await getUserByEmail(email);

    // if isRegister is true and user already exists, return an error
    if (isRegister && user) {
      return res.status(400).json({ message: "User already exists" });
    }

    // if isRegister is false and user does not exist, return an error
    if (!isRegister && !user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // if isRegister is true, create a new user
    if (isRegister) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await createUser(email, hashedPassword);
      user = await getUserByEmail(email);
    }

    // check if password matches
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // generate JWT token
    const payload = { user: { email } };
    const secret = process.env.JWT_SECRET;
    const options = { expiresIn: "1h" };
    const token = jwt.sign(payload, secret, options);

    res.json({ token, payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// function to get user by email from DynamoDB
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

module.exports = router;
