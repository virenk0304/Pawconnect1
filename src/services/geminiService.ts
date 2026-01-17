import { GoogleGenAI, Type } from "@google/genai";
import { Pet, Tip, PostType } from "../types";

/* ======================================================
   ENV + SAFE INITIALIZATION
====================================================== */

// Vite injects env vars at build time
const API_KEY = import.meta.env.VITE_API_KEY as string | undefined;

// IMPORTANT: Never crash UI if key is missing
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

// Optional debug (remove later if you want)
console.log("Gemini enabled:", Boolean(API_KEY));

/* ======================================================
   CHAT
====================================================== */

export const getChatResponse = async (
  history: { role: "user" | "model"; parts: { text: string }[] }[],
  message: string
): Promise<string> => {
  if (!ai) return "AI is currently disabled.";

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [...history, { role: "user", parts: [{ text: message }] }],
    config: {
      systemInstruction:
        "You are PawConnect AI, an expert veterinarian and pet behaviorist. Keep responses friendly, concise, and professional."
    }
  });

  return response.text || "No response generated.";
};

/* ======================================================
   PET HEALTH SCORE
====================================================== */

export const getPetHealthScore = async (
  pet: Partial<Pet>
): Promise<number> => {
  if (!ai) return 85;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
Analyze pet health and return ONLY a number from 0 to 100.

Type: ${pet.type}
Breed: ${pet.breed}
Age: ${pet.age}
Weight: ${pet.weight}kg
`,
    config: { temperature: 0.1 }
  });

  const score = parseInt(response.text?.trim() || "85", 10);
  return isNaN(score) ? 85 : score;
};

/* ======================================================
   DETAILED PET REPORT
====================================================== */

export const generatePetReport = async (pet: Pet): Promise<string> => {
  if (!ai) return "AI is currently disabled.";

  const prompt = `
Name: ${pet.name}
Species: ${pet.type}
Breed: ${pet.breed}
Age: ${pet.age} years
Weight: ${pet.weight}kg

Generate a professional veterinary health summary with:
- Life stage
- Weight assessment
- Breed-specific risks
- 3 actionable health goals
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      thinkingConfig: { thinkingBudget: 2048 }
    }
  });

  return response.text || "Unable to generate report.";
};

/* ======================================================
   DAILY TIPS
====================================================== */

export const getDailyTips = async (count = 40): Promise<Tip[]> => {
  if (!ai) return [];

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents:
      "Generate exactly 40 pet care tips across Health, Nutrition, Training, and General. Return JSON only.",
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

  try {
    return JSON.parse(response.text || "[]").slice(0, count);
  } catch {
    return [];
  }
};

/* ======================================================
   COMMUNITY SUMMARY
====================================================== */

export const summarizeCommunityReplies = async (
  replies: string[]
): Promise<string> => {
  if (!ai || replies.length === 0) {
    return "No replies to summarize.";
  }

  const prompt = `
Summarize these community replies into 3–5 simple bullet points:

${replies.map(r => `- ${r}`).join("\n")}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  });

  return response.text || "Summary unavailable.";
};

/* ======================================================
   SINGLE POST SUMMARY
====================================================== */

export const summarizeSinglePost = async (
  postContent: string,
  postType?: PostType
): Promise<string> => {
  if (!ai || !postContent.trim()) {
    return "Nothing to summarize.";
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Summarize this post in simple bullet points:\n${postContent}`
          }
        ]
      }
    ]
  });

  return response.text || "Summary unavailable.";
};

/* ======================================================
   POST ENHANCER
====================================================== */

export const enhanceCommunityPost = async (
  rawText: string,
  category?: PostType
): Promise<{ title: string; improvedPost: string }> => {
  if (!ai) {
    return { title: "AI Disabled", improvedPost: rawText };
  }

  const prompt = `
Rewrite this post to be clearer and friendlier.
Category: ${category || "General"}
Text: "${rawText}"
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  });

  return {
    title: "Suggested Title",
    improvedPost: response.text || rawText
  };
};

