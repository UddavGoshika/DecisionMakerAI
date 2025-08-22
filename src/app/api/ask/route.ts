import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt, isPremium, userProfile } = await req.json();

    const url = isPremium
      ? "https://api.openai.com/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";

    const key = isPremium
      ? process.env.OPENAI_KEY
      : process.env.OPENROUTER_APIKEY;

    // 🚨 If no API key found → return error JSON
    if (!key) {
      return NextResponse.json(
        { error: "Missing API key. Check your .env.local or Vercel settings." },
        { status: 400 }
      );
    }

    // Call external API
  const res = await fetch(url, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: isPremium ? "gpt-4o-mini" : "z-ai/glm-4.5-air:free",
    messages: [
      {
        role: "system",
        content: `
You are a decision-making assistant.
Always return valid JSON ONLY in this format:

{
  "title": "string",
  "summary": "string",
  "recommendation": "string",
  "options": [
    { "label": "string", "likelihood": number (0-100, percentage not decimal), "pros": [ "string" ], "cons": [ "string" ] }
  ]
}
        `
      },
      {
        role: "user",
        content: `User: ${userProfile?.name}, Age: ${userProfile?.age}, Prompt: ${prompt}`
      }
    ],
    temperature: 0.4,
  }),
});


    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "Upstream API error", details: text },
        { status: res.status }
      );
    }
console.log("OPENROUTER_APIKEY exists?", !!process.env.OPENROUTER_APIKEY);

    const data = await res.json();
    console.log("OPENAI_KEY:", process.env.OPENAI_KEY);
console.log("OPENROUTER_APIKEY:", process.env.OPENROUTER_APIKEY);
    return NextResponse.json(data);
    
    
  } catch (err: unknown) {
    // Always send back JSON instead of crashing
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Internal Server Error", details: message },
      { status: 500 }
    );
  }
}
