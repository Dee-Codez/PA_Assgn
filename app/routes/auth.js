const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sgMail = require('@sendgrid/mail');
const pool = require('../utility/db'); // Import the PostgreSQL connection pool
const e = require('express');
require('dotenv').config();

const router = express.Router();

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * @swagger
 * /auth/send-otp:
 *   post:
 *     summary: Send OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: User already exists
 *       500:
 *         description: Failed to send OTP
 */
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  try {
    // Check if the user already exists
    const userResult = await pool.query('SELECT * FROM users_js WHERE email = $1', [email]);
    if (userResult.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Generate a random 6-digit OTP
    let otp;
    if (process.env.NODE_ENV == 'dev') {
      otp = '123456';
    }else{
      otp = Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Store OTP in the database
    await pool.query('INSERT INTO otps (email, otp) VALUES ($1, $2)', [email, otp]);

    // Send OTP via SendGrid
    const msg = {
      to: email,
      from: process.env.EMAIL_FROM,
      subject: 'Your OTP Code',
      text: `Your OTP code is ${otp}`,
    };

    await sgMail.send(msg);

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register New User
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               otp:
 *                 type: string
 *                 example: 123456
 *               password:
 *                 type: string
 *                 example: your_password
 *               user_type:
 *                 type: string
 *                 example: speaker
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: OTP verified successfully
 *                 token:
 *                   type: string
 *       400:
 *         description: Invalid OTP
 */
router.post('/register', async (req, res) => {
  const { email, otp, password, user_type } = req.body;

  try {
    // Verify OTP
    const otpResult = await pool.query('SELECT * FROM otps WHERE email = $1 AND otp = $2', [email, otp]);
    if (otpResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (user_type !== 'speaker' && user_type !== 'user' ){
      return res.status(400).json({ error: 'Invalid user type' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in the database
    await pool.query('INSERT INTO users_js (email, password, user_type) VALUES ($1, $2, $3)', [email, hashedPassword, user_type]);

    // Generate JWT
    const token = jwt.sign({ email, user_type }, process.env.JWT_SECRET, { expiresIn: '8h' });

    res.cookie('token', token, { httpOnly: true, secure: true });

    // Delete the OTP record from the database
    await pool.query('DELETE FROM otps WHERE email = $1', [email]);

    res.status(200).json({ message: 'OTP verified successfully', token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: your_password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 token:
 *                   type: string
 *       400:
 *         description: Invalid email or password
 *       500:
 *         description: Failed to login
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists
    const userResult = await pool.query('SELECT * FROM users_js WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];

    // Verify the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign({ email, user_type: user.user_type }, process.env.JWT_SECRET, { expiresIn: '8h' });

    // Set the token in a cookie
    res.cookie('token', token, { httpOnly: true, secure: true });

    res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

module.exports = router;