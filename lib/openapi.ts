/**
 * OpenAPI 3.0 spec dla API zewnętrznego (Channel Manager, posting).
 */

export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Hotel PMS API",
    description: "API zewnętrzne dla integracji (dostępność, obciążenia).",
    version: "1.0.0",
  },
  servers: [{ url: "/api/v1", description: "Bazowy URL API" }],
  paths: {
    "/external/availability": {
      get: {
        summary: "Dostępność pokoi",
        description: "Dla Channel Managera: dostępność pokoi w podanym zakresie dat.",
        parameters: [
          { name: "from", in: "query", required: true, schema: { type: "string", format: "date" }, description: "Data od (YYYY-MM-DD)" },
          { name: "to", in: "query", required: true, schema: { type: "string", format: "date" }, description: "Data do (YYYY-MM-DD)" },
          { name: "roomType", in: "query", required: false, schema: { type: "string" }, description: "Filtr po typie pokoju" },
        ],
        security: [{ ApiKeyAuth: [] }],
        responses: {
          "200": {
            description: "Lista dostępnych pokoi",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    rooms: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          number: { type: "string" },
                          type: { type: "string" },
                          price: { type: "number" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Błędne parametry" },
          "401": { description: "Brak lub nieprawidłowy klucz API" },
        },
      },
    },
    "/external/posting": {
      post: {
        summary: "Obciążenie rezerwacji/pokoju",
        description: "Obciążenie pokoju lub rezerwacji kwotą (np. z POS, system konferencyjny).",
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amount"],
                properties: {
                  reservationId: { type: "string", description: "ID rezerwacji" },
                  roomNumber: { type: "string", description: "Numer pokoju (gdy brak reservationId)" },
                  amount: { type: "number", description: "Kwota do obciążenia (PLN)" },
                  type: { type: "string", default: "POSTING", description: "Typ transakcji" },
                  description: { type: "string", description: "Opis pozycji" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Obciążenie zarejestrowane",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    transactionId: { type: "string" },
                    reservationId: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { description: "Błędne dane" },
          "401": { description: "Brak lub nieprawidłowy klucz API" },
          "404": { description: "Rezerwacja lub pokój nie istnieje" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description: "Klucz API (EXTERNAL_API_KEY). Alternatywnie: Authorization: Bearer <key>",
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
} as const;
