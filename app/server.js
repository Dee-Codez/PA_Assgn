const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const cookieParser = require('cookie-parser');


const pool = require('./utility/db');
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/booking');

const app = express();
const port = 3000;

// Middlewares
app.use(express.json());
app.use(cookieParser());

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Express API with Swagger',
    version: '1.0.0',
    description: 'A simple Express API application with Swagger documentation',
  },
  servers: [
    {
      url: `http://localhost:${port}`,
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['app/server.js', 'app/routes/*.js'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(options);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/auth', authRoutes);
app.use('/booking', bookingRoutes);


/**
 * @swagger
 * /:
 *   get:
 *     summary: Welcome message
 *     responses:
 *       200:
 *         description: Returns a welcome message.
 */
app.get('/', (req, res) => {
  res.send('Hello, World!');
});

/**
 * @swagger
 * /api/sample:
 *   get:
 *     summary: Sample endpoint
 *     responses:
 *       200:
 *         description: Returns a sample message.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: This is a sample endpoint
 */
app.get('/api/sample', (req, res) => {
  res.json({ message: 'This is a sample endpoint' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Swagger UI is available at http://localhost:${port}/api-docs`);
});