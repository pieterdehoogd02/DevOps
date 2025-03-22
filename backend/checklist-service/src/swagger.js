const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// Swagger configuration
const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Checklist Microservice API",
            version: "1.0.0",
            description: "API documentation for Checklist Microservice",
        },
        servers: [
            {
                url: "https://checklist.planmeet.net", // Update with your actual API URL
                description: "Checklist server",
            },
        ],
    },
    apis: ["./src/server.js"], // Point to the file where your API routes are defined
};

const swaggerSpec = swaggerJsDoc(options);

module.exports = { swaggerUi, swaggerSpec };
