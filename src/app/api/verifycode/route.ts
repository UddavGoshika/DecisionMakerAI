import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { code } = await req.json();

    const validCodes = process.env.PREMIUM_CODES?.split(",") || [];

    console.log("🔍 Checking code:", code);
    console.log("✅ Valid codes:", validCodes);

    if (!code || !validCodes.includes(code)) {
      return NextResponse.json({ success: false, message: "Invalid code" });
    }

    // Premium valid for 30 days
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);

    return NextResponse.json({
      success: true,
      expiry: expiry.toISOString(),
      message: "Premium activated",
    });
  } catch (err) {
    console.error("❌ Server error:", err);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}
