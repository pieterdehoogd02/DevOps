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
app.use(cors());

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

// Use Keycloak middleware to protect routes
app.use(keycloak.middleware());

// ✅ Basic health check endpoint
app.get('/', (req, res) => {
    res.send('Authentication Service is Running');
});

// ✅ User Login Endpoint
app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        const params = new URLSearchParams();
        params.append("client_id", process.env.KEYCLOAK_CLIENT_ID);
        params.append("grant_type", "password");
        params.append("username", username);
        params.append("password", password);
        params.append("client_secret", process.env.KEYCLOAK_CLIENT_SECRET); // If your client requires a secret

        const response = await axios.post(
            `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
            params,
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        res.json({
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expires_in: response.data.expires_in
        });

    } catch (error) {
        res.status(401).json({ error: "Invalid credentials", details: error.response?.data || error.message });
    }
});


// ✅ Protected route: Retrieve user info (Only accessible to CIOs)
app.get('/user', keycloak.protect("realm:CIO"), (req, res) => {
    res.json({
        message: 'User Authenticated',
        user: req.kauth.grant.access_token.content // Return user data from Keycloak
    });
});

// ✅ Assign a user to a team (CIO only)
app.post('/assign-team', keycloak.protect("realm:CIO"), async (req, res) => {
    try {
        const roles = req.kauth.grant.access_token.content.realm_access.roles;

        // Only allow CIOs to assign teams
        if (!roles.includes("CIO")) {
            return res.status(403).json({ error: "Access Denied" });
        }

        const { userId, teamName } = req.body;
        if (!userId || !teamName) {
            return res.status(400).json({ error: "User ID and Team Name are required" });
        }

        // Get the Keycloak Group (team) ID
        const groupResponse = await axios.get(`${process.env.KEYCLOAK_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/groups`, {
            headers: { "Authorization": `Bearer ${req.kauth.grant.access_token.token}` }
        });

        // Find the group that matches teamName
        const team = groupResponse.data.find(group => group.name === teamName);
        if (!team) return res.status(404).json({ error: "Team not found" });

        // Assign user to the team
        await axios.put(`${process.env.KEYCLOAK_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users/${userId}/groups/${team.id}`, {}, {
            headers: { "Authorization": `Bearer ${req.kauth.grant.access_token.token}` }
        });

        res.json({ message: `✅ User ${userId} assigned to team ${teamName}` });
    } catch (error) {
        res.status(500).json({ error: "❌ Failed to assign user to team", details: error.response?.data || error.message });
    }
});

// Start Express server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`✅ Authentication Service running on port ${PORT}`));
