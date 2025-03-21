const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// Swagger Configuration
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API Documentation",
      version: "1.0.0",
      description: "API documentation for our backend services",
    },
    servers: [
      {
        url: "https://auth.planmeet.net",
        description: "Production Server",
      },
    ],
  },
  apis: ["./src/server.js"], // Include the file where API endpoints are defined
};

// Generate Swagger Specification
const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerUi, swaggerSpec };
