const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { getUserByEmail, createUser } = require("./db/users");
const router = express.Router();

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
    const options = { expiresIn: "3h" };
    const token = jwt.sign(payload, secret, options);

    res.json({ token, payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
