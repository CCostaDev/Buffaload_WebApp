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

async function fetchVehicleData() {
  try {
    const response = await fetch(apiURL, {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching vehicle data:", error);
    return null;
  }
}

app.get("/api/vehicles", async (req, res) => {
  try {
    const data = await fetchVehicleData();
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate");
    res.json(data);
  } catch (error) {
    res
      .status(503)
      .json({ message: "Service unavailable, please try again later." });
  }
});

export default app;
