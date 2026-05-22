const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const db = require("../config/db"); // ✅ added MySQL connection

router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ✅ MongoDB replaced with MySQL check
    const existingUserSql = "SELECT * FROM users WHERE email = ?";

    db.query(existingUserSql, [normalizedEmail], async (err, results) => {
      if (err) {
        return res.status(500).json({ message: "Server error during registration." });
      }

      if (results.length > 0) {
        return res.status(400).json({ message: "User already exists with this email." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const insertSql =
        "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";

      db.query(
        insertSql,
        [username.trim(), normalizedEmail, hashedPassword],
        (err2) => {
          if (err2) {
            return res.status(500).json({ message: "Server error during registration." });
          }

          return res.status(201).json({ message: "Registration successful." });
        }
      );
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error during registration." });
  }
});

router.post("/login", (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ✅ MongoDB replaced with MySQL
    const sql = "SELECT * FROM users WHERE email = ?";

    db.query(sql, [normalizedEmail], async (err, results) => {
      if (err) {
        return res.status(500).json({ message: "Server error during login." });
      }

      if (results.length === 0) {
        return res.status(401).json({ message: "Invalid email or password." });
      }

      const user = results[0];

      const isPasswordCorrect = await bcrypt.compare(password, user.password);

      if (!isPasswordCorrect) {
        return res.status(401).json({ message: "Invalid email or password." });
      }

      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email
      };

      req.session.save((err2) => {
        if (err2) {
          return res.status(500).json({ message: "Session error during login." });
        }

        return res.status(200).json({
          message: "Login successful.",
          user: req.session.user
        });
      });
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error during login." });
  }
});

router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Unauthorized." });
  }

  return res.status(200).json({
    user: req.session.user
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    return res.status(200).json({ message: "Logged out successfully." });
  });
});

module.exports = router;