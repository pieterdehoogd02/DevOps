// Load environment variables
require('dotenv').config();

// Import required modules
const express = require('express');
const cors = require('cors');
const { DynamoDBClient, PutItemCommand, ScanCommand, GetItemCommand, UpdateItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
app.use(express.json());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));

app.use(cors({
    origin: ['https://main.d1b3jmhnz9hi7t.amplifyapp.com', '*'], // Allow Amplify URL
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Set up DynamoDB client (AWS SDK v3)
const dynamoDB = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

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
        id: { S: uuidv4() },
        title: { S: title },
        description: { S: description || "" },
        assignedTeam: { S: assignedTeam },
        createdAt: { S: new Date().toISOString() },
        updatedAt: { S: new Date().toISOString() },
        status: { S: "pending" }
    };

    try {
        await dynamoDB.send(new PutItemCommand({ TableName: TABLE_NAME, Item: checklist }));
        res.status(201).json({ message: "Checklist created successfully", checklist });
    } catch (error) {
        res.status(500).json({ error: "Failed to create checklist", details: error.message });
    }
});

// ✅ PO & Devs: View checklists assigned to their team
app.get('/checklists', keycloak.protect(), async (req, res) => {
    const roles = req.kauth.grant.access_token.content.realm_access.roles;

    try {
        let result = await dynamoDB.send(new ScanCommand({ TableName: TABLE_NAME }));
        let checklists = result.Items.map(item => ({
            id: item.id.S,
            title: item.title.S,
            description: item.description.S,
            assignedTeam: item.assignedTeam.S,
            createdAt: item.createdAt.S,
            updatedAt: item.updatedAt.S,
            status: item.status.S
        }));

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
        let result = await dynamoDB.send(new GetItemCommand({ TableName: TABLE_NAME, Key: { id: { S: id } } }));
        if (!result.Item) return res.status(404).json({ error: "Checklist not found" });

        await dynamoDB.send(new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: { id: { S: id } },
            UpdateExpression: "SET #s = :s, updatedAt = :u",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: {
                ":s": { S: status },
                ":u": { S: new Date().toISOString() }
            }
        }));

        res.json({ message: "Checklist updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to update checklist", details: error.message });
    }
});

// ✅ CIO: Delete a checklist
app.delete('/checklists/:id', keycloak.protect('realm:CIO'), async (req, res) => {
    const { id } = req.params;

    try {
        await dynamoDB.send(new DeleteItemCommand({ TableName: TABLE_NAME, Key: { id: { S: id } } }));
        res.json({ message: "Checklist deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete checklist", details: error.message });
    }
});

// Start the server
const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`✅ Checklist Service running on port ${PORT}`));
