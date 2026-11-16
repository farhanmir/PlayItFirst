// A single cross-platform production entry point for npm start and Render.
process.env.NODE_ENV = "production";
await import("./main.ts");
export {};
