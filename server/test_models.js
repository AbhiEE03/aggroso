require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('No GEMINI_API_KEY found');
    return;
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await response.json();
  if (data.models) {
    console.log("Available models:");
    data.models.forEach(m => console.log(m.name, "—", m.supportedGenerationMethods.join(', ')));
  } else {
    console.error("Failed to fetch models:", data);
  }
}
testModels();
