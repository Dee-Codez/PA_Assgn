const { google } = require('googleapis');
const prompt = require('prompt-sync')();
require('dotenv').config();

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Generate the URL for authorization
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/calendar'],
});

console.log('Authorize this app by visiting this url:', authUrl);

// After visiting the URL and authorizing the app, you will get an authorization code.
// Use that code to get the refresh token.

const code = prompt('Enter the code from that page here: ');

oAuth2Client.getToken(code, (err, token) => {
  if (err) return console.error('Error retrieving access token', err);
  console.log('Access Token:', token.access_token);
  console.log('Refresh Token:', token.refresh_token);
});