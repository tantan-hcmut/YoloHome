import { useEffect, useRef, useState } from "react";
import { Camera, ScanFace } from "lucide-react";

interface FaceCameraProps {
  onCapture: (image: string) => void;
  captureLabel?: string;
  disabled?: boolean;
  autoCaptureKey?: string;
  autoCaptureDelayMs?: number;
  hideCaptureButton?: boolean;
  statusText?: string;
}

export function FaceCamera({
  onCapture,
  captureLabel = "Chụp ảnh",
  disabled = false,
  autoCaptureKey,
  autoCaptureDelayMs = 1600,
  hideCaptureButton = false,
  statusText,
}: FaceCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        setCameraError("Camera chưa được cấp quyền hoặc không khả dụng.");
      }
    }

    startCamera();

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError("Camera chưa sẵn sàng. Vui lòng thử lại.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL("image/jpeg", 0.9));
  };

  useEffect(() => {
    if (!autoCaptureKey || disabled || cameraError || !isReady) {
      return;
    }

    const timer = window.setTimeout(capture, autoCaptureDelayMs);
    return () => window.clearTimeout(timer);
  }, [autoCaptureDelayMs, autoCaptureKey, cameraError, disabled, isReady]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-gray-900 shadow-inner">
        {cameraError ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm font-medium text-white">
            {cameraError}
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => setIsReady(true)}
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-[78%] w-[58%] rounded-full border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.18)]" />
            </div>
            {statusText && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-2 rounded-full bg-black/55 px-4 py-2 text-xs font-semibold text-white backdrop-blur">
                <ScanFace className="h-4 w-4" />
                {statusText}
              </div>
            )}
          </>
        )}
      </div>

      {!hideCaptureButton && (
        <button
          type="button"
          onClick={capture}
          disabled={disabled || Boolean(cameraError) || !isReady}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-60"
        >
          <Camera className="h-5 w-5" />
          {captureLabel}
        </button>
      )}
    </div>
  );
}
