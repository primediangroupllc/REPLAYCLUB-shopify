import { useEffect, useRef, useState } from "react";
import { Camera, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface IdCameraCaptureProps {
  onCapture: (file: File) => void;
  onUploadFallback: (file: File) => void;
  className?: string;
}

// Detect in-app browser webviews where live getUserMedia is unreliable or
// outright blocked (Meta/IG/FB, TikTok, Twitter/X, LinkedIn, Snapchat).
// These users still get a working path via <input capture="environment">.
const detectInAppBrowser = (ua: string): boolean =>
  /FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|Twitter|LinkedInApp|Snapchat|Line\//i.test(ua);

const detectCapabilities = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { cameraAvailable: false, isInAppBrowser: false, hasGetUserMedia: false, isSecure: false };
  }
  const ua = navigator.userAgent || "";
  const isInAppBrowser = detectInAppBrowser(ua);
  const hasGetUserMedia = !!navigator.mediaDevices?.getUserMedia;
  const isSecure = window.isSecureContext !== false;
  return {
    cameraAvailable: !isInAppBrowser && hasGetUserMedia && isSecure,
    isInAppBrowser,
    hasGetUserMedia,
    isSecure,
  };
};

// Lightweight analytics ping. We log to console (picked up by existing
// diagnostic pipeline) and best-effort PostHog/window.analytics if present.
const trackVerificationMethod = (
  method: "live_camera" | "photo_upload",
  caps: ReturnType<typeof detectCapabilities>,
) => {
  const payload = {
    method,
    isInAppBrowser: caps.isInAppBrowser,
    hasGetUserMedia: caps.hasGetUserMedia,
    isSecure: caps.isSecure,
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "",
  };
  console.log("[id_verification_method]", payload);
  try {
    const w = window as unknown as {
      analytics?: { track?: (e: string, p: unknown) => void };
      posthog?: { capture?: (e: string, p: unknown) => void };
    };
    w.analytics?.track?.("id_verification_method", payload);
    w.posthog?.capture?.("id_verification_method", payload);
  } catch {
    /* analytics is best-effort */
  }
};

/**
 * ID capture with co-equal Camera + Upload paths. The user picks first;
 * neither is "fallback." On devices where live `getUserMedia` is known to
 * fail (in-app webviews, missing API, insecure origins), the camera tile is
 * hidden and only upload is shown — `<input capture="environment">` still
 * routes to the rear camera as a one-shot photo on those devices.
 *
 * The captured frame is delivered as a JPEG `File` so the existing
 * upload pipeline doesn't need any changes.
 */
const IdCameraCapture = ({ onCapture, onUploadFallback, className }: IdCameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Stages:
  //   choose     — co-equal Camera/Upload tiles (initial)
  //   requesting — user picked camera, awaiting permission/stream
  //   live       — live preview ready
  //   fallback   — upload-only (either user choice or camera unavailable)
  const [caps] = useState(() => detectCapabilities());
  const [stage, setStage] = useState<"choose" | "requesting" | "live" | "fallback">(
    caps.cameraAvailable ? "choose" : "fallback",
  );
  const [needsTapToStart, setNeedsTapToStart] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    caps.cameraAvailable
      ? null
      : caps.isInAppBrowser
        ? "Tap to take a new photo or choose an existing one."
        : !caps.isSecure
          ? "Camera requires a secure connection — upload a photo instead."
          : "Camera not available on this device — upload a photo instead.",
  );

  // Camera acquisition runs only when the user chooses the live-camera path
  // (stage === "requesting"). We FIRST move to "live" so the <video> element
  // is mounted in the DOM, THEN attach srcObject — the previous order
  // (attach before render) left srcObject on a non-existent ref on iOS.
  useEffect(() => {
    if (stage !== "requesting") return;
    let cancelled = false;
    let frameTimer: ReturnType<typeof setTimeout> | null = null;

    const attach = async (stream: MediaStream) => {
      streamRef.current = stream;
      setStage("live");
      // Wait one tick so React mounts the <video> element before we touch the ref.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (cancelled) return;
      const v = videoRef.current;
      if (!v) {
        console.error("[camera] videoRef.current is null after RAF");
        return;
      }
      // MediaStream MUST be assigned to srcObject (not src).
      v.srcObject = stream;
      console.log("[camera] srcObject attached");
      v.onloadedmetadata = () => {
        console.log(
          "[camera] metadata loaded, dims:",
          v.videoWidth,
          "x",
          v.videoHeight,
        );
      };
      v.onplaying = () => console.log("[camera] playing");
      v.onerror = (e) => console.error("[camera] video error:", e);
      try {
        await v.play();
        console.log("[camera] play() resolved");
      } catch (playErr) {
        const e = playErr as Error;
        console.error("[camera] play() rejected:", e?.name, e?.message);
        // iOS sometimes blocks autoplay even when muted+playsInline — surface
        // a tap-to-start affordance that calls play() inside a user gesture.
        if (!cancelled) setNeedsTapToStart(true);
      }
      // Safety net: if no video frames arrive within 5s, fall back to upload.
      frameTimer = setTimeout(() => {
        if (cancelled) return;
        const vid = videoRef.current;
        if (!vid || vid.readyState < 2 || vid.videoWidth === 0) {
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          setStage("fallback");
          setErrorMsg("Camera didn't start — upload a photo instead");
        }
      }, 5000);
    };

    const start = async () => {
      console.log("[camera] starting, ua:", navigator.userAgent);
      console.log("[camera] mediaDevices available:", !!navigator.mediaDevices);
      console.log(
        "[camera] getUserMedia available:",
        !!navigator.mediaDevices?.getUserMedia,
      );
      console.log("[camera] protocol:", window.location.protocol);
      console.log("[camera] isSecureContext:", window.isSecureContext);
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        console.error("[camera] getUserMedia API missing");
        setStage("fallback");
        setErrorMsg("Camera not available on this device");
        return;
      }
      // HTTPS / secure-context check (file://, http://… block getUserMedia).
      if (typeof window !== "undefined" && window.isSecureContext === false) {
        console.error("[camera] insecure context — getUserMedia blocked");
        setStage("fallback");
        setErrorMsg("Camera requires a secure (HTTPS) connection — upload a photo instead");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        console.log(
          "[camera] stream acquired, tracks:",
          stream.getTracks().length,
        );
        console.log(
          "[camera] track settings:",
          stream.getVideoTracks()[0]?.getSettings(),
        );
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        await attach(stream);
      } catch (err) {
        const e = err as Error;
        console.error("[camera] getUserMedia failed:", e?.name, e?.message);
        if (cancelled) return;
        setStage("fallback");
        setErrorMsg(
          err instanceof Error && err.name === "NotAllowedError"
            ? "Camera blocked — upload a photo of your ID instead"
            : "Camera unavailable — upload a photo instead",
        );
      }
    };

    start();

    return () => {
      cancelled = true;
      if (frameTimer) clearTimeout(frameTimer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [stage]);

  const chooseCamera = () => {
    trackVerificationMethod("live_camera", caps);
    setErrorMsg(null);
    setStage("requesting");
  };

  const chooseUpload = () => {
    trackVerificationMethod("photo_upload", caps);
    setErrorMsg(null);
    setStage("fallback");
  };

  // User-gesture handler for the tap-to-start fallback (iOS autoplay block).
  const handleTapToStart = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      await v.play();
      setNeedsTapToStart(false);
    } catch {
      // Still blocked — give up on live capture, switch to upload.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setStage("fallback");
      setErrorMsg("Couldn't start the camera — upload a photo instead");
    }
  };

  // Manual escape hatch: user prefers upload even if camera is working.
  const switchToUpload = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStage("fallback");
    setErrorMsg(null);
  };

  // iOS sometimes resolves the first play() before metadata is ready, leaving
  // the element paused on a black frame. Re-issuing play() once metadata
  // arrives reliably kicks rendering into gear.
  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {
      setNeedsTapToStart(true);
    });
  };

  const handleSnap = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `id-${Date.now()}.jpg`, { type: "image/jpeg" });
        // Stop the camera once we have the frame so the LED turns off.
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        onCapture(file);
      },
      "image/jpeg",
      0.92,
    );
  };

  const handleFileFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadFallback(file);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {stage === "choose" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={chooseCamera}
              className="flex flex-col items-center justify-center gap-2 p-5 border border-border rounded-md hover:border-chrome-dark hover:bg-[hsl(0_0%_8%)] transition-colors"
            >
              <Camera className="w-6 h-6 text-foreground" />
              <span className="text-[11px] font-display font-semibold uppercase tracking-[0.08em] text-foreground">
                Take photo
              </span>
              <span className="text-[10px] font-body text-muted-foreground text-center leading-tight">
                Use your camera
              </span>
            </button>
            <label className="flex flex-col items-center justify-center gap-2 p-5 border border-border rounded-md hover:border-chrome-dark hover:bg-[hsl(0_0%_8%)] transition-colors cursor-pointer">
              <Upload className="w-6 h-6 text-foreground" />
              <span className="text-[11px] font-display font-semibold uppercase tracking-[0.08em] text-foreground">
                Upload photo
              </span>
              <span className="text-[10px] font-body text-muted-foreground text-center leading-tight">
                From your photos
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  trackVerificationMethod("photo_upload", caps);
                  handleFileFallback(e);
                }}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-[10px] font-body text-muted-foreground text-center">
            Either works — choose what's easiest for you.
          </p>
        </div>
      )}

      {stage === "live" && (
        <>
          <div className="relative rounded-md overflow-hidden border border-border bg-black aspect-[4/3]">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              onLoadedMetadata={handleLoadedMetadata}
              className="w-full h-full object-cover"
              style={{ backgroundColor: "#000" }}
            />
            {/* ID frame overlay — visual guide to align the document */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[85%] aspect-[1.586/1] border-2 border-dashed border-white/70 rounded-md shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
            </div>
            <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-body text-white/80 bg-black/40 px-2 py-1 rounded">
              Align ID inside the frame
            </p>
            {needsTapToStart && (
              <button
                type="button"
                onClick={handleTapToStart}
                className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-xs font-display uppercase tracking-[0.1em]"
              >
                <Camera className="w-4 h-4 mr-2" /> Tap to start camera
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSnap}
            className="w-full py-2.5 rounded-md chrome-btn font-display font-semibold text-xs uppercase tracking-[0.1em] flex items-center justify-center gap-2"
          >
            <Camera className="w-3.5 h-3.5" />
            Capture
          </button>
          <button
            type="button"
            onClick={switchToUpload}
            className="w-full flex items-center justify-center gap-1.5 text-[10px] font-body text-muted-foreground hover:text-foreground transition-colors"
          >
            <Upload className="w-3 h-3" />
            Use upload instead
          </button>
        </>
      )}

      {stage === "requesting" && (
        <>
          <div className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border rounded-md">
            <Camera className="w-6 h-6 text-muted-foreground animate-pulse" />
            <p className="text-xs font-body text-muted-foreground">Requesting camera…</p>
          </div>
          <label className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-body text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <Upload className="w-3 h-3" />
            Camera not working? Upload a photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileFallback}
              className="hidden"
            />
          </label>
        </>
      )}

      {stage === "fallback" && (
        <div className="space-y-2">
          <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-chrome-dark transition-colors">
            <Upload className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs font-body text-muted-foreground text-center">
              {errorMsg || "Tap to take a new photo or choose an existing one"}
            </span>
            <span className="text-[10px] font-body text-muted-foreground/60">JPG, PNG — max 10MB</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileFallback}
              className="hidden"
            />
          </label>
          {caps.cameraAvailable && (
            <button
              type="button"
              onClick={chooseCamera}
              className="w-full flex items-center justify-center gap-1.5 text-[10px] font-body text-muted-foreground hover:text-foreground transition-colors"
            >
              <Camera className="w-3 h-3" />
              Use camera instead
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default IdCameraCapture;
