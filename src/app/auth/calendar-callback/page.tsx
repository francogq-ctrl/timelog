"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

function CalendarCallbackContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    async function exchange() {
      if (error) {
        setStatus("error");
        setMessage(`Google authorization failed: ${error}`);
        return;
      }

      if (!code) {
        setStatus("error");
        setMessage("No authorization code received");
        return;
      }

      try {
        const res = await fetch(
          `/api/auth/calendar-callback?code=${code}&state=${searchParams.get("state")}`
        );

        if (res.ok) {
          setStatus("success");
          setMessage("Calendar connected!");

          // Signal parent window and close popup
          setTimeout(() => {
            if (window.opener) {
              window.opener.postMessage("calendar_connected", window.location.origin);
            }
            window.close();
          }, 1500);
        } else {
          const data = await res.json();
          setStatus("error");
          setMessage(data.error || "Failed to connect calendar");
        }
      } catch (err) {
        setStatus("error");
        setMessage("Connection error. Please try again.");
        console.error(err);
      }
    }

    exchange();
  }, [code, error, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 to-zinc-900 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0f0f11] p-8 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-violet-400 mx-auto mb-4" />
            <h1 className="text-[15px] font-semibold text-white mb-2">
              Connecting Calendar
            </h1>
            <p className="text-[13px] text-zinc-400">
              Authorizing Google Calendar access...
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-4" />
            <h1 className="text-[15px] font-semibold text-white mb-2">
              Calendar Connected
            </h1>
            <p className="text-[13px] text-zinc-400">
              {message}. Closing in a moment...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-4" />
            <h1 className="text-[15px] font-semibold text-white mb-2">
              Connection Failed
            </h1>
            <p className="text-[13px] text-red-400 mb-4">
              {message}
            </p>
            <button
              onClick={() => window.close()}
              className="w-full rounded-lg bg-zinc-800 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CalendarCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 to-zinc-900">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400 mx-auto mb-4" />
            <p className="text-[13px] text-zinc-400">Loading...</p>
          </div>
        </div>
      }
    >
      <CalendarCallbackContent />
    </Suspense>
  );
}
