const express = require('express');
const jwt = require('jsonwebtoken');
require('dotenv').config();


const pool = require('../utility/db'); 
const formatDate = require('../utility/datetime'); 

const router = express.Router();

/**
 * @swagger
 * /speakers/available:
 *   get:
 *     summary: List all speakers with available slots within the next week
 *     responses:
 *       200:
 *         description: List of speakers with available slots
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: string
 *                     example: speaker@example.com
 *                   expertise:
 *                     type: string
 *                     example: "JavaScript, Node.js, Express"
 *                   price_per_session:
 *                     type: number
 *                     example: 100
 *                   available_slots:
 *                     type: array
 *                     items:
 *                       type: string
 *                       example: 2023-12-31T10:00:00
 *       500:
 *         description: Failed to retrieve speakers
 */
router.get('/available', async (req, res) => {
  try {
    // Get the current date and the date one week from now
    const currentDate = new Date();
    const nextWeekDate = new Date();
    nextWeekDate.setDate(currentDate.getDate() + 7);

    // Query to get all speakers with their expertise and price per session
    const speakersResult = await pool.query('SELECT email, expertise, price_per_session FROM users_js WHERE user_type = $1', ['speaker']);
    const speakers = speakersResult.rows;

    // Query to get all bookings for the next week
    const bookingsResult = await pool.query(
      'SELECT speaker_email, session_date FROM bookings WHERE session_date BETWEEN $1 AND $2',
      [formatDate(currentDate), formatDate(nextWeekDate)]
    );
    const bookings = bookingsResult.rows;

    // Initialize an array to hold the speakers with available slots
    const speakersWithAvailableSlots = [];

    // Iterate through each speaker to find available slots
    for (const speaker of speakers) {
      const availableSlots = [];

      // Check each hour slot between 9 a.m. and 4 p.m. for the next week
      for (let day = 0; day < 7; day++) {
        for (let hour = 9; hour <= 16; hour++) {
          const slotDate = new Date(currentDate);
          slotDate.setDate(currentDate.getDate() + day);
          slotDate.setHours(hour, 0, 0, 0);

          // Check if the slot is within the next week
          if (slotDate > nextWeekDate) break;

          // Exclude past slots for the current day
          if (slotDate < currentDate) continue;

          // Check if the slot is available
          const isSlotBooked = bookings.some(
            (booking) =>
              new Date(booking.session_date).getTime() === slotDate.getTime()
          );

          if (!isSlotBooked) {
            availableSlots.push(formatDate(slotDate)); // Manually format the date
          }
        }
      }

      // If the speaker has available slots, add them to the list
      if (availableSlots.length > 0) {
        speakersWithAvailableSlots.push({
          email: speaker.email,
          expertise: speaker.expertise || 'N/A', 
          price_per_session: speaker.price_per_session || 'Not Updated',
          available_slots: availableSlots
        });
      }
    }

    res.status(200).json(speakersWithAvailableSlots);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve speakers' });
  }
});

/**
 * @swagger
 * /speakers/availability/{email}/{year}/{month}:
 *   get:
 *     summary: List availability of a single speaker for a specified month
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: The email of the speaker
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *         description: The year for which to check availability
 *       - in: path
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *         description: The month for which to check availability (1-12)
 *     responses:
 *       200:
 *         description: Availability of the speaker for the specified month
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 email:
 *                   type: string
 *                   example: speaker@example.com
 *                 expertise:
 *                   type: string
 *                   example: "JavaScript, Node.js, Express"
 *                 price_per_session:
 *                   type: number
 *                   example: 100
 *                 available_slots:
 *                   type: array
 *                   items:
 *                     type: string
 *                     example: 2023-12-31T10:00:00
 *       500:
 *         description: Failed to retrieve availability
 */
router.get('/availability/:email/:year/:month', async (req, res) => {
  const { email, year, month } = req.params;

  try {
    // Get the first and last date of the specified month
    const firstDate = new Date(year, month - 1, 1);
    const lastDate = new Date(year, month, 0);

    const currentDate = new Date();

    // Query to get all bookings for the specified month
    const bookingsResult = await pool.query(
      'SELECT session_date FROM bookings WHERE speaker_email = $1 AND session_date BETWEEN $2 AND $3',
      [email, formatDate(firstDate), formatDate(lastDate)]
    );
    const bookings = bookingsResult.rows;

    // Query to get speaker's expertise and price per session
    const speakerResult = await pool.query(
      'SELECT expertise, price_per_session FROM users_js WHERE email = $1 AND user_type = $2',
      [email, 'speaker']
    );
    const speaker = speakerResult.rows[0];

    // Initialize an array to hold the available slots
    const availableSlots = [];

    // Check each hour slot between 9 a.m. and 4 p.m. for the specified month
    for (let day = currentDate.getDate(); day <= lastDate.getDate(); day++) {
      for (let hour = 9; hour <= 16; hour++) {
        const slotDate = new Date(year, month - 1, day, hour, 0, 0);

        // Exclude past slots for the current day
        if (slotDate < currentDate) continue;

        // Check if the slot is available
        const isSlotBooked = bookings.some(
          (booking) => new Date(booking.session_date).getTime() === slotDate.getTime()
        );

        if (!isSlotBooked) {
          availableSlots.push(formatDate(slotDate)); // Manually format the date
        }
      }
    }

    res.status(200).json({
      email,
      expertise: speaker.expertise || 'N/A', 
      price_per_session: speaker.price_per_session || 'Not Updated',
      available_slots: availableSlots
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve availability' });
  }
});

/**
 * @swagger
 * /speakers/update-profile:
 *   patch:
 *     summary: Update speaker profile with expertise and price per session
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expertise:
 *                 type: string
 *                 example: "JavaScript, Node.js, Express"
 *               price_per_session:
 *                 type: number
 *                 example: 100
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Failed to update profile
 */
router.patch('/update-profile', async (req, res) => {
    const { expertise, price_per_session } = req.body;
    const token = req.cookies.token; 

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    if (!email || !expertise || !price_per_session) {
      return res.status(400).json({ error: 'Invalid request' });
    }
  
    try {
      // Validate if the email belongs to a speaker
      const speakerResult = await pool.query(
        'SELECT email FROM users_js WHERE email = $1 AND user_type = $2',
        [email, 'speaker']
      );
      if (speakerResult.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid speaker email' });
      }

      // Update speaker profile in the database
      await pool.query(
        'UPDATE users_js SET expertise = $1, price_per_session = $2 WHERE email = $3 AND user_type = $4',
        [expertise, price_per_session, email, 'speaker']
      );
  
      res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
});

module.exports = router;