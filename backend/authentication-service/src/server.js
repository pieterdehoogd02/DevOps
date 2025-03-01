// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const express = require('express');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const cors = require('cors');
const axios = require('axios');

// Initialize Express app
const app = express();
app.use(express.json());
app.use(cors({
    origin: '*', // or '*', but specify domain if possible for security
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Set up session storage for Keycloak
const memoryStore = new session.MemoryStore();
app.use(session({
    secret: 'my-secret',
    resave: false,
    saveUninitialized: true,
    store: memoryStore
}));

// Configure Keycloak settings
const keycloak = new Keycloak({ store: memoryStore }, {
    "realm": process.env.KEYCLOAK_REALM,
    "auth-server-url": process.env.KEYCLOAK_URL,
    "resource": process.env.KEYCLOAK_CLIENT_ID,
    "bearer-only": true
});
app.use(keycloak.middleware());

// Use Keycloak middleware to protect routes

// ✅ Basic health check endpoint
app.get('/', (req, res) => {
    res.send('Authentication Service is Running');
});

app.get('/test', (req, res) => {
    // console.log("query parameters = " + req.query)
    try {
        res.status(200).send("request working");
    } catch(error) {
        res.status(404).send("message: " + error);
    }
});

app.get('/test/test2', (req, res) => {
    try {
        res.status(200).send("request working");
    } catch(error) {
        res.status(404).send("message: " + error);
    }
});

app.post('/test/sendShit', (req, res) => {
    try {
        res.status(200).send("request working");
    } catch(error) {
        res.status(404).send("message: " + error);
    }
});

// ✅ User Login Endpoint
app.post('/auth/login', async (req, res) => {

    console.log('Login request received');
    // console.log('Body:', req.body); // <-- log this to see exactly what arrives
    
    try {
        console.log("here?")

        const { username, password } = req.body;

        console.log("username = " + username + " pswd = " + password)
        
        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        // Request a token from Keycloak
        const response = await axios.post(
            `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
            new URLSearchParams({
                client_id: process.env.KEYCLOAK_CLIENT_ID,
                grant_type: 'password',
                username,
                password
            }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        // Decode access token to get user roles
        const accessToken = response.data.access_token;
        const decodedToken = jwt.decode(accessToken);

        if (!decodedToken || !decodedToken.realm_access) {
            return res.status(403).json({ error: "User has no roles assigned" });
        }

        // Extract roles from Keycloak token
        const userRoles = decodedToken.realm_access.roles;

        res.json({
            access_token: accessToken,
            refresh_token: response.data.refresh_token,
            expires_in: response.data.expires_in,
            roles: userRoles // ✅ Send roles back to the frontend
        });

        
    } catch (error) {
        res.status(401).json({ error: "Invalid credentials", details: error.response?.data || error.message });
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

// Start Express server
const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
    console.log('Server running on port 5001');
});
