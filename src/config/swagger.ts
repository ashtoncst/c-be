// src/config/swagger.ts
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Converge Global Backend API",
      version: "1.0.0",
      description: "API documentation for Converge Global Backend - Telecommunications Services",
      contact: {
        name: "Converge Development Team",
        email: "dev@converge.com"
      }
    },
    servers: [
      {
        url: "http://localhost:3000/api",
        description: "Development server"
      },
      {
        url: "https://converge-global-be-676745031303.asia-southeast1.run.app/api",
        description: "Production server"
      }
    ],
    components: {
      schemas: {
        ChatRequest: {
          type: "object",
          required: ["session_id", "message"],
          properties: {
            session_id: {
              type: "string",
              description: "Unique session identifier for the conversation"
            },
            message: {
              type: "string",
              description: "User's message to the chatbot"
            }
          }
        },
        ChatResponse: {
          type: "object",
          properties: {
            reply: {
              type: "string",
              description: "AI-generated response"
            },
            recommended_products: {
              type: "array",
              items: {
                $ref: "#/components/schemas/ProductRecommendation"
              }
            },
            session_id: {
              type: "string"
            },
            conversation_context: {
              type: "string"
            }
          }
        },
        ProductRecommendation: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            name: {
              type: "string"
            },
            description: {
              type: "string"
            },
            price: {
              type: "string"
            },
            contract_term: {
              type: "string"
            },
            target_audience: {
              type: "string"
            },
            product_category: {
              type: "string"
            },
            features: {
              type: "array",
              items: {
                type: "string"
              }
            }
          }
        },
        Product: {
          type: "object",
          properties: {
            id: {
              type: "integer"
            },
            name: {
              type: "string"
            },
            description: {
              type: "string"
            },
            price: {
              type: "string"
            },
            contract_term: {
              type: "string"
            },
            target_audience: {
              type: "string"
            },
            product_category: {
              type: "string"
            },
            category_description: {
              type: "string"
            },
            created_at: {
              type: "string",
              format: "date-time"
            },
            updated_at: {
              type: "string",
              format: "date-time"
            }
          }
        },
        ProductList: {
          type: "object",
          properties: {
            products: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Product"
              }
            },
            total: {
              type: "integer"
            },
            limit: {
              type: "integer"
            },
            offset: {
              type: "integer"
            }
          }
        },
        TargetAudience: {
          type: "object",
          properties: {
            id: {
              type: "integer"
            },
            name: {
              type: "string"
            }
          }
        },
        ProductCategory: {
          type: "object",
          properties: {
            id: {
              type: "integer"
            },
            name: {
              type: "string"
            },
            description: {
              type: "string"
            }
          }
        }
      }
    },
    websockets: {
      chat: {
        description: "Real-time chat with AI assistant",
        url: "ws://localhost:3000",
        events: {
          "chat_message": {
            description: "Send a message to the AI assistant",
            payload: {
              $ref: "#/components/schemas/ChatRequest"
            }
          },
          "token": {
            description: "Streaming response tokens from AI",
            payload: {
              type: "object",
              properties: {
                payload: {
                  type: "string"
                }
              }
            }
          },
          "recommendations": {
            description: "Product recommendations",
            payload: {
              type: "object",
              properties: {
                payload: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/ProductRecommendation"
                  }
                }
              }
            }
          },
          "end": {
            description: "End of response stream"
          },
          "error": {
            description: "Error response",
            payload: {
              type: "object",
              properties: {
                type: {
                  type: "string"
                },
                payload: {
                  type: "string"
                }
              }
            }
          }
        }
      }
    }
  },
  apis: [
    "./src/routes/*.ts", // or .js if compiled
    "./src/controllers/*.ts"
  ]
};

const swaggerSpec = swaggerJsdoc(options);

export { swaggerUi, swaggerSpec };