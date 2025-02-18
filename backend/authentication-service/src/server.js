// load environment variables from .env file
require('dotenv').config();

// import required modules
const express = require('express');
const session = require('express-session'); 
const Keycloak = require('keycloak-connect');

// initialize Express app
const app = express();
app.use(express.json()); 

// set up session storage for Keycloak
const memoryStore = new session.MemoryStore();
app.use(session({
    secret: 'my-secret',
    resave: false,
    saveUninitialized: true,
    store: memoryStore
}));

// configure Keycloak settings
const keycloak = new Keycloak({ store: memoryStore }, {
    "realm": process.env.KEYCLOAK_REALM,
    "auth-server-url": process.env.KEYCLOAK_URL,
    "resource": process.env.KEYCLOAK_CLIENT_ID,
    "bearer-only": true
});   

// use Keycloak middleware to protect routes
app.use(keycloak.middleware());

// basic health check endpoint to verify if the server is running
app.get('/', (req, res) => {
    res.send('Authentication Service is Running');
});

// protected route, retrieve user info only accessible with valid token 
app.get('/user', keycloak.protect(), (req, res) => {
    res.json({
        message: 'User Authenticated',
        user: req.kauth.grant.access_token.content // return user data from Keycloak
    });
});

// start Express server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Authentication Service running on port ${PORT}`));