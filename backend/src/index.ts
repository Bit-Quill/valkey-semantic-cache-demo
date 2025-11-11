import express, { Request, Response } from "express";
import { uptime } from "os";

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware - parse requests with JSON body
app.use(express.json());

// Basic route
app.get("/", (_: Request, res: Response) => {
  res.json({ message: "Airline Helpdesk API" });
});

// Health check endpoint
app.get("/health", (_: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
