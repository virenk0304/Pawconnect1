
import { GoogleGenAI, Type } from "@google/genai";
import { Pet, Tip, PostType } from "../types";

// Always use `process.env.API_KEY` for API key. Assume this variable is pre-configured, valid, and accessible.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getChatResponse = async (history: { role: 'user' | 'model', parts: { text: string }[] }[], message: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [...history, { role: 'user', parts: [{ text: message }] }],
    config: {
      systemInstruction: 'You are Paw connect AI, an expert veterinarian and pet behaviorist. Help pet owners with care, training, and nutrition advice. Keep responses friendly, concise, and professional.',
    }
  });
  
  return response.text;
};

export const getPetHealthScore = async (pet: Partial<Pet>): Promise<number> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze health for this pet and return ONLY a numeric health score between 0 and 100.
    Details: ${pet.type} ${pet.breed}, Age: ${pet.age}, Weight: ${pet.weight}kg.
    Return just the number, no text.`,
    config: {
      temperature: 0.1,
    }
  });
  
  // Fix: Safely access response.text and provide a fallback for parsing
  const score = parseInt(response.text?.trim() || '0');
  return isNaN(score) ? 85 : score;
};

export const generatePetReport = async (pet: Pet) => {
  const prompt = `Perform a DEEP HEALTH ANALYSIS for this pet based on these metrics:
    - Name: ${pet.name}
    - Species: ${pet.type}
    - Breed: ${pet.breed}
    - Age: ${pet.age} years
    - Weight: ${pet.weight}kg
    
    CRITICAL ANALYSIS REQUIREMENTS:
    1. Determine the Life Stage (e.g., Pediatric, Adult, Senior, Geriatric) for this specific species.
    2. Evaluate the Weight: Is ${pet.weight}kg healthy for a ${pet.age} year old ${pet.breed}? 
    3. Identify Breed-Specific Risks: What should the owner watch for given these metrics?
    4. Actionable Advice: Provide 3 custom health goals.
    
    Structure the response as a professional medical summary. Use bold text for key insights.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: 'You are a high-level veterinary diagnostic AI. Provide deep, data-driven health reports. Be empathetic but clinical in your assessment.',
      thinkingConfig: { thinkingBudget: 2048 }
    }
  });

  return response.text;
};

export const getDailyTips = async (count: number = 40): Promise<Tip[]> => { // Default count changed to 40
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    // Updated prompt to explicitly request 10 tips per category for a total of 40
    contents: `Generate exactly 40 unique, high-quality pet care tips, ensuring 10 tips for each of the following categories: Health, Nutrition, Training, and General. Each tip must be short, clear, actionable, and easy to understand for pet owners. Return as a JSON array. IMPORTANT: The "icon" field MUST be a single emoji character ONLY. Ensure content is engaging and helpful for pet owners.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            content: { type: Type.STRING },
            icon: { type: Type.STRING, description: "Exactly one emoji." }
          },
          required: ['id', 'title', 'category', 'content', 'icon']
        }
      }
    }
  });

  try {
    const parsed = JSON.parse(response.text || '[]');
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Invalid format");
    // Ensure the parsed array has the correct number of items.
    // If Gemini returns fewer than 40, we will still use what it provides.
    return parsed.slice(0, count);
  } catch (e) {
    console.error("Failed to parse AI tips:", e);
    // Fallback now generates 40 tips if parsing fails, distributed by category
    const fallbackTips: Tip[] = [];
    const categories = ['Health', 'Nutrition', 'Training', 'General'];
    const icons = ['❤️', '🍎', '🏋️', '🐾']; // Example icons

    for (let i = 0; i < 10; i++) {
      categories.forEach((category, catIndex) => {
        fallbackTips.push({
          id: `fallback-${category}-${i}`,
          title: `${category} Tip ${i + 1}`,
          category: category as 'Health' | 'Training' | 'Nutrition' | 'General',
          content: `This is a fallback tip for ${category} category, ensuring variety.`,
          icon: icons[catIndex]
        });
      });
    }
    return fallbackTips;
  }
};

export const summarizeCommunityReplies = async (replies: string[]): Promise<string> => {
  if (replies.length === 0) {
    return "No replies to summarize yet. Be the first to share your thoughts!";
  }

  const prompt = `You are an AI assistant inside a pet-owner community app.
Your job is to summarize replies from multiple pet owners into simple, helpful advice.

INPUT YOU WILL RECEIVE:
A list of replies from different users:
${replies.map(r => `- ${r}`).join('\n')}

WHAT YOU MUST DO:
1. Identify common suggestions or patterns
2. Summarize them into 3–5 short bullet points
3. Use simple language suitable for first-time pet owners

IMPORTANT RULES:
- Do NOT add new advice
- Do NOT give medical diagnosis
- If replies conflict, mention that opinions vary
- Keep the tone neutral and supportive

OUTPUT FORMAT (STRICT):
Summary of Community Advice:
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      temperature: 0.7, // A bit higher temperature for more varied summarization
      topP: 0.95,
      topK: 64,
    }
  });

  return response.text || "Could not generate a summary at this time. Please try again later.";
};

export const summarizeSinglePost = async (postContent: string, postType?: PostType): Promise<string> => {
  if (!postContent.trim()) {
    return "The post content is empty and cannot be summarized.";
  }

  const typeHint = postType ? `This post is categorized as "${postType}".` : '';

  const prompt = `You are an AI assistant inside a pet-owner community app.
Your job is to summarize a single post from a pet owner into simple, helpful bullet points.

INPUT YOU WILL RECEIVE:
The user's post content: "${postContent}"
${typeHint}

WHAT YOU MUST DO:
1. Identify the main points or core message of the post.
2. Summarize them into 3–5 short bullet points.
3. Use simple language suitable for first-time pet owners.

IMPORTANT RULES:
- Do NOT add new advice or facts not present in the original post.
- Do NOT give medical diagnosis or professional medical advice.
- Keep the tone neutral and supportive, like a helpful pet parent.

OUTPUT FORMAT (STRICT):
Summary of Post:
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.5, // Slightly lower temperature for more direct summarization
        topP: 0.9,
        topK: 32,
      }
    });

    return response.text || "Could not generate a summary for this post at this time. Please try again later.";
  } catch (error) {
    console.error("Error summarizing single post:", error);
    return "Failed to generate post summary due to an error. Please try again.";
  }
};


export const enhanceCommunityPost = async (rawText: string, category?: PostType): Promise<{ title: string; improvedPost: string }> => {
  if (!rawText.trim()) {
    return { title: "Error", improvedPost: "Post content cannot be empty for enhancement." };
  }

  const categoryInput = category ? `The post belongs to the category: ${category}.` : '';

  const prompt = `You are an AI assistant inside a pet-owner community app called “PawConnect”.
Your task is to help pet owners improve their community posts so they are:
- Clear
- Friendly
- Helpful
- Easy to understand for other pet parents

INPUT YOU WILL RECEIVE:
1. The user’s raw post text: "${rawText}"
2. Optional category: ${category || 'None provided'}

WHAT YOU MUST DO:
1. Rewrite the post in a warm, supportive tone
2. Fix grammar and clarity (do NOT change meaning)
3. Keep it short and readable
4. Suggest ONE clear and engaging title for the post

IMPORTANT RULES:
- Do NOT add medical advice
- Do NOT add facts the user didn’t mention
- Do NOT sound like a professional article
- Write like a helpful pet parent, not a doctor

OUTPUT FORMAT (STRICT):
Title:
<suggested title>

Improved Post:
<improved post text>
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7, // Balance creativity and faithfulness
        topP: 0.95,
        topK: 64,
      }
    });

    const rawOutput = response.text || "";
    const titleMatch = rawOutput.match(/Title:\s*(.*?)(\n|$)/i);
    const improvedPostMatch = rawOutput.match(/Improved Post:\s*((.|\n)*)/i);

    const title = titleMatch ? titleMatch[1].trim() : 'Suggested Title';
    const improvedPost = improvedPostMatch ? improvedPostMatch[1].trim() : rawOutput; 

    return { title, improvedPost };
  } catch (error) {
    console.error("Error enhancing community post:", error);
    return { title: "Enhancement Failed", improvedPost: "Could not enhance post at this time. Please try again later." };
  }
};
