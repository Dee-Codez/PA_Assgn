const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const cookieParser = require('cookie-parser');


const pool = require('./utility/db');
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/booking');
const speakerRoutes = require('./routes/speakers');

const app = express();
const port = 10000;

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
      url: `https://pa-assgn.onrender.com`,
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
app.use('/speakers', speakerRoutes);

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
  const htmlContent = `
    <html>
      <body>
        <h1>Welcome to the Express API with SwaggerUI By Debam Pati</h1>
        <button onclick="window.location.href='/api-docs'">Go to API Docs</button>
      </body>
    </html>
  `;
  res.status(200).send(htmlContent);
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on https://pa-assgn.onrender.com`);
  console.log(`Swagger UI is available at https://pa-assgn.onrender.com/api-docs`);
});