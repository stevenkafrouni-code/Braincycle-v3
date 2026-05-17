"use client";
import { useEffect, useState } from "react";
import Braincycle from "./components/Braincycle";

export default function Home() {
  const [authState, setAuthState] = useState("checking"); // checking | connected | disconnected

  useEffect(() => {
    // Check for auth callback result
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "success") {
      window.history.replaceState({}, "", "/");
      setAuthState("connected");
      return;
    }
    if (params.get("auth") === "error") {
      window.history.replaceState({}, "", "/");
      setAuthState("error");
      return;
    }
    // Check cookie via API
    fetch("/api/google/status")
      .then(r => r.json())
      .then(d => setAuthState(d.connected ? "connected" : "disconnected"))
      .catch(() => setAuthState("disconnected"));
  }, []);

  if (authState === "checking") return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#D5CFC3" }}>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32, fontStyle:"italic", color:"#18140F", opacity:0.6 }}>
        Opening Braincycle…
      </div>
    </div>
  );

  return <Braincycle googleConnected={authState === "connected"} />;
}
