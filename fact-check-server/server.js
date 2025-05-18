const express = require("express");
const puppeteer = require("puppeteer");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://bakery-de534-default-rtdb.firebaseio.com"
});

const db = admin.database();
const app = express();

app.use(express.json());

app.listen(3000, () => console.log("Server running on port 3000"));

app.post("/fact-check", async (req, res) => {
  const { text, userId } = req.body;

  try {
    // Get user data from Realtime Database
    const userRef = db.ref(`users/${userId}`);
    const snapshot = await userRef.once("value");
    const userData = snapshot.val();

    if (!userData) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check free-tier limit
    const { queryCount, lastReset } = userData;
    const now = Date.now();
    const twoHours = 2 * 60 * 60 * 1000;

    if (now - lastReset > twoHours) {
      await userRef.update({ queryCount: 0, lastReset: now });
    } else if (queryCount >= 10) {
      return res.status(429).json({ error: "Free-tier limit reached. Wait 2 hours." });
    }

    // Launch Puppeteer
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Navigate to grok.com and authenticate (simplified)
    await page.goto("https://grok.com");
    // Note: Actual authentication requires injecting X session cookies or tokens
    // This is complex and requires reverse-engineering X/grok.com’s auth flow
    await page.evaluate((token) => {
      // Placeholder: Inject X access token or cookies
      // You’ll need to inspect network requests to implement this
    }, userData.xAccessToken);

    // Enter query
    await page.type("#input-box", `Fact-check this: ${text}`); // Replace with actual selector
    await page.click("#submit-button"); // Replace with actual selector
    await page.waitForSelector("#response", { timeout: 10000 }); // Replace with actual selector

    const response = await page.$eval("#response", (el) => el.innerText);
    await browser.close();

    // Update query count
    await userRef.update({ queryCount: queryCount + 1 });

    res.json({ result: response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fact-check" });
  }
});