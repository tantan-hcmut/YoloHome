import { RotateCcw, ScanFace, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { stepLabels, type CapturedFrame, type FaceChallengeStep } from "../api/faceApi";
import { FaceCamera } from "./FaceCamera";

interface FaceChallengeCaptureProps {
  steps: FaceChallengeStep[];
  onComplete: (frames: CapturedFrame[]) => void;
  onCancel?: () => void;
  busy?: boolean;
}

export function FaceChallengeCapture({ steps, onComplete, onCancel, busy = false }: FaceChallengeCaptureProps) {
  const [index, setIndex] = useState(0);
  const [frames, setFrames] = useState<CapturedFrame[]>([]);
  const [scanRound, setScanRound] = useState(0);
  const currentStep = steps[index];
  const isFinished = index >= steps.length;

  const handleCapture = (image: string) => {
    if (!currentStep || busy) {
      return;
    }

    const nextFrames = [...frames, { step: currentStep, image }];
    setFrames(nextFrames);

    if (index + 1 >= steps.length) {
      onComplete(nextFrames);
      return;
    }

    setIndex(index + 1);
  };

  const reset = () => {
    setIndex(0);
    setFrames([]);
    setScanRound((value) => value + 1);
  };

  const progress = Math.min(index + 1, steps.length);
  const autoCaptureKey = currentStep && !busy && !isFinished ? `${scanRound}-${index}-${currentStep}` : undefined;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-[#6366f1]" />
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {busy ? "Đang xác thực khuôn mặt..." : currentStep ? stepLabels[currentStep] : "Đang hoàn tất quét khuôn mặt..."}
            </p>
            <p className="text-xs font-medium text-gray-500">
              Tự động quét bước {progress}/{steps.length}
            </p>
          </div>
        </div>
      </div>

      <FaceCamera
        onCapture={handleCapture}
        autoCaptureKey={autoCaptureKey}
        autoCaptureDelayMs={currentStep === "CENTER" ? 1200 : 1800}
        hideCaptureButton
        disabled={busy || isFinished}
        statusText={busy ? "Đang xác thực..." : "Giữ khuôn mặt trong khung, hệ thống sẽ tự quét"}
      />

      <div className="flex items-center justify-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-semibold text-gray-600 shadow-sm">
        <ScanFace className="h-4 w-4 text-[#6366f1]" />
        Không cần bấm chụp từng tấm
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={reset}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
        >
          <RotateCcw className="h-4 w-4" />
          Quét lại
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            Đăng nhập bằng mật khẩu
          </button>
        )}
      </div>
    </div>
  );
}
