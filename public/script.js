// Add these lines at the beginning of the file
let storedMainSubject = "";
let storedUserQuantity = "";

import axios from "axios";

async function sendMessage() {
  const mainSubject = document.getElementById("mainSubject").value;
  const userQuantity = document.getElementById("userquantity").value;
  const responseElement = document.getElementById("response");

  responseElement.innerText = "Generating flashcards...";

  try {
    const response = await axios.post(
      "http://localhost:5000/api/generate-flashcards",
      {
        mainSubject,
        userQuantity,
      }
    );

    if (response.data.flashcards && Array.isArray(response.data.flashcards)) {
      window.currentFlashcards = response.data.flashcards;
      displayFlashcards(response.data.flashcards);
      document.getElementById("saveBtn").style.display = "inline-block";
    } else {
      responseElement.innerText = "Error: Unexpected response format";
    }
  } catch (error) {
    console.error("Error:", error);
    responseElement.innerText =
      "Error generating flashcards. Please try again.";
  }
}

function displayFlashcards(flashcards) {
  const responseElement = document.getElementById("response");
  responseElement.innerHTML = flashcards
    .map(
      (card, index) => `
    <div>
      <h3>Flashcard ${index + 1}</h3>
      <p><strong>Question:</strong> ${card.question}</p>
      <p><strong>Answer:</strong> ${card.answer}</p>
    </div>
  `
    )
    .join("");
}

async function saveFlashcards() {
  const responseElement = document.getElementById("response");

  if (!window.currentFlashcards || window.currentFlashcards.length === 0) {
    alert("No flashcards to save. Please generate flashcards first.");
    return;
  }

  try {
    const docRef = await window.db.collection("flashcards").add({
      mainSubject: storedMainSubject,
      userQuantity: storedUserQuantity,
      cards: window.currentFlashcards,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    console.log("Flashcards saved with ID: ", docRef.id);
    alert("Flashcards saved successfully!");
    responseElement.innerHTML += "<p>Flashcards saved to database.</p>";
  } catch (error) {
    console.error("Error saving flashcards: ", error);
    alert("Error saving flashcards. Please try again.");
    responseElement.innerHTML +=
      "<p>Error saving flashcards. Please try again.</p>";
  }
}

// Make functions globally accessible
window.sendMessage = sendMessage;
window.saveFlashcards = saveFlashcards;
