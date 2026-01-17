import { GoogleGenAI, Type } from "@google/genai";
import { Pet, Tip, PostType } from "../types";

// ✅ Vite-safe API key access
const API_KEY = import.meta.env.VITE_API_KEY;

// ✅ Prevent white screen if key is missing (local dev)
if (!API_KEY) {
  console.warn("Gemini API key not found. AI features disabled.");
}

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

/* ---------------- CHAT ---------------- */

export const getChatResponse = async (
  history: { role: "user" | "model"; parts: { text: string }[] }[],
  message: string
) => {
  if (!ai) return "AI is disabled.";

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [...history, { role: "user", parts: [{ text: message }] }],
    config: {
      systemInstruction:
        "You are PawConnect AI, an expert veterinarian and pet behaviorist. Keep replies friendly, concise, and professional."
    }
  });

  return response.text;
};

/* ---------------- HEALTH SCORE ---------------- */

export const getPetHealthScore = async (pet: Partial<Pet>): Promise<number> => {
  if (!ai) return 85;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze health and return ONLY a number (0–100).
Type: ${pet.type}, Breed: ${pet.breed}, Age: ${pet.age}, Weight: ${pet.weight}kg.`,
    config: { temperature: 0.1 }
  });

  const score = parseInt(response.text?.trim() || "85");
  return isNaN(score) ? 85 : score;
};

/* ---------------- PET REPORT ---------------- */

export const generatePetReport = async (pet: Pet) => {
  if (!ai) return "AI is disabled.";

  const prompt = `
Name: ${pet.name}
Species: ${pet.type}
Breed: ${pet.breed}
Age: ${pet.age}
Weight: ${pet.weight}kg

Provide a professional veterinary health summary with clear insights.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      thinkingConfig: { thinkingBudget: 2048 }
    }
  });

  return response.text;
};

/* ---------------- DAILY TIPS ---------------- */

export const getDailyTips = async (count = 40): Promise<Tip[]> => {
  if (!ai) return [];

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate 40 pet care tips (Health, Nutrition, Training, General). 
Return JSON only.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            content: { type: Type.STRING },
            icon: { type: Type.STRING }
          },
          required: ["id", "title", "category", "content", "icon"]
        }
      }
    }
  });

  return JSON.parse(response.text || "[]").slice(0, count);
};

/* ---------------- COMMUNITY SUMMARY ---------------- */

export const summarizeCommunityReplies = async (replies: string[]) => {
  if (!ai || replies.length === 0) return "No replies yet.";

  const prompt = `Summarize these replies into 3–5 helpful bullet points:
${replies.map(r => `- ${r}`).join("\n")}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  });

  return response.text || "Summary unavailable.";
};

/* ---------------- POST SUMMARY ---------------- */

export const summarizeSinglePost = async (
  postContent: string,
  postType?: PostType
) => {
  if (!ai || !postContent.trim()) return "Nothing to summarize.";

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: postContent }] }]
  });

  return response.text || "Summary unavailable.";
};

/* ---------------- POST ENHANCER ---------------- */

export const enhanceCommunityPost = async (
  rawText: string,
  category?: PostType
): Promise<{ title: string; improvedPost: string }> => {
  if (!ai) {
    return { title: "AI Disabled", improvedPost: rawText };
  }

  const prompt = `Rewrite this post clearly and warmly.
Text: "${rawText}"
Category: ${category || "General"}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  });

  return {
    title: "Suggested Title",
    improvedPost: response.text || rawText
  };
};
