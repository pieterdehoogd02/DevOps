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
const { swaggerUi, swaggerSpec } = require('./swagger');

// AWS Secrets Manager Client 
const client = new SecretsManagerClient({
  region: "us-east-1",
  credentials: fromEnv()
});

// Initialize Express app
const app = express();
app.use(express.json());

console.log("Swagger Spec:", JSON.stringify(swaggerSpec, null, 2)); // Add this line to debug
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.disable('strict routing'); // Treat /test and /test/ as the same route

app.use(cors({
    origin: ['https://main.d1b3jmhnz9hi7t.amplifyapp.com', 'https://auth.planmeet.net'], // ✅ Allow only trusted origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // ✅ Allow necessary methods
    allowedHeaders: ['Content-Type', 'Authorization'], // ✅ Allow these headers
    credentials: true, // ✅ Allow cookies if needed
}));


// Load SSL certificates
const letsEncryptCA = fs.readFileSync('/usr/local/share/ca-certificates/ISRG_Root_X1.crt')

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
async function getServiceConfig() {
  try {

    console.log("🔍 Fetching Keycloak URL from AWS Secrets Manager...");

    // get all the necessary parameters for later requests to the keycloak server
    // url - domain of the keycloak instance, realm - organisation, clientID - application ID
    const keycloakUrl = await getSecretValue('KEYCLOAK_URL1');
    const keycloakRealm = await getSecretValue('KEYCLOAK_REALM');
    const keycloakClientID = await getSecretValue('KeycloakClientID');
    const authService = await getSecretValue('AUTH_SERVICE_SECRET');

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
    }))

    // ✅ Basic health check endpoint
    app.get('/', (req, res) => {
        res.send('Authentication Service is Running');
    });
    
    /**
     * @swagger
     * /auth/login/:
     *   post:
     *     summary: Authenticate user and obtain Keycloak access token
     *     tags:
     *       - Authentication
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - username
     *               - password
     *             properties:
     *               username:
     *                 type: string
     *                 example: testuser
     *               password:
     *                 type: string
     *                 example: password123
     *     responses:
     *       200:
     *         description: Successful authentication
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 access_token:
     *                   type: string
     *                 refresh_token:
     *                   type: string
     *                 expires_in:
     *                   type: integer
     *       400:
     *         description: Missing username or password
     *       500:
     *         description: Failed to authenticate
     */
    // ✅ User Login Endpoint
    app.post('/auth/login/', async (req, res) => {
        try {

        const { username, password } = req.body;

        // if missing username or password then return error
        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }


        // Fetching Keycloak client secret from AWS Secrets Manager
        const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
        const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

        // Request a token from Keycloak
        const response = await axios.post(
            `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
            new URLSearchParams({
              client_id: keycloakClientID,
              client_secret: clientSecret,  // ✅ Include the client_secret
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
    app.get('/user/', keycloak.protect(), (req, res) => {
        res.json({
            message: 'User Authenticated',
            user: req.kauth.grant.access_token.content // Return user data from Keycloak
        });
    });

    /**
     * @swagger
     * /getUserRoles/:
     *   get:
     *     summary: Retrieve Keycloak roles assigned to a specific user
     *     tags:
     *       - User Management
     *     security:
     *       - bearerAuth: []  # Indicates this endpoint requires a Bearer token (Keycloak)
     *     parameters:
     *       - in: query
     *         name: userId
     *         required: true
     *         schema:
     *           type: string
     *         description: The ID of the user in Keycloak whose roles you want to retrieve
     *     responses:
     *       200:
     *         description: Successfully retrieved user roles
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   id:
     *                     type: string
     *                   name:
     *                     type: string
     *                   description:
     *                     type: string
     *       400:
     *         description: Missing or invalid userId
     *       401:
     *         description: Unauthorized - missing or invalid token
     *       500:
     *         description: Internal server error
     */
    // endpoint where we get roles of a user
    app.get('/getUserRoles/', keycloak.protect(), async (req, res) => {
      try {

        
        const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
        const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

        // get user id
        const searchedId = req.query.userId

        // Step 1: Get Admin Token
        const tokenResponse = await axios.post(
            `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: "client_credentials",
                client_id: keycloakClientID,
                client_secret: clientSecret,
            }),
            { 
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              httpsAgent: agent  // ✅ Use HTTPS agent }
            }
        );

        const adminToken = tokenResponse.data.access_token;

        // Step 2: get the user data associated with a particular client (application)
        const rolesUser = await axios.get(
          `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${encodeURIComponent(searchedId)}/role-mappings/clients/${keycloakClientID}`,
          {
            headers: { Authorization: `Bearer ${adminToken}` },
          }
        );
        
        // get roles data
        const roles = rolesUser.data;

        return { roles };
      } catch(err) {
        console.error("Error: " + err)
      }
    });

    /**
     * @swagger
     * /getUserGroups/:
     *   get:
     *     summary: Retrieve all Keycloak groups the user belongs to
     *     tags:
     *       - User Management
     *     security:
     *       - bearerAuth: []  # Uses Keycloak access token
     *     parameters:
     *       - in: query
     *         name: userId
     *         required: true
     *         schema:
     *           type: string
     *         description: The Keycloak user ID whose groups will be retrieved
     *     responses:
     *       200:
     *         description: Successfully retrieved user groups
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   id:
     *                     type: string
     *                   name:
     *                     type: string
     *                   path:
     *                     type: string
     *       400:
     *         description: Missing or invalid userId
     *       401:
     *         description: Unauthorized - missing or invalid token
     *       500:
     *         description: Internal server error
     */
    // endpoint where we get groups of a user
     app.get('/getUserGroups/', keycloak.protect(), async (req, res) => {
      try {
        // get keycloakSecret & clientSecret
        const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  
        const clientSecret = keycloakSecret.Keycloak_Client_Secret; 
        
        // get id of the desired user from the query params
        const searchedId = req.query.userId

        // Step 1: Get Admin Token
        const tokenResponse = await axios.post(
            `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: "client_credentials",
                client_id: keycloakClientID,
                client_secret: clientSecret,
            }),
            { 
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              httpsAgent: agent  // ✅ Use HTTPS agent }
            }
        );
        // get admin token
        const adminToken = tokenResponse.data.access_token;

        // get groups user by making a request at the keycloak instance domain and the realm
        // based on user id given by the user request.  
        const groupsUser = await axios.get(
          `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${encodeURIComponent(searchedId)}/groups`,
          {
            headers: { Authorization: `Bearer ${adminToken}` },
          }
        );
        
        // get user data from the response
        const groups = groupsUser.data;

        return { groups };
      } catch(err) {
        console.error("Error: " + err)
      }
    });
   
    /**
     * @swagger
     * /getUserData/:
     *   get:
     *     summary: Retrieve full user data including basic info, groups, and roles
     *     tags:
     *       - User Management
     *     security:
     *       - bearerAuth: []  # Requires Keycloak access token
     *     parameters:
     *       - in: query
     *         name: userId
     *         required: true
     *         schema:
     *           type: string
     *         description: The Keycloak user ID to fetch data for
     *     responses:
     *       200:
     *         description: Successfully retrieved user data
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 user:
     *                   type: object
     *                   description: Basic user profile info from Keycloak
     *                 roles:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       name:
     *                         type: string
     *                 groups:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       id:
     *                         type: string
     *                       name:
     *                         type: string
     *                       path:
     *                         type: string
     *       400:
     *         description: Missing or invalid userId
     *       401:
     *         description: Unauthorized - invalid or missing token
     *       500:
     *         description: Internal server error
     */
    app.get('/getUserData/', keycloak.protect(), async (req, res) => {
      try {


        const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
        const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

        // get user id from the query params
        const searchedId = req.query.userId

        // Step 1: Get Admin Token
        const tokenResponse = await axios.post(
            `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
            new URLSearchParams({
                grant_type: "client_credentials",
                client_id: keycloakClientID,
                client_secret: clientSecret,
            }),
            { 
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              httpsAgent: agent  // ✅ Use HTTPS agent }
            }
        );

        const adminToken = tokenResponse.data.access_token;

        // get information about a user
        const userResponse = await axios.get(
          `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${encodeURIComponent(searchedId)}`,
          {
            headers: { Authorization: `Bearer ${adminToken}` },
          }
        );

        // get user groups
        const groupsUser = await axios.get(
          `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${searchedId}/groups`,
          {
            headers: { Authorization: `Bearer ${adminToken}` },
          }
        );
        
        // get user roles
        const rolesUser = await axios.get(
            `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${searchedId}/role-mappings/realm`,
            {
                headers: { Authorization: `Bearer ${adminToken}` },
                httpsAgent: agent // If using a custom HTTPS agent
            }
        );

        const user = userResponse.data;
        const roles = rolesUser.data;
        const groups = groupsUser.data;

        // return all of the data compiled
        return res.json({ "user": user, "roles": roles, "groups": groups});
      } catch(err) {
        console.error("Error: " + err)
        return res.status(500).json({ error: "Internal Server Error", details: err.toString() });
      }
    });

    /**
     * @swagger
     * /project/members/:
     *   get:
     *     summary: Retrieve all users assigned to the Keycloak realm
     *     tags:
     *       - User Management
     *     security:
     *       - bearerAuth: []  # Requires Keycloak access token
     *     responses:
     *       200:
     *         description: List of users in the Keycloak realm
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 users:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       id:
     *                         type: string
     *                         description: Unique user ID
     *                       username:
     *                         type: string
     *                         description: Keycloak username
     *                       email:
     *                         type: string
     *                         description: User's email
     *                       firstName:
     *                         type: string
     *                       lastName:
     *                         type: string
     *       401:
     *         description: Unauthorized - invalid or missing token
     *       500:
     *         description: Internal server error
     */
    // Assume we only have one client for now
    // ✅ Protected route: Retrieve user info 
    app.get('/project/members/', keycloak.protect(), async (req, res) => {
      try {

          const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
          const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

          // Step 1: Get Admin Token
          const tokenResponse = await axios.post(
              `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
              new URLSearchParams({
                  grant_type: "client_credentials",
                  client_id: keycloakClientID,
                  client_secret: clientSecret,
              }),
              { 
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                httpsAgent: agent  // ✅ Use HTTPS agent }
              }
          );

          const adminToken = tokenResponse.data.access_token;

          // Step 2: Get Users Assigned to This Client
          const usersResponse = await axios.get(
              `${keycloakUrl}/admin/realms/${keycloakRealm}/users`,
              { 
                headers: { Authorization: `Bearer ${adminToken}` },
                httpsAgent: agent
              }
          );

          return res.json({"users" : usersResponse.data});
      } catch (error) {
          console.error("Error fetching client users:", error);
          res.status(500).json({ error: "Internal Server Error" });
      }
    });

    /**
     * @swagger
     * /groups/:
     *   get:
     *     summary: Retrieve all groups from the Keycloak realm
     *     tags:
     *       - Group Management
     *     security:
     *       - bearerAuth: []  # Requires Keycloak access token
     *     responses:
     *       200:
     *         description: Successfully retrieved list of groups
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 groups:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       id:
     *                         type: string
     *                         description: Unique group ID
     *                       name:
     *                         type: string
     *                         description: Name of the group
     *                       path:
     *                         type: string
     *                         description: Full path of the group
     *       401:
     *         description: Unauthorized - invalid or missing token
     *       500:
     *         description: Internal server error
     */
    app.get('/groups/', keycloak.protect(), async (req, res) => {
      try {

          // SHOULD GET ALL THE REALM NAMES AND IDs in order to check which is which

          const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
          const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

          // Step 1: Get Admin Token
          const tokenResponse = await axios.post(
              `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
              new URLSearchParams({
                  grant_type: "client_credentials",
                  client_id: keycloakClientID,
                  client_secret: clientSecret,
              }),
              { 
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                httpsAgent: agent  // ✅ Use HTTPS agent }
              }
          );

          const adminToken = tokenResponse.data.access_token;

          // Step 2: Get Groups Assigned to the realm
          const groupsResponse = await axios.get(
              `${keycloakUrl}/admin/realms/${keycloakRealm}/groups`,
              { 
                headers: { Authorization: `Bearer ${adminToken}` },
                httpsAgent: agent
              }
          );

          return res.json({"groups" : groupsResponse.data});
      } catch (error) {
          console.error("Error fetching client users:", error);
          res.status(500).json({ error: "Internal Server Error" });
      }
    });

    /**
     * @swagger
     * /roles/:
     *   get:
     *     summary: Retrieve all roles defined in the Keycloak realm
     *     tags:
     *       - Role Management
     *     security:
     *       - bearerAuth: []  # Requires Keycloak access token
     *     responses:
     *       200:
     *         description: Successfully retrieved list of roles
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 roles:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       id:
     *                         type: string
     *                         description: Role ID
     *                       name:
     *                         type: string
     *                         description: Role name
     *                       description:
     *                         type: string
     *                         description: Description of the role
     *       401:
     *         description: Unauthorized - invalid or missing token
     *       500:
     *         description: Internal server error
     */
    // Get all the roles from a realm
    app.get('/roles/', keycloak.protect(), async (req, res) => {
      try {

          const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
          const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

          // Step 1: Get Admin Token
          const tokenResponse = await axios.post(
              `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
              new URLSearchParams({
                  grant_type: "client_credentials",
                  client_id: keycloakClientID,
                  client_secret: clientSecret,
              }),
              { 
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                httpsAgent: agent  // ✅ Use HTTPS agent }
              }
          );

          const adminToken = tokenResponse.data.access_token;

          // Step 2: Get Users roles from this realm
          const rolesResponse = await axios.get(
              `${keycloakUrl}/admin/realms/${keycloakRealm}/roles`,
              { 
                headers: { Authorization: `Bearer ${adminToken}` },
                httpsAgent: agent
              }
          );

          // return roles
          return res.json({"roles" : rolesResponse.data});
      } catch (error) {
          console.error("Error fetching client users:", error);
          res.status(500).json({ error: "Internal Server Error" });
      }
    });
    
    /**
     * @swagger
     * /assign-team/:
     *   post:
     *     summary: Assign a user to a team (CIO only)
     *     tags:
     *       - Team Management
     *     security:
     *       - bearerAuth: []  # Requires CIO token
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - userId
     *               - teamName
     *             properties:
     *               userId:
     *                 type: string
     *                 description: ID of the user to assign
     *                 example: "3f981f60-bf56-4f8f-bec4-8d52c558eae9"
     *               teamName:
     *                 type: string
     *                 description: Name of the team (group) to assign user to
     *                 example: "dev_team_1"
     *     responses:
     *       200:
     *         description: User successfully assigned to the team
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                   example: "✅ User 3f981f60-bf56-4f8f-bec4-8d52c558eae9 assigned to team dev_team_1"
     *       400:
     *         description: Missing userId or teamName
     *       403:
     *         description: Access denied - user is not CIO
     *       404:
     *         description: Specified team not found
     *       500:
     *         description: Internal server error
     */
    // ✅ Assign a user to a team (CIO only)
    app.post('/assign-team/', keycloak.protect('realm:CIO'), async (req, res) => {
        try {

            const roles = req.kauth.grant.access_token.content.realm_access.roles;
            // if the roles of the token include CIO then continue else return unauthorized
            if (!roles.includes("CIO")) {
                return res.status(403).json({ error: "Access Denied" });
            }
            
            const { userId, teamName } = req.body;
            // make sure the request body has both userID or teamName otherwise return error Bad request
            if (!userId || !teamName) {
                return res.status(400).json({ error: "User ID and Team Name are required" });
            }
            

            const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
            const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

            // get Keycloak token
            const tokenResponse = await axios.post(
                `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: "client_credentials",
                    client_id: keycloakClientID,
                    client_secret: clientSecret,
                }),
                { 
                  headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  httpsAgent: agent  // ✅ Use HTTPS agent }
                }
            );

            const adminToken = tokenResponse.data.access_token;

            // Get Groups of the realm
            const groupsResponse = await axios.get(
                `${keycloakUrl}/admin/realms/${keycloakRealm}/groups`,
                { 
                  headers: { Authorization: `Bearer ${adminToken}` },
                  httpsAgent: agent
                }
            );

            // if there is a group that has the same name as the query string then return it
            const team = groupsResponse.data.find(group => group.name === teamName);
            if (!team) return res.status(404).json({ error: "Team not found" }); // if there isn't one then return 404
            
            // assign the user to the desired team
            await axios.put(
              `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${userId}/groups/${team.id}`,
              {}, // Empty body as PUT to this endpoint doesn't require data
              {
                headers: { Authorization: `Bearer ${adminToken}` },
                httpsAgent: agent
              }
            )

            // if successful return
            res.json({ message: `✅ User ${userId} assigned to team ${teamName}` });
        } catch (error) {
            res.status(500).json({ error: "❌ Failed to assign user to team", details: error.response?.data || error.message });
        }
    }); 

    /**
     * @swagger
     * /delete-group/:
     *   post:
     *     summary: Remove a user from a group (CIO only)
     *     tags:
     *       - Team Management
     *     security:
     *       - bearerAuth: []  # Requires CIO token
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - userId
     *               - group1
     *             properties:
     *               userId:
     *                 type: string
     *                 description: ID of the user to remove
     *                 example: "3f981f60-bf56-4f8f-bec4-8d52c558eae9"
     *               group1:
     *                 type: object
     *                 description: Group to remove the user from
     *                 properties:
     *                   name:
     *                     type: string
     *                     example: "dev_team_1"
     *     responses:
     *       200:
     *         description: User successfully removed from the group
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                   example: "✅ User 3f981f60-bf56-4f8f-bec4-8d52c558eae9 deleted from group dev_team_1"
     *       400:
     *         description: Missing userId or group1 in request
     *       403:
     *         description: Access denied - user is not CIO
     *       404:
     *         description: Group not found
     *       500:
     *         description: Internal server error
     */
    // ✅ Assign a user to a team (CIO only)
    app.post('/delete-group/', keycloak.protect('realm:CIO'), async (req, res) => {
        try {

            const roles = req.kauth.grant.access_token.content.realm_access.roles;
            // if not CIO then return error
            if (!roles.includes("CIO")) {
                return res.status(403).json({ error: "Access Denied" });
            }
            
            const { userId, group1 } = req.body;
            // if request does not have userId in body or group then return error
            if (!userId || !group1) {
                return res.status(400).json({ error: "User ID and group Name are required" });
            }
            
            const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
            const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

            // get Keycloak admin token
            const tokenResponse = await axios.post(
                `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: "client_credentials",
                    client_id: keycloakClientID,
                    client_secret: clientSecret,
                }),
                { 
                  headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  httpsAgent: agent  // ✅ Use HTTPS agent }
                }
            );

            const adminToken = tokenResponse.data.access_token;

            // Get groups
            const groupsResponse = await axios.get(
                `${keycloakUrl}/admin/realms/${keycloakRealm}/groups`,
                { 
                  headers: { Authorization: `Bearer ${adminToken}` },
                  httpsAgent: agent
                }
            );

            // find a group that matches the groupname mentioned in the query and return it
            const group = groupsResponse.data.find(group => group.name === group1.name);
            if (!group) return res.status(404).json({ error: "group not found" }); // if nothing found return 404
            
            // unassign the user from the group
            await axios.delete(
              `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${userId}/groups/${group.id}`,
              {
                headers: { Authorization: `Bearer ${adminToken}` },
                httpsAgent: agent
              }
            )
            
            // return if successful
            res.json({ message: `✅ User ${userId} deleted from group ${group1}` });
        } catch (error) {
            res.status(500).json({ error: "❌ Failed to delete user to group", details: error.response?.data || error.message });
        }
    }); 

    /**
     * @swagger
     * /assign-role/:
     *   post:
     *     summary: Assign a role to a user (CIO only)
     *     tags:
     *       - Role Management
     *     security:
     *       - bearerAuth: []  # CIO authorization required
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - userId
     *               - roleName
     *             properties:
     *               userId:
     *                 type: string
     *                 description: ID of the user to assign the role to
     *                 example: "e01f1451-94e5-41a2-b015-03f2142b83a3"
     *               roleName:
     *                 type: string
     *                 description: Name of the role to assign
     *                 example: "PO"
     *     responses:
     *       200:
     *         description: Role successfully assigned to user
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                   example: "✅ User e01f1451-94e5-41a2-b015-03f2142b83a3 assigned to role PO"
     *       400:
     *         description: Missing userId or roleName
     *       403:
     *         description: Access denied (not a CIO)
     *       404:
     *         description: Role not found
     *       500:
     *         description: Internal server error
     */
    // ✅ Assign a user to a team (CIO only)
    app.post('/assign-role/', keycloak.protect('realm:CIO'), async (req, res) => {
        try {

            const roles = req.kauth.grant.access_token.content.realm_access.roles;
            // if not user does not have the CIO role  return error
            if (!roles.includes("CIO")) {
                return res.status(403).json({ error: "Access Denied" });
            }
            
            const { userId, roleName } = req.body;
            // if the request body does not have userId or roleName then return error
            if (!userId || !roleName) {
                return res.status(400).json({ error: "User ID and role Name are required" });
            }
            

            const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
            const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

            // get admin token
            const tokenResponse = await axios.post(
                `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: "client_credentials",
                    client_id: keycloakClientID,
                    client_secret: clientSecret,
                }),
                { 
                  headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  httpsAgent: agent  // ✅ Use HTTPS agent }
                }
            );

            const adminToken = tokenResponse.data.access_token;

            // Get realm roles
            const rolesResponse = await axios.get(
                `${keycloakUrl}/admin/realms/${keycloakRealm}/roles`,
                { 
                  headers: { Authorization: `Bearer ${adminToken}` },
                  httpsAgent: agent
                }
            );

            // find a role that matches the rolename
            const role = rolesResponse.data.find(role => role.name === roleName);
            if (!role) return res.status(404).json({ error: "role not found" }); // if not found return 404
            
            // assign user to role
            await axios.post(
                `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${userId}/role-mappings/realm`,
                [role], // Array of role objects
                { headers: { "Authorization": `Bearer ${adminToken}` },
                  httpsAgent: agent
                }
            );
            
            // return 200 if successful
            res.json({ message: `✅ User ${userId} assigned to role ${roleName}` });
        } catch (error) {
            res.status(500).json({ error: "❌ Failed to assign user to role", details: error.response?.data || error.message });
        }
    }); 

    /**
     * @swagger
     * /delete-role/:
     *   post:
     *     summary: Remove a role from a user (CIO only)
     *     tags:
     *       - Role Management
     *     security:
     *       - bearerAuth: []  # CIO access required
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - userId
     *               - role
     *             properties:
     *               userId:
     *                 type: string
     *                 description: ID of the user from whom the role will be removed
     *                 example: "12345678-90ab-cdef-1234-567890abcdef"
     *               role:
     *                 type: object
     *                 properties:
     *                   name:
     *                     type: string
     *                     description: Name of the role to remove
     *                     example: "PO"
     *     responses:
     *       200:
     *         description: Role successfully removed from user
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                   example: "✅ User 12345678-90ab-cdef-1234-567890abcdef deleted from role PO"
     *       400:
     *         description: Missing userId or role
     *       403:
     *         description: Access denied (not a CIO)
     *       404:
     *         description: Role not found
     *       500:
     *         description: Internal server error
     */
     // ✅ Assign a user to a team (CIO only)
    app.post('/delete-role/', keycloak.protect('realm:CIO'), async (req, res) => {
        try {

            const roles = req.kauth.grant.access_token.content.realm_access.roles;
            // if role does not include CIO return error
            if (!roles.includes("CIO")) {
                return res.status(403).json({ error: "Access Denied" });
            }
            
            const { userId, role } = req.body;
            // if userId or role not in body then return error
            if (!userId || !role) {
                return res.status(400).json({ error: "User ID and group Name are required" });
            }
            
            const keycloakSecret = await getSecretValue('Keycloak_Client_Secret');  // ✅ Fetch secret
            const clientSecret = keycloakSecret.Keycloak_Client_Secret;  // ✅ Ensure this matches your AWS secret key

            // get admin token
            const tokenResponse = await axios.post(
                `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: "client_credentials",
                    client_id: keycloakClientID,
                    client_secret: clientSecret,
                }),
                { 
                  headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  httpsAgent: agent  // ✅ Use HTTPS agent }
                }
            );

            const adminToken = tokenResponse.data.access_token;

            // get realm roles
            const rolesResponse = await axios.get(
                `${keycloakUrl}/admin/realms/${keycloakRealm}/roles`,
                { 
                  headers: { Authorization: `Bearer ${adminToken}` },
                  httpsAgent: agent
                }
            );

            // if role matches the rolename from the query return it
            const role1 = rolesResponse.data.find(r => r.name === role.name);
            if (!role1) return res.status(404).json({ error: "role not found" }); // if not found then return 404 
            
            // delete client with userId from the specified role
            await axios.delete(
              `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${userId}/role-mappings/realm`,
                {
                  headers: { Authorization: `Bearer ${adminToken}` },
                  httpsAgent: agent,
                  data: [role1]
                }
            );

            // return 200 if successful 
            res.json({ message: `✅ User ${userId} deleted from role ${role1.name}` });
        } catch (error) {
            res.status(500).json({ error: "❌ Failed to delete user to role", details: error.response?.data || error.message });
        }
    }); 

    // Start the server after Keycloak is initialized
    app.listen(5001, '0.0.0.0', () => {
        console.log(`✅ Authentication service running on ${authServiceUrl}`);
    });
}



// Run the initialization function to set up the app
initializeApp().catch(error => {
  console.error("Error initializing app", error);
  process.exit(1); // Exit with an error if initialization fails
})
