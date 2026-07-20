const express = require('express');
const bcrypt = require('bcryptjs');
const { queryOne, run } = require('../db');
const { generateToken } = require('../middleware/auth');
const { generateId } = require('../utils/idGenerator');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await queryOne('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = generateId('USER');
    const now = new Date().toISOString();

    await run(
      `INSERT INTO users (id, username, email, password, createdAt)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, username, email, hashedPassword, now]
    );

    const token = generateToken(userId);
    res.status(201).json({
      message: 'User registered successfully',
      token,
      userId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await queryOne('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);
    res.json({
      message: 'Login successful',
      token,
      userId: user.id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
