import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}?auth=error`);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
        grant_type:    "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error("No access token returned");

    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}?auth=success`
    );

    const cookieOpts = {
      httpOnly: true,
      secure:   true,
      sameSite: "lax",
      path:     "/",
    };

    response.cookies.set("google_access_token",  tokens.access_token,  { ...cookieOpts, maxAge: 3600 });
    response.cookies.set("google_refresh_token", tokens.refresh_token, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
    response.cookies.set("google_connected",     "true",               { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });

    return response;

  } catch (err) {
    console.error("Google OAuth error:", err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}?auth=error`);
  }
}
