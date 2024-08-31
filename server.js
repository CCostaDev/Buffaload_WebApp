import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());

const apiURL = `https://api.masternautconnect.com/connect-webservices/services/public/v1/customer/${process.env.API_CUSTOMER_ID}/tracking/live`;
const username = process.env.API_USERNAME;
const password = process.env.API_PASSWORD;

// Basic auth credentials
const credentials = Buffer.from(`${username}:${password}`).toString("base64");

// Function to fetch vehicle data from the API
async function fetchVehicleData() {
  const response = await fetch(apiURL, {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    throw new Error(`API responded with status ${response.status}`);
  }

  return await response.json();
}

// Default route to confirm server is running
app.get("/", (req, res) => {
  res.send("Server is up and running!");
});

// Route to handle the favicon request to avoid 404 errors
app.get("/favicon.ico", (req, res) => {
  res.status(204).end(); // No content
});

// API route to fetch vehicle data
app.get("/api/vehicles", async (req, res) => {
  try {
    const data = await fetchVehicleData();
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate");
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching vehicle data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Export the app as the default export
export default app;

// Also export as a lambda handler for Vercel (just in case)
export const handler = (req, res) => {
  app(req, res);
};
