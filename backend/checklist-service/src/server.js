// Load environment variables
require('dotenv').config();

// Import required modules
const express = require('express');
const cors = require('cors');
const { DynamoDBClient, PutItemCommand, ScanCommand, GetItemCommand, UpdateItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const { v4: uuidv4 } = require('uuid');
const fs = require("fs");
const https = require("https");
const path = require("path");
const PORT = 5002;
const { swaggerUi, swaggerSpec } = require('./swagger');

// Initialize Express app
const app = express();


// Load SSL Certificates
const options = {
    key: fs.readFileSync("/etc/letsencrypt/live/checklist.planmeet.net/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/checklist.planmeet.net/fullchain.pem"),
  };

// Middleware
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));

app.use(cors({
    origin: ['https://main.d1b3jmhnz9hi7t.amplifyapp.com', '*'], // Allow Amplify frontend
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
})); 


// Load AWS SDK and set up CloudWatch
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch({ region: 'us-east-1' }); // Ensure this matches your AWS region

// Middleware to track request latency
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', async () => {
        const latency = Date.now() - start; // Measure latency in milliseconds
        const params = {
            MetricData: [
                {
                    MetricName: "RequestLatency",
                    Dimensions: [
                        { Name: "ServiceName", Value: "ChecklistMicroservice" },
                        { Name: "Path", Value: req.path }
                    ],
                    Unit: "Milliseconds",
                    Value: latency
                }
            ],
            Namespace: "Checklist Microservice"
        };
        try {
            await cloudwatch.putMetricData(params).promise();
            console.log(`✅ Sent latency metric: ${latency}ms for ${req.path}`);
        } catch (err) {
            console.error("❌ Error sending latency metric:", err);
        }
    });
    next();
});

// Set up DynamoDB client
const dynamoDB = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

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

/**
 * @swagger
 * /checklists:
 *   post:
 *     summary: Create a new checklist
 *     description: CIO users can create a new checklist.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Checklists
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - assignedTeam
 *               - status
 *             properties:
 *               title:
 *                 type: string
 *                 description: The title of the checklist
 *               description:
 *                 type: string
 *                 description: The description of the checklist (optional)
 *               assignedTeam:
 *                 type: string
 *                 description: The team assigned to the checklist
 *               status:
 *                 type: string
 *                 description: The status of the checklist
 *     responses:
 *       201:
 *         description: Checklist created successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Failed to create checklist
 */
 // Endpoint for CIO's
app.post('/checklists', keycloak.protect('realm:CIO'), async (req, res) => {
    
    // extract `status`
    const { title, description, assignedTeam, status } = req.body;

    console.log("🔥 Received status from frontend:", status); // ✅ Debugging
    console.log("📌 Extracted status before saving:", status); // New debugging

    // ✅ Ensure status is included
    if (!title || !assignedTeam || !status) {  
        return res.status(400).json({ error: "Title, Status, and Assigned Team are required" });
    }

    const checklist = {
        id: { S: uuidv4() },
        title: { S: title },
        description: { S: description || "" },
        assignedTeam: { S: assignedTeam },
        createdAt: { S: new Date().toISOString() },
        updatedAt: { S: new Date().toISOString() },
        // status: { S: status }
        status: { S: String(status) || "Unknown" }  // Force string conversion
    };

    console.log("✅ Final checklist object before inserting into DynamoDB:", checklist); // 🔥 Debugging

    try {
        await dynamoDB.send(new PutItemCommand({ TableName: TABLE_NAME, Item: checklist }));
        res.status(201).json({ message: "Checklist created successfully", checklist });
    } catch (error) {
        res.status(500).json({ error: "Failed to create checklist", details: error.message });
    }
});

/**
 * @swagger
 * /checklists:
 *   get:
 *     summary: Get checklists assigned to a team
 *     description: PO & Developers can view checklists assigned to their team. CIOs can view all checklists.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Checklists
 *     responses:
 *       200:
 *         description: Successfully retrieved checklists
 *       403:
 *         description: User has no assigned team
 *       500:
 *         description: Internal Server Error
 */
// tested
// ✅ PO & Devs: View checklists assigned to their team
app.get("/checklists", keycloak.protect(), async (req, res) => {
    try {
        const userToken = req.kauth.grant.access_token.content;
        const userGroups = userToken.groups || [];

        console.log("User groups:", userGroups);
        console.log("User roles:", userToken.realm_access.roles);

        // ✅ CIOs can see all checklists
        if (userGroups.includes("CIO") || userGroups.includes("/CIO")) {
            const allChecklists = await getAllChecklists();
            return res.json(allChecklists);
        }

        // ✅ Identify user's team
        const userTeam = userGroups.find(group => group !== "/CIO");
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

/**
 * @swagger
 * /checklists/{id}/{assignedTeam}:
 *   put:
 *     summary: Update checklist status
 *     description: PO users can update the status of a checklist assigned to a specific team.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Checklists
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The checklist ID
 *       - in: path
 *         name: assignedTeam
 *         required: true
 *         schema:
 *           type: string
 *         description: The team assigned to the checklist
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 description: The new status of the checklist
 *     responses:
 *       200:
 *         description: Checklist updated successfully
 *       404:
 *         description: Checklist not found
 *       500:
 *         description: Failed to update checklist
 */
// tested
// ✅ PO: Update checklist status
app.put('/checklists/:id/:assignedTeam', keycloak.protect('realm:PO'), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        // let result = await dynamoDB.send(new GetItemCommand({ TableName: TABLE_NAME, Key: { id: { S: id } } }));
        
        let result = await dynamoDB.send(new GetItemCommand({
            TableName: TABLE_NAME,
            Key: {
                id: { S: id },
                assignedTeam: { S: req.params.assignedTeam }  // ✅ Add assignedTeam in the Key
            }
        }));        

        if (!result.Item) return res.status(404).json({ error: "Checklist not found" });

        await dynamoDB.send(new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: { 
                id: { S: id },
                assignedTeam: { S: req.params.assignedTeam }  // ✅ Add assignedTeam in the Key
            },

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

/**
 * @swagger
 * /checklists/{id}/{assignedTeam}:
 *   delete:
 *     summary: Delete a checklist
 *     description: Deletes a checklist based on its ID and assigned team.
 *     security:
 *       - keycloak: [realm:CIO]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Checklist ID
 *         schema:
 *           type: string
 *       - in: path
 *         name: assignedTeam
 *         required: true
 *         description: Assigned team
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Checklist deleted successfully
 *       500:
 *         description: Failed to delete checklist
 */
// tested
// ✅ CIO: Delete a checklist
app.delete('/checklists/:id/:assignedTeam', keycloak.protect('realm:CIO'), async (req, res) => {
    const { id, assignedTeam } = req.params;

    try {
        await dynamoDB.send(new DeleteItemCommand({ 
            TableName: TABLE_NAME, 
            Key: { 
                id: { S: id } ,
                assignedTeam: { S: assignedTeam }  // ✅ Added assignedTeam as part of the key
            }
        }));
        res.json({ message: "Checklist deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete checklist", details: error.message });
    }
});

// tested
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

/**
 * @swagger
 * /checklists/team/{team}:
 *   get:
 *     summary: Get Checklists for a Specific Team
 *     description: Retrieves checklists for a specific assigned team.
 *     parameters:
 *       - in: path
 *         name: team
 *         required: true
 *         description: Team name
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of checklists
 *       500:
 *         description: Internal Server Error
 */
// tested
// ✅ Get Checklists for a Specific Team
app.get('/checklists/team/:team', keycloak.protect(), async (req, res) => {
    const { team } = req.params;

    try {
        console.log(`Fetching checklists for team: ${team}`);
        const result = await dynamoDB.send(new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: "assignedTeam = :team",
            ExpressionAttributeValues: { ":team": { S: team } }
        }));
        res.json(result.Items || []);
    } catch (error) {
        console.error("Error fetching checklists for team:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @swagger
 * /checklists/{id}/{assignedTeam}/edit:
 *   put:
 *     summary: Update checklist title and description
 *     description: Updates the title and description of a checklist.
 *     security:
 *       - keycloak: [realm:CIO]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: assignedTeam
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Checklist updated successfully
 *       400:
 *         description: Title and Description are required
 *       404:
 *         description: Checklist not found
 *       500:
 *         description: Failed to update checklist
 */
// ✅ CIO: Update checklist title and description
app.put('/checklists/:id/:assignedTeam/edit', keycloak.protect('realm:CIO'), async (req, res) => {
    const { id, assignedTeam } = req.params;
    const { title, description } = req.body;

    if (!title || !description) {
        return res.status(400).json({ error: "Title and Description are required" });
    }

    try {
        let result = await dynamoDB.send(new GetItemCommand({
            TableName: TABLE_NAME,
            Key: {
                id: { S: id },
                assignedTeam: { S: assignedTeam }
            }
        }));

        if (!result.Item) return res.status(404).json({ error: "Checklist not found" });

        await dynamoDB.send(new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: {
                id: { S: id },
                assignedTeam: { S: assignedTeam }
            },
            UpdateExpression: "SET title = :t, description = :d, updatedAt = :u",
            ExpressionAttributeValues: {
                ":t": { S: title },
                ":d": { S: description },
                ":u": { S: new Date().toISOString() }
            }
        }));

        res.json({ message: "Checklist updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to update checklist", details: error.message });
    }
});

/**
 * @swagger
 * /submission/{assignedTeam}:
 *   post:
 *     summary: Submit all "Done" checklists for the specified team.
 *     description: Fetches and submits all checklists marked as "Done" for the specified team, and marks them as submitted.
 *     tags:
 *       - PO
 *     parameters:
 *       - in: path
 *         name: assignedTeam
 *         required: true
 *         description: The team assigned to the checklists.
 *         schema:
 *           type: string
 *     security:
 *       - keycloak: [realm:PO]
 *     responses:
 *       200:
 *         description: All "Done" checklists submitted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 submittedChecklists:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: No completed checklists available for submission.
 *       500:
 *         description: Failed to submit checklists.
 */
// ✅ PO: Submit all "Done" checklists for their team 
app.post('/submission/:assignedTeam', keycloak.protect('realm:PO'), async (req, res) => {
    const { assignedTeam } = req.params;

    try {
        // Fetch all checklists that: 
        // 1) belong to the specified `assignedTeam`, 
        // 2) have the status `Done`, 
        // 3) either do not have the `submitted` attribute (they haven't been submitted yet) or have `submitted = false`
        const result = await dynamoDB.send(new ScanCommand({
            TableName: TABLE_NAME,
            // FilterExpression: "assignedTeam = :team AND #s = :done AND attribute_not_exists(submitted)",
            FilterExpression: "assignedTeam = :team AND #s = :done AND (attribute_not_exists(submitted) OR submitted = :notSubmitted)",
            ExpressionAttributeNames: {"#s": "status"},
            ExpressionAttributeValues: {
                ":team": { S: assignedTeam },
                ":done": { S: "Done" },
                ":notSubmitted": { BOOL: false }
            }
        }));

        const checklists = result.Items;

        if (!checklists || checklists.length === 0) {
            return res.status(400).json({ error: "No completed checklists available for submission." });
        }

        // ✅ Mark each checklist as "submitted"
        for (const checklist of checklists) {
            await dynamoDB.send(new UpdateItemCommand({
                TableName: TABLE_NAME,
                Key: {
                    id: checklist.id,
                    assignedTeam: checklist.assignedTeam
                },
                // Add `submitted` attribute & update timestamp
                UpdateExpression: "SET submitted = :submitted, submittedAt = :submittedAt",
                ExpressionAttributeValues: {
                    ":submitted": { BOOL: true },
                    ":submittedAt": { S: new Date().toISOString() }
                }
            }));
        }

        res.json({ message: "All 'Done' checklists submitted successfully!", submittedChecklists: checklists });
    } catch (error) {
        console.error("❌ Error submitting checklists:", error);
        res.status(500).json({ error: "Failed to submit checklists", details: error.message });
    }
});

/**
 * @swagger
 * /submissions:
 *   get:
 *     summary: View all submitted checklists.
 *     description: Fetches all checklists that are marked as submitted.
 *     tags:
 *       - CIO
 *     security:
 *       - keycloak: [realm:CIO]
 *     responses:
 *       200:
 *         description: A list of all submitted checklists.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       500:
 *         description: Failed to fetch submissions.
 */
// ✅ CIO: View all submitted checklists
app.get('/submissions', keycloak.protect('realm:CIO'), async (req, res) => {
    try {
        // Fetch all checklists that: 1) have the `submitted` attribute, and 2) `submitted` is set to `true`
        const result = await dynamoDB.send(new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: "attribute_exists(submitted) AND submitted = :submitted",
            ExpressionAttributeValues: { ":submitted": { BOOL: true } }
        }));

        res.json(result.Items || []); // Return the submitted checklists
    } catch (error) {
        console.error("❌ Error fetching submitted checklists:", error);
        res.status(500).json({ error: "Failed to fetch submissions", details: error.message });
    }
});

/**
 * @swagger
 * /submissions/{assignedTeam}:
 *   get:
 *     summary: View all submitted checklists for a specific team.
 *     description: Fetches all checklists for the specified team that are marked as submitted.
 *     tags:
 *       - PO
 *     parameters:
 *       - in: path
 *         name: assignedTeam
 *         required: true
 *         description: The team assigned to the checklists.
 *         schema:
 *           type: string
 *     security:
 *       - keycloak: [realm:PO]
 *     responses:
 *       200:
 *         description: A list of submitted checklists for the team.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       500:
 *         description: Failed to fetch submitted checklists.
 */
// ✅ PO: View all submitted checklists for their team
app.get('/submissions/:assignedTeam', keycloak.protect('realm:PO'), async (req, res) => {
    const { assignedTeam } = req.params;

    try {
        // Fetch checklists that: 1) belong to the team, 2) are marked as "submitted"
        const result = await dynamoDB.send(new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: "assignedTeam = :team AND submitted = :submitted",
            ExpressionAttributeValues: {
                ":team": { S: assignedTeam },
                ":submitted": { BOOL: true }
            }
        }));

        res.json(result.Items || []);
    } catch (error) {
        console.error("❌ Error fetching submitted checklists:", error);
        res.status(500).json({ error: "Failed to fetch submitted checklists", details: error.message });
    }
});

/**
 * @swagger
 * /submissions/{id}/{assignedTeam}/edit:
 *   put:
 *     summary: Modify a submitted checklist (title & description).
 *     description: Allows a PO to modify the title and description of a submitted checklist.
 *     tags:
 *       - PO
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the checklist.
 *         schema:
 *           type: string
 *       - in: path
 *         name: assignedTeam
 *         required: true
 *         description: The team assigned to the checklist.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: The title of the checklist.
 *               description:
 *                 type: string
 *                 description: The description of the checklist.
 *     security:
 *       - keycloak: [realm:PO]
 *     responses:
 *       200:
 *         description: Checklist updated successfully.
 *       400:
 *         description: Title and description are required.
 *       404:
 *         description: Checklist not found.
 *       500:
 *         description: Failed to update checklist.
 */
// ✅ PO: Modify submitted checklist (title & description)
app.put('/submissions/:id/:assignedTeam/edit', keycloak.protect('realm:PO'), async (req, res) => {
    const { id, assignedTeam } = req.params;
    const { title, description } = req.body;

    if (!title || !description) {
        return res.status(400).json({ error: "Title and Description are required" });
    }

    try {
        let result = await dynamoDB.send(new GetItemCommand({
            TableName: TABLE_NAME,
            Key: {
                id: { S: id },
                assignedTeam: { S: assignedTeam }
            }
        }));

        if (!result.Item) return res.status(404).json({ error: "Checklist not found" });

        await dynamoDB.send(new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: {
                id: { S: id },
                assignedTeam: { S: assignedTeam }
            },
            UpdateExpression: "SET title = :t, description = :d, updatedAt = :u",
            ExpressionAttributeValues: {
                ":t": { S: title },
                ":d": { S: description },
                ":u": { S: new Date().toISOString() }
            }
        }));
        
        res.json({ message: "Checklist updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to update checklist", details: error.message });
    }
});

// Start HTTPS Server
https.createServer(options, app).listen(PORT, () => {
    console.log(`✅ Checklist Service is running on HTTPS at https://checklist.planmeet.net:${PORT}`);
});