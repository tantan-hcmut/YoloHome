export const API_BASE_URL = "http://localhost:5000";

export type FaceChallengeStep = "CENTER" | "LEFT" | "RIGHT" | "UP" | "DOWN";

export interface CapturedFrame {
  step: FaceChallengeStep;
  image: string;
}

export interface FaceProfile {
  id: string;
  name: string;
  createdAt: string | null;
}

export const stepLabels: Record<FaceChallengeStep, string> = {
  CENTER: "Nhìn thẳng vào camera",
  LEFT: "Quay mặt sang trái",
  RIGHT: "Quay mặt sang phải",
  UP: "Ngẩng mặt lên",
  DOWN: "Cúi mặt xuống",
};

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseJson(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Yêu cầu thất bại");
  }
  return data;
}

export async function getFaceStatus(): Promise<{ hasFaces: boolean; count: number }> {
  const response = await fetch(`${API_BASE_URL}/api/faces/status`);
  return parseJson(response);
}

export async function createFaceChallenge(): Promise<{ challengeId: string; steps: FaceChallengeStep[] }> {
  const response = await fetch(`${API_BASE_URL}/api/faces/challenge`, { method: "POST" });
  return parseJson(response);
}

export async function faceLogin(challengeId: string, frames: CapturedFrame[]) {
  const response = await fetch(`${API_BASE_URL}/api/auth/face-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeId, frames }),
  });
  return parseJson(response);
}

export async function listFaces(): Promise<FaceProfile[]> {
  const response = await fetch(`${API_BASE_URL}/api/faces`, {
    headers: authHeaders(),
  });
  const data = await parseJson(response);
  return data.faces || [];
}

export async function addFace(name: string, image: string): Promise<FaceProfile> {
  const response = await fetch(`${API_BASE_URL}/api/faces`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ name, image }),
  });
  const data = await parseJson(response);
  return data.face;
}

export async function deleteFace(id: string) {
  const response = await fetch(`${API_BASE_URL}/api/faces/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return parseJson(response);
}
