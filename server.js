const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { dbConnect } = require("./config/mongoose-connection");
const transactionRoutes = require("./routes/transactionRoutes");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 5000;

// Load environment variables
require("dotenv").config();

// Middleware
app.use(express.json());
app.use(cors({
    origin: 'https://tap-ins.vercel.app',
    credentials: true
}));
app.use(cookieParser());

// Database connection
dbConnect();

// Use the routes
app.use("/api", transactionRoutes);

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    const url = "https://tapinsbackend-production.up.railway.app";
    setInterval(async () => {
        try {
          await axios.get(url);
          console.log("Pinged server to keep it awake ⏳");
        } catch (err) {
          console.error("Ping failed:", err.message);
        }
    }, 5 * 60 * 1000); // every 5 minutes
});
