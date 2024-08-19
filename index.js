import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import cors from "cors";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" })); // Replace with your frontend URL

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

app.use(express.json());
app.use(express.static(__dirname + "/views")); // Serves HTML files
app.use(express.static(__dirname + "/public")); // Serves JS, CSS, images

app.get("/firebase-config", (req, res) => {
  res.json(firebaseConfig);
});

// Initialize Google Generative AI Client
const generativeAiClient = new GoogleGenerativeAI(process.env.API_KEY);

app.post("/chat", async (req, res) => {
  if (!req.body) {
    return res.status(400).send("No request body");
  }

  try {
    let promptText;
    const {
      mainSubject,
      specificTopic,
      difficulty,
      quantity,
      additionalInfo,
      isPaid,
    } = req.body;
    console.log("Received Request:", {
      mainSubject,
      specificTopic,
      difficulty,
      quantity,
      additionalInfo,
      isPaid,
    });

    if (isPaid) {
      promptText = `Generate ${quantity} flashcards about ${mainSubject}, specifically focusing on ${specificTopic}. The difficulty level should be ${difficulty}. Each flashcard should have a detailed question and a comprehensive answer. Include relevant examples, comparisons, and explanations where appropriate. Additional requirements: ${additionalInfo}. Format the output as a JSON array where each object has "question" and "answer" properties.`;
    } else {
      promptText = `Generate ${quantity} flashcards about ${mainSubject}. Format the output as a JSON array where each object has "question" and "answer" properties.`;
    }

    const model = generativeAiClient.getGenerativeModel({
      model: "gemini-pro",
    });

    const result = await model.generateContent(promptText);
    const response = result.response;
    const generatedText = response.text();

    console.log("API Response:", generatedText);

    let flashcards;
    try {
      // First, try to parse the entire response as JSON
      flashcards = JSON.parse(generatedText);
    } catch (jsonError) {
      // If that fails, try to extract JSON from markdown code block
      const jsonMatch = generatedText.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        try {
          flashcards = JSON.parse(jsonMatch[1]);
        } catch (nestedJsonError) {
          console.error("Failed to parse extracted JSON:", nestedJsonError);
          throw new Error("Invalid JSON in code block");
        }
      } else {
        // If no JSON or code block found, attempt to parse the text as flashcards
        flashcards = parseTextAsFlashcards(generatedText);
      }
    }

    // Ensure flashcards is an array
    if (!Array.isArray(flashcards)) {
      flashcards = [flashcards];
    }

    res.json({ flashcards });
  } catch (error) {
    console.error("Error processing response:", error);
    res.status(500).json({
      error: error.message || "Failed to process response",
      rawResponse: generatedText, // Include the raw response for debugging
    });
  }
});

function parseTextAsFlashcards(text) {
  // Split the text into lines
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const flashcards = [];
  let currentQuestion = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("Q:") || line.startsWith("Question:")) {
      if (currentQuestion) {
        flashcards.push({ question: currentQuestion, answer: "" });
      }
      currentQuestion = line.substring(line.indexOf(":") + 1).trim();
    } else if (line.startsWith("A:") || line.startsWith("Answer:")) {
      if (currentQuestion) {
        flashcards.push({
          question: currentQuestion,
          answer: line.substring(line.indexOf(":") + 1).trim(),
        });
        currentQuestion = "";
      }
    } else if (currentQuestion) {
      // Assume this is part of the previous question or answer
      if (flashcards.length > 0 && !flashcards[flashcards.length - 1].answer) {
        flashcards[flashcards.length - 1].answer = line;
      } else {
        currentQuestion += " " + line;
      }
    }
  }

  // Add the last question if it exists
  if (currentQuestion) {
    flashcards.push({ question: currentQuestion, answer: "" });
  }

  return flashcards;
}

app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is connected!" });
});

app.post("/api/generate-flashcards", async (req, res) => {
  try {
    const { mainSubject, userQuantity } = req.body;

    // Call Google's Generative AI
    const model = generativeAiClient.getGenerativeModel({
      model: "gemini-pro",
    });
    const prompt = `Generate ${userQuantity} flashcards about ${mainSubject}. Format the response as a JSON array of objects, each with 'question' and 'answer' properties.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse the JSON response
    const flashcards = JSON.parse(text);

    res.json({ flashcards });
  } catch (error) {
    console.error("Error generating flashcards:", error);
    res.status(500).json({ error: "Failed to generate flashcards" });
  }
});

const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
