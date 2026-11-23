export function openApiSpec(appUrl: string) {
  const credential = {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      url: { type: "string", format: "uri" },
      achievement_id: { type: "string", format: "uuid" },
      achievement_name: { type: "string" },
      recipient: { type: "object", properties: { email: { type: "string" }, name: { type: "string" }, student_id: { type: "string", nullable: true } } },
      issued_at: { type: "string", format: "date-time" },
      expires_at: { type: "string", format: "date-time", nullable: true },
      claimed_at: { type: "string", format: "date-time", nullable: true },
      revoked_at: { type: "string", format: "date-time", nullable: true },
      revocation_reason: { type: "string", nullable: true },
      vc_jwt: { type: "string", description: "Signed Open Badges 3.0 credential (VC-JWT)" },
    },
  };
  const err = { description: "Error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
  return {
    openapi: "3.1.0",
    info: {
      title: "Meritbox API",
      version: "1.0.0",
      description: "Issue, manage and verify Open Badges 3.0 credentials. Authenticate with an API key created under Dashboard → API & webhooks.",
    },
    servers: [{ url: `${appUrl}/api/v1` }],
    components: {
      securitySchemes: { apiKey: { type: "http", scheme: "bearer", description: "mbx_live_… key" } },
      schemas: {
        Credential: credential,
        Error: { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } } } } },
      },
    },
    security: [{ apiKey: [] }],
    paths: {
      "/achievements": {
        get: { summary: "List achievements", description: "Scope: achievements:read", responses: { "200": { description: "OK" }, "401": err } },
      },
      "/credentials": {
        get: {
          summary: "List credentials",
          description: "Scope: credentials:read. Cursor pagination, newest first.",
          parameters: [
            { name: "email", in: "query", schema: { type: "string" } },
            { name: "achievement_id", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", maximum: 200, default: 50 } },
            { name: "cursor", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "OK" }, "401": err },
        },
        post: {
          summary: "Issue a credential",
          description: "Scope: credentials:issue. The achievement must be published.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["achievement_id", "recipient"],
                  properties: {
                    achievement_id: { type: "string", format: "uuid" },
                    recipient: {
                      type: "object",
                      required: ["email", "name"],
                      properties: { email: { type: "string" }, name: { type: "string" }, usi: { type: "string", description: "Unique Student Identifier (encrypted at rest)" }, student_id: { type: "string" } },
                    },
                    issued_on: { type: "string", format: "date" },
                    evidence_url: { type: "string", format: "uri" },
                    narrative: { type: "string" },
                    notify: { type: "boolean", default: true, description: "Email the learner a claim link" },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Issued", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Credential" } } } } } }, "409": err, "422": err },
        },
      },
      "/credentials/{id}": {
        get: { summary: "Get a credential", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" }, "404": err } },
      },
      "/credentials/{id}/revoke": {
        post: {
          summary: "Revoke a credential",
          description: "Scope: credentials:revoke. Updates the issuer's Bitstring Status List immediately.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["reason"], properties: { reason: { type: "string" } } } } } },
          responses: { "200": { description: "Revoked" }, "404": err },
        },
      },
      "/verify": {
        post: {
          summary: "Verify a credential (public, no key needed)",
          security: [],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["credential"], properties: { credential: { type: "string", description: "VC-JWT" } } } } } },
          responses: { "200": { description: "Verification result with individual checks" }, "429": err },
        },
      },
    },
  };
}
