import { NextResponse } from "next/server";
export async function POST(request) {
  try {
    const refreshToken=request.cookies.get("google_refresh_token")?.value;
    if (!refreshToken) return NextResponse.json({error:"No refresh token"},{status:401});
    const res=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:refreshToken,grant_type:"refresh_token"})});
    const tokens=await res.json();
    if (!tokens.access_token) return NextResponse.json({error:"Refresh failed"},{status:401});
    const response=NextResponse.json({success:true});
    response.cookies.set("google_access_token",tokens.access_token,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:3600});
    return response;
  } catch(error) { return NextResponse.json({error:"Refresh error"},{status:500}); }
}
