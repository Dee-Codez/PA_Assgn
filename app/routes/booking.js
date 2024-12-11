const express = require('express');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const sgMail = require('@sendgrid/mail');
const pool = require('../utility/db'); // Import the PostgreSQL connection pool
const formatDate = require('../utility/datetime');
require('dotenv').config();

const router = express.Router();

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Configure Google Calendar API
const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

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
 *                 example: 2023-12-31T10:00:00
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user_email = decoded.email;
    const user_type = decoded.user_type;

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
    const sessionTime = new Date(session_date+'+05:30');
    const hour = session_date.toString().split('T')[1].split(':')[0];
    const minutes = session_date.toString().split('T')[1].split(':')[1];
    if (hour < 9 || hour > 16 || minutes != 0) {
      return res.status(400).json({ error: 'Invalid session time. Sessions can only be booked between 9 a.m. and 4 p.m. at hourly intervals.' });
    }

    // Calculate slot number
    const slot = hour - 9; // Slot 0 for 9 a.m., Slot 1 for 10 a.m., ..., Slot 7 for 4 p.m.

    // Check if the speaker already has a booking for the same slot
    const bookingResult = await pool.query('SELECT * FROM bookings WHERE speaker_email = $1 AND slot = $2 AND DATE(session_date) = DATE($3)', [speaker_email, slot, session_date]);
    if (bookingResult.rows.length > 0) {
      return res.status(400).json({ error: 'Speaker already has a booking for this slot' });
    }

    // Create booking in the database
    await pool.query('INSERT INTO bookings (user_email, speaker_email, session_date, slot) VALUES ($1, $2, $3, $4)', [user_email, speaker_email, session_date, slot]);

    // Send email reminder
    const msg = {
      to: [user_email, speaker_email],
      from: process.env.EMAIL_FROM,
      subject: 'Session Booking Confirmation',
      text: `Your session has been booked successfully for ${session_date}.`,
    };
    await sgMail.send(msg);

    // Create Google Calendar event
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    const event = {
      summary: 'Session Booking',
      description: 'Session with speaker',
      start: {
        dateTime: session_date,
        timeZone: 'IST',
      },
      end: {
        dateTime: new Date(sessionTime.getTime() + 60 * 60 * 1000), // Add 1 hour to the start time
        timeZone: 'IST',
      },
      attendees: [
        { email: user_email },
        { email: speaker_email },
      ],
    };
    await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      sendUpdates: 'all', // Send email invites to all attendees
    });

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