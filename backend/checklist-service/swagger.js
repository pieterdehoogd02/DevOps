const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// Swagger configuration
const swaggerOptions = {
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
            },
        ],
    },
    apis: ["./src/server.js"], // Point to the file where your API routes are defined
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = { swaggerUi, swaggerDocs };
