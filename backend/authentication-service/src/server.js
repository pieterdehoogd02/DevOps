// Load environment variables from AWS Secrets Manager
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
app.disable('strict routing'); // Treat /test and /test/ as the same route

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Load SSL certificates
const letsEncryptCA = fs.readFileSync(`/app/fullchain.pem`);
console.log('Loaded certificate chain:', letsEncryptCA.toString());

const agent = new https.Agent({
    ca: letsEncryptCA
});

// Set up session storage for Keycloak
const memoryStore = new session.MemoryStore();
app.use(session({
    secret: 'my-secret',
    resave: false,
    saveUninitialized: false,
    store: memoryStore,
    cookie: { secure: false } 
}));

// Function to fetch secrets from AWS Secrets Manager
async function getSecretValue(secretId) {
  try {
    console.log(`Fetching secret: ${secretId}`);
    const data = await client.send(
      new GetSecretValueCommand({
        SecretId: secretId,
        VersionStage: "AWSCURRENT",
      })
    );
    // console.log("after getting the secret")
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

// Fetch Keycloak and Authentication Service Configurations
async function getKeycloakConfig() {
  try {

    console.log("🔍 Fetching Keycloak URL from AWS Secrets Manager...");

    const keycloakUrl = await getSecretValue('KEYCLOAK_URL1');
    const keycloakRealm = await getSecretValue('KEYCLOAK_REALM');
    const keycloakClientID = await getSecretValue('KeycloakClientID');
    const authService = await getSecretValue('AUTH_SERVICE_SECRET');

    console.log("keycloakUrl = " + JSON.stringify(keycloakUrl))
    console.log("✅ Keycloak Secrets Fetched:");
    console.log("KEYCLOAK_URL1:", keycloakUrl);
    console.log("KEYCLOAK_REALM:", keycloakRealm);
    console.log("KEYCLOAK_CLIENT_ID:", keycloakClientID);

    return {
      keycloakUrl: keycloakUrl.KEYCLOAK_URL1, // assuming the secret is a JSON object with the key `KEYCLOAK_URL1`
      keycloakRealm: keycloakRealm.KEYCLOAK_REALM,
      keycloakClientID: keycloakClientID.KEYCLOAK_CLIENT_ID,
      authServiceUrl: authService.AUTH_SERVICE_URL,
    };
  } catch (error) {
    console.error("Error fetching Keycloak/Auth config", error);
    throw error;
  }
}

// Initialize the application and Keycloak middleware
async function initializeApp() {
    const { keycloakUrl, keycloakRealm, keycloakClientID, authServiceUrl } = await getServiceConfig();

    console.log(`🔹 Keycloak URL: ${keycloakUrl}, Realm: ${keycloakRealm}, Client ID: ${keycloakClientID}`);
    console.log(`🔹 Auth Service URL: ${authServiceUrl}`);

    // Configure Keycloak instance
    const keycloak = new Keycloak({ store: memoryStore }, {
        "realm": keycloakRealm,
        "auth-server-url": keycloakUrl,
        "resource": keycloakClientID,
        "bearer-only": true,
    });

    console.log("🔹 Keycloak initialized");

    // Use Keycloak middleware to protect routes
    app.use(keycloak.middleware({
        logout: '/logout',
        admin: '/',
    }));

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
        
        console.log("trying to get keycloak configurations");

        const { keycloakUrl, keycloakRealm, keycloakClientID } = await getKeycloakConfig();

        console.log("URL = " + `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`);

        // Request a token from Keycloak
        const response = await axios.post(
            `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
            new URLSearchParams({
            client_id: keycloakClientID,
            grant_type: 'password',
            username,
            password
            }), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                httpsAgent: agent  // ✅ Use HTTPS agent
            }
        );

        return res.json(response.data);
        } catch (error) {
        console.error("❌ Login error", error);
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

/*    
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
                `${process.env.KEYCLOAK_URL1}/admin/realms/${process.env.KEYCLOAK_REALM}/groups`,
                { headers: { "Authorization": `Bearer ${req.kauth.grant.access_token.token}` } }
            );

            const team = groupResponse.data.find(group => group.name === teamName);
            if (!team) return res.status(404).json({ error: "Team not found" });

            await axios.put(
                `${process.env.KEYCLOAK_URL1}/admin/realms/${process.env.KEYCLOAK_REALM}/users/${userId}/groups/${team.id}`,
                {},
                { headers: { "Authorization": `Bearer ${req.kauth.grant.access_token.token}` } }
            );

            res.json({ message: `✅ User ${userId} assigned to team ${teamName}` });
        } catch (error) {
            res.status(500).json({ error: "❌ Failed to assign user to team", details: error.response?.data || error.message });
        }
    });

    // Start the server after Keycloak is initialized
    app.listen(5001, '0.0.0.0', () => {
        console.log(`✅ Authentication service running on ${authServiceUrl}`);
    });
}
*/

// Run the initialization function to set up the app
initializeApp().catch(error => {
  console.error("Error initializing app", error);
  process.exit(1); // Exit with an error if initialization fails
});
