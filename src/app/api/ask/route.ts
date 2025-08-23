// import { NextResponse } from "next/server";
// const deviceUsage: Record<string, number> = {};








// export async function POST(req: Request) {

  
//   try {
//     const { prompt, isPremium, userProfile, deviceId } = await req.json();

//     const url = isPremium
//       ? "https://api.openai.com/v1/chat/completions"
//       : "https://openrouter.ai/api/v1/chat/completions";

//     const key = isPremium
//       ? process.env.OPENAI_KEY
//       : process.env.OPENROUTER_APIKEY;

//     // 🚨 If no API key found → return error JSON
//     if (!key) {
//       return NextResponse.json(
//         { error: "Missing API key. Check your .env.local or Vercel settings." },
//         { status: 400 }
//       );
//     }
      

//     // Call external API
//   const res = await fetch(url, {
//   method: "POST",
//   headers: {
//     "Authorization": `Bearer ${key}`,
//     "Content-Type": "application/json",
//   },
//   body: JSON.stringify({
//     model: isPremium ? "gpt-4o-mini" : "z-ai/glm-4.5-air:free",
//     messages: [
//       {
//         role: "system",
//         content: `
// You are a decision-making assistant.
// Always return valid JSON ONLY in this format:

// {
//   "title": "string",
//   "summary": "string",
//   "recommendation": "string",
//   "options": [
//     { "label": "string", "likelihood": number (0-100, percentage not decimal), "pros": [ "string" ], "cons": [ "string" ] }
//   ]
// }
//         `
//       },
//       {
//         role: "user",
//         content: `User: ${userProfile?.name}, Age: ${userProfile?.age}, Prompt: ${prompt}`
//       }
//     ],
//     temperature: 0.4,
//   }),
// });


//     if (!res.ok) {
//       const text = await res.text();
//       return NextResponse.json(
//         { error: "Upstream API error", details: text },
//         { status: res.status }
//       );
//     }
// console.log("OPENROUTER_APIKEY exists?", !!process.env.OPENROUTER_APIKEY);

//     const data = await res.json();
//     console.log("OPENAI_KEY:", process.env.OPENAI_KEY);
// console.log("OPENROUTER_APIKEY:", process.env.OPENROUTER_APIKEY);
//     return NextResponse.json(data);
    
    
//   } catch (err: unknown) {
//     // Always send back JSON instead of crashing
//     const message = err instanceof Error ? err.message : String(err);
//     return NextResponse.json(
//       { error: "Internal Server Error", details: message },
//       { status: 500 }
//     );
//   }
// }

// import { NextResponse } from "next/server";

// // In-memory usage tracker (for demo)
// // Replace with Redis/Mongo/Postgres for production
// let usageMap: Record<string, { count: number; date: string }> = {};

// export async function POST(req: Request) {
//   try {
//     const { prompt, isPremium, userProfile, deviceId } = await req.json();

//     if (!prompt) {
//       return NextResponse.json(
//         { error: "Missing prompt" },
//         { status: 400 }
//       );
//     }
//     if (!deviceId) {
//       return NextResponse.json(
//         { error: "Missing deviceId" },
//         { status: 400 }
//       );
//     }

//     const today = new Date().toISOString().slice(0, 10);

//     // --- Usage check ---
//     const usage = usageMap[deviceId];
//     if (!usage || usage.date !== today) {
//       usageMap[deviceId] = { count: 0, date: today }; // reset daily
//     }

//     if (!isPremium) {
//       if (usageMap[deviceId].count >= 2) {
//         return NextResponse.json({
//           error: "limit_reached",
//           message: "⚠️ You have already used 2 free tries today.",
//         });
//       }
//       usageMap[deviceId].count += 1;
//     }

//     // --- API Selection ---
//     const url = isPremium
//       ? "https://api.openai.com/v1/chat/completions"
//       : "https://openrouter.ai/api/v1/chat/completions";

//     const key = isPremium
//       ? process.env.OPENAI_KEY
//       : process.env.OPENROUTER_APIKEY;

//     if (!key) {
//       return NextResponse.json(
//         { error: "Missing API key. Check your .env.local or Vercel settings." },
//         { status: 400 }
//       );
//     }

//     // --- Call AI API ---
//     const res = await fetch(url, {
//       method: "POST",
//       headers: {
//         "Authorization": `Bearer ${key}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         model: isPremium ? "gpt-4o-mini" : "z-ai/glm-4.5-air:free",
//         messages: [
//           {
//             role: "system",
//             content: `
// You are a decision-making assistant.
// Always return valid JSON ONLY in this format:

// {
//   "title": "string",
//   "summary": "string",
//   "recommendation": "string",
//   "options": [
//     { "label": "string", "likelihood": number (0-100), "pros": [ "string" ], "cons": [ "string" ] }
//   ]
// }
//             `,
//           },
//           {
//             role: "user",
//             content: `User: ${userProfile?.name}, Age: ${userProfile?.age}, Prompt: ${prompt}`,
//           },
//         ],
//         temperature: 0.4,
//       }),
//     });

//     if (!res.ok) {
//       const text = await res.text();
//       return NextResponse.json(
//         { error: "Upstream API error", details: text },
//         { status: res.status }
//       );
//     }

//     const data = await res.json();
//     return NextResponse.json(data);

//   } catch (err: unknown) {
//     const message = err instanceof Error ? err.message : String(err);
//     console.error("API error:", message);
//     return NextResponse.json(
//       { error: "Internal Server Error", details: message },
//       { status: 500 }
//     );
//   }
// }



import { NextResponse } from "next/server";
import crypto from "crypto";

// Simple in-memory store (reset on restart)
// Replace with DB if you want persistence
const usageMap: Record<string, { count: number; date: string }> = {};

export async function POST(req: Request) {
  try {
    const { prompt, isPremium, userProfile, deviceId } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }
    if (!deviceId) {
      return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
    }

    // Get client IP (works on Vercel/Next.js API routes)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // 🔑 Create stable per-device signature
    const deviceKey = crypto
      .createHash("sha256")
      .update(deviceId + ip)
      .digest("hex");

    const today = new Date().toISOString().slice(0, 10);

    // Reset daily
    const usage = usageMap[deviceKey];
    if (!usage || usage.date !== today) {
      usageMap[deviceKey] = { count: 0, date: today };
    }

    // Enforce free limit
    if (!isPremium) {
      if (usageMap[deviceKey].count >= 2) {
        return NextResponse.json({
          error: "limit_reached",
          message: "⚠️ You have already used 2 free tries today.",
        });
      }
      usageMap[deviceKey].count += 1;
    }

    // === AI API CALL (same as before) ===
    const url = isPremium
      ? "https://api.openai.com/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";

    const key = isPremium
      ? process.env.OPENAI_KEY
      : process.env.OPENROUTER_APIKEY;

    if (!key) {
      return NextResponse.json(
        { error: "Missing API key" },
        { status: 400 }
      );
    }

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
    { "label": "string", "likelihood": number, "pros": [ "string" ], "cons": [ "string" ] }
  ]
}
            `,
          },
          {
            role: "user",
            content: `User: ${userProfile?.name}, Age: ${userProfile?.age}, Prompt: ${prompt}`,
          },
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

    const data = await res.json();
    return NextResponse.json(data);

  } catch (err: unknown) {
    return NextResponse.json(
      { error: "server_error", message: String(err) },
      { status: 500 }
    );
  }
}
