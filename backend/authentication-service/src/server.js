// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const express = require('express');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const axios = require('axios');
const os = require('os');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { fromEnv } = require('@aws-sdk/credential-provider-env');

// AWS Secrets Manager Client
const client = new SecretsManagerClient({
  region: "us-east-1",
  credentials: fromEnv()
});


// Initialize Express app
const app = express();
app.use(express.json());
app.disable('strict routing'); // This makes Express treat /test and /test/ as the same route

app.use(cors({
    origin: '*', // or '*', but specify domain if possible for security
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const letsEncryptCA = fs.readFileSync(`/app/fullchain.pem`);


// console.log("letsEncryptCA = " + letsEncryptCA)

const agent = new https.Agent({
    // rejectUnauthorized: false, // ⚠️ Accept self-signed certificates (for development only)
    ca: letsEncryptCA
});

console.log("keycloak url = " + process.env.KEYCLOAK_URL)

// Add this before your route definitions
app.use((req, res, next) => {
  // This will run for every request
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});

// Set up session storage for Keycloak
const memoryStore = new session.MemoryStore();
app.use(session({
    secret: 'my-secret',
    resave: false,
    saveUninitialized: true,
    store: memoryStore
}));

async function getSecretValue(secretId) {
  try {
    console.log("secretID = " + secretId)
    const data = await client.send(
      new GetSecretValueCommand({
        SecretId: secretId,
        VersionStage: "AWSCURRENT",
      })
    );
    console.log("after getting the secret")
    if (data.SecretString) {
      return JSON.parse(data.SecretString);
    } else {
      const buff = Buffer.from(data.SecretBinary, "base64");
      return buff.toString("ascii");
    }
  } catch (error) {
    console.error(`Error retrieving secret for ${secretId}`, error);
    throw error;
  }
}

// Fetch Keycloak configurations asynchronously
async function getKeycloakConfig() {
  try {
    const keycloakUrl = await getSecretValue('KEYCLOAK_URL1');
    const keycloakRealm = await getSecretValue('KEYCLOAK_REALM');
    const keycloakClientID = await getSecretValue('KeycloakClientID');

    console.log("keycloakUrl = " + JSON.stringify(keycloakUrl))

    return {
      keycloakUrl: keycloakUrl.KEYCLOAK_URL1, // assuming the secret is a JSON object with the key `KEYCLOAK_URL1`
      keycloakRealm: keycloakRealm.KEYCLOAK_REALM,
      keycloakClientID: keycloakClientID.KEYCLOAK_CLIENT_ID,
    };
  } catch (error) {
    console.error("Error fetching Keycloak config", error);
    throw error;
  }
}

// Initialize the application and Keycloak middleware
async function initializeApp() {
    const { keycloakUrl, keycloakRealm, keycloakClientID } = await getKeycloakConfig();

    // Create Express app
    const app = express();

    // Configure Keycloak instance
    const keycloak = new Keycloak({ store: memoryStore }, {
        "realm": keycloakRealm,
        "auth-server-url": keycloakUrl,
        "resource": keycloakClientID,
        "bearer-only": true,
    });

    // Use Keycloak middleware to protect routes
    app.use(keycloak.middleware());

    // ✅ Basic health check endpoint
    app.get('/', (req, res) => {
        res.send('Authentication Service is Running');
    });

    // ✅ User Login Endpoint
    app.post('/auth/login/', async (req, res) => {
        try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        // Request a token from Keycloak
        const response = await axios.post(
            `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
            new URLSearchParams({
            client_id: keycloakClientID,
            grant_type: 'password',
            username,
            password
            })
        );

        return res.json(response.data);
        } catch (error) {
        console.error("Login error", error);
        res.status(500).json({ error: "Failed to authenticate" });
        }
    });

    // ✅ Protected route: Retrieve user info 
    app.get('/user', keycloak.protect(), (req, res) => {
        res.json({
            message: 'User Authenticated',
            user: req.kauth.grant.access_token.content // Return user data from Keycloak
        });
    });
    
    // ✅ Assign a user to a team (CIO only)
    app.post('/assign-team', keycloak.protect('realm:CIO'), async (req, res) => {
        try {
            const roles = req.kauth.grant.access_token.content.realm_access.roles;
            if (!roles.includes("CIO")) {
                return res.status(403).json({ error: "Access Denied" });
            }

            const { userId, teamName } = req.body;
            if (!userId || !teamName) {
                return res.status(400).json({ error: "User ID and Team Name are required" });
            }

            const groupResponse = await axios.get(
                `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/groups`,
                { headers: { "Authorization": `Bearer ${req.kauth.grant.access_token.token}` } }
            );

            const team = groupResponse.data.find(group => group.name === teamName);
            if (!team) return res.status(404).json({ error: "Team not found" });

            await axios.put(
                `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users/${userId}/groups/${team.id}`,
                {},
                { headers: { "Authorization": `Bearer ${req.kauth.grant.access_token.token}` } }
            );

            res.json({ message: `✅ User ${userId} assigned to team ${teamName}` });
        } catch (error) {
            res.status(500).json({ error: "❌ Failed to assign user to team", details: error.response?.data || error.message });
        }
    });

    // Start the server after Keycloak is initialized
    app.listen(5001, () => {
        console.log("Authentication service running on http://54.164.144.99:5001");
    });
}

// Run the initialization function to set up the app
initializeApp().catch(error => {
  console.error("Error initializing app", error);
  process.exit(1); // Exit with an error if initialization fails
});


// // ✅ HTTPS Server Setup
// const PORT = process.env.PORT || 5001;
// const options = {
//     key: fs.readFileSync('/etc/letsencrypt/live/planmeet.net/privkey.pem'), // ✅ Ensure correct SSL certificate path
//     cert: fs.readFileSync('/etc/letsencrypt/live/planmeet.net/fullchain.pem')
// };

// ✅ Ensure HTTPS is correctly used
// https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
//     console.log(`✅ Secure Authentication Service running on https://54.164.144.99`);
// });

// ✅ HTTP Server Setup (Replaces HTTPS)
// const PORT = process.env.PORT || 5001;
// // if listening on the same machine only listen to requests that are 127.0.0.1
// http.createServer(app).listen(PORT, '0.0.0.0', () => {
//     console.log(`✅ Authentication Service running on http://54.164.144.99:${PORT}`);
// });
