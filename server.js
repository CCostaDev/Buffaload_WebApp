import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import NodeCache from "node-cache";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

const vehicleCache = new NodeCache({ stdTTL: 60 });

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

//Periodically refresh cache with API data
async function refreshCache() {
  const data = await fetchVehicleData();
  if (data) {
    vehicleCache.set("vehicles", data);
  }
}

//Fetch data immediately when the server starts
refreshCache();

//Set up interval to refresh cache periodically
setInterval(refreshCache, 60000);

app.get("/api/vehicles", (req, res) => {
  const cachedVehicles = vehicleCache.get("vehicles");

  if (cachedVehicles) {
    res.json(cachedVehicles);
  } else {
    res
      .status(503)
      .json({ message: "Service unavailable, please try again later." });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
