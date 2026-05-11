import { RotateCcw, ShieldCheck } from "lucide-react";
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
  const currentStep = steps[index];

  const handleCapture = (image: string) => {
    if (!currentStep) {
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
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-[#6366f1]" />
          <div>
            <p className="text-sm font-semibold text-gray-800">{currentStep ? stepLabels[currentStep] : "Đang xác thực khuôn mặt..."}</p>
            <p className="text-xs font-medium text-gray-500">
              Bước {Math.min(index + 1, steps.length)}/{steps.length}
            </p>
          </div>
        </div>
      </div>

      <FaceCamera
        onCapture={handleCapture}
        captureLabel={busy ? "Đang xác thực khuôn mặt..." : "Chụp bước này"}
        disabled={busy}
      />

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={reset}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
        >
          <RotateCcw className="h-4 w-4" />
          Thử lại
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
