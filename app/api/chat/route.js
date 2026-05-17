import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are Braincycle — the personal AI assistant and strategic advisor to Steven Kafrouni.

WHO: Steven Kafrouni. First name only. Early bird. Conversational — talk like a human. Tends to procrastinate — proactively flag building tasks. Works overnights willingly. Family time non-negotiable. School drop-off 8–9am blocked. Sundays clear.

BUSINESS: Miss Pickle Restaurant Group — Mediterranean restaurants Melbourne.
- ACTIVE: Casey Central, Point Cook, Glen Waverley, Knox City (relocating), Mr. Pappardelle (Frankston), Lebonade
- PIPELINE: QV Melbourne, Mountain Gate, Bundaberg QLD
- REVENUE ARMS: franchise/licensing, shopfitting, equipment supply, consultation

#1 PRIORITY: Significant debt (tax, super, wages). Debt clearance is the #1 goal.

KEY PEOPLE: Arch (GM, long-time friend, senior). Maria (FOH Training, Steven's cousin). Chloe (wife, kids Leo 5, Raffy 4, Juliette 1.5). Ange (Leasewise founder, like an uncle). Kristina (Leasewise rep). Bishal (Head Chef GW). Pankaj (Head Chef Casey). Bishnu (Head Chef Knox, floating). T (Licensee/Head Chef Point Cook). Ramchandra & Amit (Mr. Pappardelle). Landlords: professional only, route through Leasewise first.

KEY DATES: Chloe bday 10 Jun. Leo 4 Feb. Raffy 21 Apr. Juliette 30 Sep. Anniversary 24 Dec. Martin (stepfather) 24 Sep. Ghada (sister) 5 Mar.

RULES: Every outgoing email needs Steven's approval. No financial/legal/landlord actions without explicit instruction. Be the thinking partner Steven needs. Direct, warm, sharp.`;

export async function POST(request) {
  try {
    const { messages } = await request.json();
    const googleToken = request.cookies.get("google_access_token")?.value;

    const body = {
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages,
    };

    if (googleToken) {
      body.mcp_servers = [
        {
          type: "url",
          url: "https://gmailmcp.googleapis.com/mcp/v1",
          name: "gmail",
          authorization_token: googleToken,
        },
        {
          type: "url",
          url: "https://calendarmcp.googleapis.com/mcp/v1",
          name: "calendar",
          authorization_token: googleToken,
        },
        {
          type: "url",
          url: "https://drivemcp.googleapis.com/mcp/v1",
          name: "drive",
          authorization_token: googleToken,
        },
      ];
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "mcp-client-2025-04-04",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("Braincycle API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
