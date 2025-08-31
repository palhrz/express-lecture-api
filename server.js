// server.js
const express = require('express');
// const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();
const admin = require("firebase-admin");
const { getSentiment, extractKeywords } = require("./nlp-utils");
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

const corsOptions = {
  origin: ['http://localhost:3000', 'https://lems.onrender.com'],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, "build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});
app.post('/api/create-form', async (req, res) => {
  const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
  
  try {
    const { segments, sessionId } = req.body;
    
    if (!APPS_SCRIPT_URL) {
      return res.status(500).json({ error: "Apps Script URL is not configured." });
    }

    if (!segments || !sessionId) {
      return res.status(400).json({ error: "Missing segments or sessionId." });
    }
    const body= JSON.stringify({ segments, sessionId })
    console.log("body : ", body)
    
    const appsScriptResponse = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segments, sessionId }),
    });

    const data = await appsScriptResponse.json();
    console.log("Apps Script response:", data);
    if (data.error) {
      return res.status(500).json({ error: data.error });
    }
    
    res.status(200).json(data);

  } catch (error) {
    console.error("Proxy server error:", error);
    res.status(500).json({ error: "An unexpected error occurred." });
  }
});

app.get('/api/dashboard/insights', async (req, res) => {
  try {
    const time = Date.now();
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const sessionsSnap = await db.collection("sessions").where("uid", "==", userId).get();
    // const sessionsSnap = await db.collection("sessions").get();
    const sessions = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((sum, s) => sum + (s.segments?.reduce((t, seg) => t + (seg.duration || 0), 0) || 0), 0);
    const averageDuration = totalSessions ? Math.round(totalDuration / totalSessions) : 0;

    const typeCount = {};
    sessions.forEach(s => {
      if (s.type) typeCount[s.type] = (typeCount[s.type] || 0) + 1;
    });
    const mostUsedType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown";

    const weeklyData = {};
    const monthlyData = {};
    const now = new Date();

    sessions.forEach(s => {
      const date = s.timestamp?.toDate?.() || new Date(s.timestamp || now);
      const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      [weekKey, monthKey].forEach(key => {
        const dataObj = key.includes("W") ? weeklyData : monthlyData;
        dataObj[key] = dataObj[key] || { count: 0, segments: {} };
        dataObj[key].count += 1;

        (s.segments || []).forEach(seg => {
          const { name, duration, plannedDuration } = seg;
          if (!name) return;
          dataObj[key].segments[name] = dataObj[key].segments[name] || { total: 0, count: 0, planned: 0 };
          dataObj[key].segments[name].total += duration || 0;
          dataObj[key].segments[name].planned += plannedDuration || 0;
          dataObj[key].segments[name].count += 1;
        });
      });
    });

    const feedbackTexts = [];
    for (const session of sessions) {
        const feedbackRef = db.collection("sessions").doc(session.id).collection("feedback");
        const feedbackSnap = await feedbackRef.get();

        feedbackSnap.forEach(doc => {
            const data = doc.data();
            Object.values(data).forEach(val => {
            if (typeof val === "string" && val.trim()) feedbackTexts.push(val.trim());
            });
        });
    }

    const sentimentScore = await getSentiment(feedbackTexts.join(" "));
    console.log("Sentiment Score:", sentimentScore);
    const keywords = extractKeywords(feedbackTexts.join(" "));

    const recommendations = null

    console.log("Summary : \n", totalSessions, averageDuration, mostUsedType, sentimentScore, keywords, recommendations);
    const endTime = Date.now();
    console.log(`Dashboard insights fetched in ${endTime - time}ms`);
    res.json({
      summary: {
        totalSessions,
        averageDuration,
        mostUsedType,
        averageSentiment: sentimentScore
      },
      weekly: weeklyData,
      monthly: monthlyData,
      keywords,
      recommendations
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: "Dashboard fetch failed" });
  }
});

function getWeekNumber(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

app.listen(port, () => {
  console.log(`Proxy server listening at http://localhost:${port}`);
});