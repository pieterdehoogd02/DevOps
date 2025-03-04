require('dotenv').config();
const express = require('express');
const AWS = require('aws-sdk');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const { v4: uuidv4 } = require('uuid');
app.use(cors({
    origin: ['https://main.d1b3jmhnz9hi7t.amplifyapp.com', '*'], // Allow Amplify URL
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));


// Initialize Express app
const app = express();
app.use(express.json());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));

// Set up DynamoDB
AWS.config.update({ region: process.env.AWS_REGION });
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.DYNAMO_TABLE;

// Keycloak setup
const memoryStore = new session.MemoryStore();
app.use(session({ secret: 'my-secret', resave: false, saveUninitialized: true, store: memoryStore }));

const keycloak = new Keycloak({ store: memoryStore }, {
    realm: process.env.KEYCLOAK_REALM,
    "auth-server-url": process.env.KEYCLOAK_URL,
    resource: process.env.KEYCLOAK_CLIENT_ID,
    "bearer-only": true
});
app.use(keycloak.middleware());

// ✅ Health check
app.get('/', (req, res) => res.send('Checklist Service is Running'));

// ✅ CIO: Create a new checklist
app.post('/checklists', keycloak.protect('realm:CIO'), async (req, res) => {
    const { title, description, assignedTeam } = req.body;
    if (!title || !assignedTeam) {
        return res.status(400).json({ error: "Title and Assigned Team are required" });
    }

    const checklist = {
        id: uuidv4(),
        title,
        description: description || "",
        assignedTeam,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "pending"
    };

    try {
        await dynamoDB.put({ TableName: TABLE_NAME, Item: checklist }).promise();
        res.status(201).json({ message: "Checklist created successfully", checklist });
    } catch (error) {
        res.status(500).json({ error: "Failed to create checklist", details: error.message });
    }
});

// ✅ PO & Devs: View checklists assigned to their team
app.get('/checklists', keycloak.protect(), async (req, res) => {
    const roles = req.kauth.grant.access_token.content.realm_access.roles;

    try {
        let result = await dynamoDB.scan({ TableName: TABLE_NAME }).promise();
        let checklists = result.Items;

        // PO & Devs should only see their own team's checklists
        if (!roles.includes("CIO")) {
            const userTeam = req.kauth.grant.access_token.content.team; // Assume `team` is in Keycloak claims
            checklists = checklists.filter(cl => cl.assignedTeam === userTeam);
        }

        res.json(checklists);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch checklists", details: error.message });
    }
});

// ✅ PO: Update checklist status
app.put('/checklists/:id', keycloak.protect('realm:PO'), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        let checklist = await dynamoDB.get({ TableName: TABLE_NAME, Key: { id } }).promise();
        if (!checklist.Item) return res.status(404).json({ error: "Checklist not found" });

        checklist.Item.status = status;
        checklist.Item.updatedAt = new Date().toISOString();

        await dynamoDB.put({ TableName: TABLE_NAME, Item: checklist.Item }).promise();
        res.json({ message: "Checklist updated", checklist: checklist.Item });
    } catch (error) {
        res.status(500).json({ error: "Failed to update checklist", details: error.message });
    }
});

// ✅ CIO: Delete a checklist
app.delete('/checklists/:id', keycloak.protect('realm:CIO'), async (req, res) => {
    const { id } = req.params;

    try {
        await dynamoDB.delete({ TableName: TABLE_NAME, Key: { id } }).promise();
        res.json({ message: "Checklist deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete checklist", details: error.message });
    }
});

// Start the server
const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`Checklist Service running on port ${PORT}`));
