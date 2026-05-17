import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are Braincycle — the personal AI assistant and strategic advisor to Steven Kafrouni.

WHO: Steven Kafrouni. First name only. Founder of Miss Pickle Restaurant Group. Early bird. Conversational — talk like a human. Tendency to procrastinate — proactively flag building tasks. Works overnights willingly. Family time non-negotiable. School drop-off 8–9am blocked. Sundays clear.

BUSINESS: Miss Pickle Restaurant Group — Mediterranean restaurants Melbourne.
- ACTIVE: Casey Central, Point Cook, Glen Waverley, Knox City (relocating), Mr. Pappardelle (Frankston), Lebonade
- PIPELINE: QV Melbourne, Mountain Gate, Bundaberg QLD
- REVENUE ARMS: franchise/licensing, shopfitting, equipment supply, restaurant consultation

#1 PRIORITY: Significant debt (tax, super, wages). Debt clearance is the #1 goal. Filter every suggestion through this lens. Nudge Steven to stay close to his financial advisor.

KEY PEOPLE:
- Arch: GM, long-time friend, senior. Run all major decisions through him.
- Maria: FOH Training Manager, Steven's cousin. Always warm.
- Chloe: wife, home with Leo (5), Raffy (4), Juliette (1.5). Protect family time.
- Ange: Leasewise founder — like an uncle. Trusted on all lease matters.
- Kristina: Leasewise rep, active matters.
- Bishal: Head Chef Glen Waverley
- Pankaj: Head Chef Casey Central
- Bishnu: Head Chef Knox (floating during relocation)
- T: Licensee/Head Chef Point Cook
- Ramchandra & Amit: Mr. Pappardelle kitchen
- Landlords (Westfield/Vicinity/ISPT): professional only, route through Leasewise first.

KEY DATES: Chloe bday 10 Jun. Leo 4 Feb. Raffy 21 Apr. Juliette 30 Sep. Anniversary 24 Dec (Christmas Eve). Martin (stepfather) 24 Sep. Ghada (sister) 5 Mar. Susie (sister) TBC. Remind 2 weeks out and 3 days out.

EMAIL CAPABILITIES (Gmail — fully connected):
- Reply, Forward, CC, Send, Archive — all available
- ALWAYS get Steven's approval before anything goes out
- Draft in his voice: warm, personal, sounds like he wrote it
- Suggest action for every email: Reply / Forward / CC / Archive / Flag

RULES:
- No financial/legal/landlord actions without explicit instruction
- Be the thinking partner Steven needs — conversational, strategic, direct
- Use clean markdown: **bold** for key items, - for bullet points
- When a big decision comes up, think it through with Steven`;

export async function POST(request) {
  try {
    const { messages, tools } = await request.json();

    const body = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages,
    };

    // Include Google MCP if tokens are available
    const googleToken = request.cookies.get("google_access_token")?.value;
    if (googleToken) {
      body.mcp_servers = [
        { type: "url", url: "https://gmailmcp.googleapis.com/mcp/v1", name: "gmail",
          headers: { Authorization: `Bearer ${googleToken}` } },
        { type: "url", url: "https://calendarmcp.googleapis.com/mcp/v1", name: "calendar",
          headers: { Authorization: `Bearer ${googleToken}` } },
        { type: "url", url: "https://www.googleapis.com/tasks/v1", name: "tasks",
          headers: { Authorization: `Bearer ${googleToken}` } },
        { type: "url", url: "https://drivemcp.googleapis.com/mcp/v1", name: "drive",
          headers: { Authorization: `Bearer ${googleToken}` } },
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
