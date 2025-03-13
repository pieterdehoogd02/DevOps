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
    origin: ['https://main.d1b3jmhnz9hi7t.amplifyapp.com', '*'], // Allow Amplify frontend
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Set up DynamoDB client
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
app.get("/checklists", keycloak.protect(), async (req, res) => {
    try {
        const userToken = req.kauth.grant.access_token.content;
        const userGroups = userToken.groups || [];

        console.log("User groups:", userGroups);

        // ✅ CIOs can see all checklists
        if (userGroups.includes("/cio")) {
            const allChecklists = await getAllChecklists();
            return res.json(allChecklists);
        }

        // ✅ Identify user's team
        const userTeam = userGroups.find(group => group !== "/cio");
        if (!userTeam) {
            return res.status(403).json({ error: "User has no assigned team" });
        }

        // ✅ Remove leading "/" from group name
        const formattedTeam = userTeam.replace("/", "");

        // ✅ Fetch checklists assigned to this team
        const teamChecklists = await getChecklistsByTeam(formattedTeam);
        res.json(teamChecklists);
    } catch (error) {
        console.error("Error fetching checklists:", error);
        res.status(500).json({ error: "Internal Server Error" });
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

// ✅ Function to retrieve all checklists
async function getAllChecklists() {
    try {
        const result = await dynamoDB.send(new ScanCommand({ TableName: TABLE_NAME }));
        return result.Items || [];
    } catch (error) {
        console.error("Error fetching all checklists:", error);
        return [];
    }
}

// ✅ Function to retrieve checklists for a specific team
async function getChecklistsByTeam(team) {
    try {
        const result = await dynamoDB.send(new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: "assignedTeam = :team",
            ExpressionAttributeValues: { ":team": { S: team } }
        }));
        return result.Items || [];
    } catch (error) {
        console.error("Error fetching checklists for team:", error);
        return [];
    }
}

// Start the server
const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`✅ Checklist Service running on port ${PORT}`));
