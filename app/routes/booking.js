const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../utility/db'); // Import the PostgreSQL connection pool
require('dotenv').config();

const router = express.Router();

/**
 * @swagger
 * /booking/book-session:
 *   post:
 *     summary: Book a session with a speaker
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               speaker_email:
 *                 type: string
 *                 example: speaker@example.com
 *               session_date:
 *                 type: string
 *                 format: date-time
 *                 example: 2023-12-31T10:00:00Z
 *     responses:
 *       200:
 *         description: Session booked successfully
 *       400:
 *         description: Invalid request or speaker not available
 *       500:
 *         description: Failed to book session
 */
router.post('/book-session', async (req, res) => {
  const { speaker_email, session_date } = req.body;
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Verify and decode the token
    const token_data = jwt.verify(token, process.env.JWT_SECRET);
    const user_email = token_data.email;
    const user_type = token_data.user_type;

    // Check if the user is of type 'user'
    if (user_type !== 'user') {
      return res.status(403).json({ error: 'Only users can book sessions' });
    }

    // Check if the speaker is available
    const speakerResult = await pool.query('SELECT * FROM users_js WHERE email = $1 AND user_type = $2', [speaker_email, 'speaker']);
    if (speakerResult.rows.length === 0) {
      return res.status(400).json({ error: 'Speaker not available' });
    }

    // Validate session time
    const sessionTime = new Date(session_date);
    const hour = sessionTime.getUTCHours();
    if (hour < 9 || hour > 16 || sessionTime.getUTCMinutes() !== 0) {
      return res.status(400).json({ error: 'Invalid session time. Sessions can only be booked between 9 a.m. and 4 p.m. at hourly intervals.' });
    }

    // Calculate slot number
    const slot = hour - 8; // Slot 1 for 9 a.m., Slot 2 for 10 a.m., ..., Slot 7 for 3 p.m.

    // Check if the speaker already has a booking for the same slot
    const bookingResult = await pool.query('SELECT * FROM bookings WHERE speaker_email = $1 AND slot = $2 AND DATE(session_date) = DATE($3)', [speaker_email, slot, session_date]);
    if (bookingResult.rows.length > 0) {
      return res.status(400).json({ error: 'Speaker already has a booking for this slot' });
    }

    // Create booking in the database
    await pool.query('INSERT INTO bookings (user_email, speaker_email, session_date, slot) VALUES ($1, $2, $3, $4)', [user_email, speaker_email, session_date, slot]);

    res.status(200).json({ message: 'Session booked successfully' });
  } catch (error) {
    console.error(error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Failed to book session' });
  }
});

module.exports = router;