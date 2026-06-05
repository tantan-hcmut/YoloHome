import { Lightbulb, Fan, Loader, PowerOff, RotateCcw, Settings } from "lucide-react";
import { motion } from "motion/react";
import { useState, useEffect, useRef } from "react";
import { PageLoading } from "../components/PageLoading";

interface Device {
  id: string;
  ten_thiet_bi: string;
  loai_thiet_bi: "den" | "quat" | "sensor";
  nha_id: number;
  vi_tri_lap_dat: string;
  trang_thai?: {
    trang_thai_bat_tat: boolean;
    toc_do?: number;
    mau_sac?: string;
  };
}

interface RuntimeState {
  overrideModeText?: string;
}

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;
const SLIDER_DEBOUNCE_MS = 450;

// Convert hex to RGB
const hexToRgb = (hex: string): {r: number; g: number; b: number} => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : {r: 255, g: 255, b: 255};
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const clampBrightness = (value: number) => clamp(value, 0, 100);

const clampPercent = (value: number) => clamp(value, 0, 100);

const resolveFanMode = (mode?: string) => {
  if (mode === "FORCE_OFF" || mode === "FORCED_OFF") return "FORCE_OFF";
  if (mode === "FORCE_ON" || mode === "FORCED_ON") return "FORCE_ON";
  return "AUTO";
};

const getFanModeClass = (mode?: string) => {
  const resolved = resolveFanMode(mode);
  if (resolved === "AUTO") return "bg-cyan-50 text-cyan-700 border-cyan-100";
  if (resolved === "FORCE_OFF") return "bg-gray-100 text-gray-600 border-gray-200";
  return "bg-indigo-50 text-[#6366f1] border-indigo-100";
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((value) => clamp(Number(value) || 0, 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;

const getBrightnessPreviewHex = (r: number, g: number, b: number, brightness: number) => {
  const ratio = clampBrightness(Number(brightness)) / 100;
  return rgbToHex(
    Math.round(255 - (255 - clamp(Number(r) || 0, 0, 255)) * ratio),
    Math.round(255 - (255 - clamp(Number(g) || 0, 0, 255)) * ratio),
    Math.round(255 - (255 - clamp(Number(b) || 0, 0, 255)) * ratio)
  );
};

const getLightState = (device: Device) => {
  const fallback = { r: 255, g: 255, b: 255, brightness: 96 };
  const savedColor = device.trang_thai?.mau_sac;

  if (!savedColor) {
    return { ...fallback, hex: rgbToHex(fallback.r, fallback.g, fallback.b) };
  }

  try {
    const parsed = JSON.parse(savedColor);
    const r = clamp(Number(parsed.r ?? parsed.LightR ?? fallback.r), 0, 255);
    const g = clamp(Number(parsed.g ?? parsed.lightG ?? fallback.g), 0, 255);
    const b = clamp(Number(parsed.b ?? parsed.lightB ?? fallback.b), 0, 255);
    const brightness = clampBrightness(Number(parsed.brightness ?? fallback.brightness));
    return { r, g, b, brightness, hex: rgbToHex(r, g, b) };
  } catch {
    if (savedColor.startsWith("#")) {
      const rgb = hexToRgb(savedColor);
      return { ...rgb, brightness: clampBrightness(fallback.brightness), hex: rgbToHex(rgb.r, rgb.g, rgb.b) };
    }

    const parts = savedColor.split(",").map((part) => Number(part.trim()));
    if (parts.length >= 3 && parts.every((part) => Number.isFinite(part))) {
      const r = clamp(parts[0], 0, 255);
      const g = clamp(parts[1], 0, 255);
      const b = clamp(parts[2], 0, 255);
      return { r, g, b, brightness: clampBrightness(fallback.brightness), hex: rgbToHex(r, g, b) };
    }
  }

  return { ...fallback, brightness: clampBrightness(fallback.brightness), hex: rgbToHex(fallback.r, fallback.g, fallback.b) };
};

export function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [controlLoading, setControlLoading] = useState<string | null>(null);
  const [runtimeState, setRuntimeState] = useState<RuntimeState | null>(null);
  const [draftLightControls, setDraftLightControls] = useState<Record<string, { r: number; g: number; b: number; brightness: number }>>({});
  const [draftFanSpeeds, setDraftFanSpeeds] = useState<Record<string, number>>({});
  const sliderTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const latestSliderPayloadsRef = useRef<Record<string, {
    deviceId: string;
    action: "set_rgb" | "set_speed";
    additionalData: any;
  }>>({});
  const lastSentSliderPayloadsRef = useRef<Record<string, { signature: string; time: number }>>({});

  // Fetch devices từ API
  useEffect(() => {
    fetchDevices();
    fetchRuntimeState();
    const refreshDevices = () => {
      fetchDevices();
      fetchRuntimeState();
    };
    window.addEventListener("yolohome:devices-updated", refreshDevices);
    const interval = setInterval(refreshDevices, 1000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("yolohome:devices-updated", refreshDevices);
    };
  }, []);

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/thiet-bi`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const devicesList = Array.isArray(data) ? data : (data.data || []);
        setDevices(devicesList);
      }
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch devices:", error);
      setLoading(false);
    }
  };

  const fetchRuntimeState = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/cam-bien/runtime`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) return;

      const result = await response.json();
      setRuntimeState(result.data || null);
    } catch (error) {
      console.error("Failed to fetch runtime state:", error);
    }
  };

  // Control device
  useEffect(() => {
    return () => {
      Object.values(sliderTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  const handleControl = async (
    deviceId: string,
    action: "on" | "off" | "auto" | "set_rgb" | "set_speed",
    additionalData?: any
  ) => {
    const previousDevices = devices;
    const previousRuntimeState = runtimeState;
    const targetDevice = devices.find((device) => device.id === deviceId);

    if (targetDevice?.loai_thiet_bi === "quat") {
      if (action === "auto") {
        setRuntimeState((current) => ({ ...(current || {}), overrideModeText: "AUTO" }));
      } else if (action === "off") {
        setRuntimeState((current) => ({ ...(current || {}), overrideModeText: "FORCE_OFF" }));
      } else if (action === "on" || action === "set_speed") {
        setRuntimeState((current) => ({ ...(current || {}), overrideModeText: "FORCE_ON" }));
      }
    }

    if (action !== "auto") {
      setDevices((currentDevices) =>
        currentDevices.map((device) => {
          if (device.id !== deviceId) return device;

          const currentState = device.trang_thai || { trang_thai_bat_tat: false };
          if (action === "off") {
            return {
              ...device,
              trang_thai: {
                ...currentState,
                trang_thai_bat_tat: false,
                toc_do: device.loai_thiet_bi === "quat" ? 0 : currentState.toc_do,
              },
            };
          }

          if (action === "set_speed") {
            return {
              ...device,
              trang_thai: {
                ...currentState,
                trang_thai_bat_tat: true,
                toc_do: clampPercent(Number(additionalData?.speed ?? currentState.toc_do ?? 0)),
              },
            };
          }

          if (action === "set_rgb") {
            const nextColor = {
              r: clamp(Number(additionalData?.r ?? 255), 0, 255),
              g: clamp(Number(additionalData?.g ?? 255), 0, 255),
              b: clamp(Number(additionalData?.b ?? 255), 0, 255),
              brightness: clampBrightness(Number(additionalData?.brightness ?? 96)),
            };
            return {
              ...device,
              trang_thai: {
                ...currentState,
                trang_thai_bat_tat: true,
                mau_sac: JSON.stringify(nextColor),
              },
            };
          }

          if (action === "on") {
            return {
              ...device,
              trang_thai: {
                ...currentState,
                trang_thai_bat_tat: true,
              },
            };
          }

          return device;
        })
      );
    }

    setControlLoading(deviceId);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/thiet-bi/${deviceId}/control`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          ...additionalData,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const updatedState = result?.data?.trang_thai;

        if (updatedState) {
          setDevices((currentDevices) =>
            currentDevices.map((device) =>
              device.id === deviceId
                ? { ...device, trang_thai: updatedState }
                : device
            )
          );

          if (action === "set_rgb") {
            setDraftLightControls((current) => {
              const draft = current[deviceId];
              if (
                !draft ||
                draft.r !== additionalData?.r ||
                draft.g !== additionalData?.g ||
                draft.b !== additionalData?.b ||
                draft.brightness !== additionalData?.brightness
              ) {
                return current;
              }

              const { [deviceId]: _removed, ...next } = current;
              return next;
            });
          }

          if (action === "set_speed") {
            setDraftFanSpeeds((current) => {
              if (current[deviceId] !== additionalData?.speed) {
                return current;
              }

              const { [deviceId]: _removed, ...next } = current;
              return next;
            });
          }
        } else {
          await fetchDevices();
        }
      } else {
        setDevices(previousDevices);
        setRuntimeState(previousRuntimeState);
      }
    } catch (error) {
      console.error("Failed to control device:", error);
      setDevices(previousDevices);
      setRuntimeState(previousRuntimeState);
    } finally {
      setControlLoading(null);
    }
  };

  const handleTurnOffAll = async () => {
    const previousDevices = devices;
    setDevices((currentDevices) =>
      currentDevices.map((device) => {
        if (!["den", "quat"].includes(device.loai_thiet_bi)) return device;

        const currentState = device.trang_thai || { trang_thai_bat_tat: false };
        return {
          ...device,
          trang_thai: {
            ...currentState,
            trang_thai_bat_tat: false,
            toc_do: device.loai_thiet_bi === "quat" ? 0 : currentState.toc_do,
          },
        };
      })
    );
    setDraftFanSpeeds({});

    setControlLoading("all");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/thiet-bi/control-all`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "off" }),
      });

      if (response.ok) {
        const result = await response.json();
        const updatedDevices = result?.data || [];
        setDevices((currentDevices) =>
          currentDevices.map((device) => {
            const updated = updatedDevices.find((item: any) => item.id === device.id);
            return updated ? { ...device, trang_thai: updated.trang_thai } : device;
          })
        );
      } else {
        setDevices(previousDevices);
      }
    } catch (error) {
      console.error("Failed to turn off all devices:", error);
      setDevices(previousDevices);
    } finally {
      setControlLoading(null);
    }
  };

  const handleApplyDefaults = async () => {
    const previousDevices = devices;
    const defaultLightState = { r: 255, g: 255, b: 255, brightness: 50 };

    setDevices((currentDevices) =>
      currentDevices.map((device) => {
        const currentState = device.trang_thai || { trang_thai_bat_tat: false };

        if (device.loai_thiet_bi === "den") {
          return {
            ...device,
            trang_thai: {
              ...currentState,
              mau_sac: JSON.stringify(defaultLightState),
            },
          };
        }

        if (device.loai_thiet_bi === "quat") {
          return {
            ...device,
            trang_thai: {
              ...currentState,
              toc_do: 50,
            },
          };
        }

        return device;
      })
    );

    setDraftLightControls((current) => {
      const next = { ...current };
      devices.filter((device) => device.loai_thiet_bi === "den").forEach((device) => {
        next[device.id] = defaultLightState;
      });
      return next;
    });
    setDraftFanSpeeds((current) => {
      const next = { ...current };
      devices.filter((device) => device.loai_thiet_bi === "quat").forEach((device) => {
        next[device.id] = 50;
      });
      return next;
    });

    setControlLoading("defaults");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/thiet-bi/defaults`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const result = await response.json();
        const updatedDevices = result?.data || [];
        setDevices((currentDevices) =>
          currentDevices.map((device) => {
            const updated = updatedDevices.find((item: any) => item.id === device.id);
            return updated ? { ...device, trang_thai: updated.trang_thai } : device;
          })
        );
      } else {
        setDevices(previousDevices);
      }
    } catch (error) {
      console.error("Failed to apply default device settings:", error);
      setDevices(previousDevices);
    } finally {
      setControlLoading(null);
    }
  };

  const scheduleSliderControl = (
    key: string,
    deviceId: string,
    action: "set_rgb" | "set_speed",
    additionalData: any
  ) => {
    latestSliderPayloadsRef.current[key] = { deviceId, action, additionalData };

    if (sliderTimersRef.current[key]) {
      clearTimeout(sliderTimersRef.current[key]);
    }

    sliderTimersRef.current[key] = setTimeout(() => {
      delete sliderTimersRef.current[key];
      sendSliderControl(key, latestSliderPayloadsRef.current[key]);
    }, SLIDER_DEBOUNCE_MS);
  };

  const sendSliderControl = (
    key: string,
    payload?: { deviceId: string; action: "set_rgb" | "set_speed"; additionalData: any }
  ) => {
    if (!payload) return;

    const signature = JSON.stringify(payload);
    const lastSent = lastSentSliderPayloadsRef.current[key];
    const now = Date.now();
    if (lastSent?.signature === signature && now - lastSent.time < 300) {
      return;
    }

    lastSentSliderPayloadsRef.current[key] = { signature, time: now };
    handleControl(payload.deviceId, payload.action, payload.additionalData);
  };

  const flushSliderControl = (
    key: string,
    deviceId: string,
    action: "set_rgb" | "set_speed",
    additionalData: any
  ) => {
    if (sliderTimersRef.current[key]) {
      clearTimeout(sliderTimersRef.current[key]);
      delete sliderTimersRef.current[key];
    }

    const payload = latestSliderPayloadsRef.current[key] ?? { deviceId, action, additionalData };
    sendSliderControl(key, payload);
  };

  const clearSliderControl = (key: string) => {
    if (sliderTimersRef.current[key]) {
      clearTimeout(sliderTimersRef.current[key]);
      delete sliderTimersRef.current[key];
    }

    delete latestSliderPayloadsRef.current[key];
  };

  const getDisplayLightState = (device: Device) => {
    const savedState = getLightState(device);
    const draft = draftLightControls[device.id];
    if (!draft) return savedState;

    const r = clamp(draft.r, 0, 255);
    const g = clamp(draft.g, 0, 255);
    const b = clamp(draft.b, 0, 255);
    const brightness = clampBrightness(draft.brightness);
    return { r, g, b, brightness, hex: rgbToHex(r, g, b) };
  };

  const getDisplayFanSpeed = (device: Device) =>
    draftFanSpeeds[device.id] ?? clampPercent(Number(device.trang_thai?.toc_do || 0));

  const lights = devices.filter((d) => d.loai_thiet_bi === "den");
  const fans = devices.filter((d) => d.loai_thiet_bi === "quat");

  if (loading) {
    return <PageLoading />;
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-8 mb-6 border border-white/40 shadow-xl">
        <div className="flex items-center justify-between flex-wrap">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Thiết Bị</h1>
            <p className="text-sm text-gray-500">Điều khiển thiết bị</p>
          </div>     
          <div className="flex items-center gap-4">            
            <button
              type="button"
              onClick={handleApplyDefaults}
              disabled={controlLoading === "defaults"}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-50 text-[#6366f1] border border-indigo-100 font-semibold text-sm hover:bg-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {controlLoading === "defaults" ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Settings className="w-4 h-4" />
              )}
              Khôi phục cài đặt
            </button>
            <button
              type="button"
              onClick={handleTurnOffAll}
              disabled={controlLoading === "all"}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-red-50 text-red-600 border border-red-100 font-semibold text-sm hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {controlLoading === "all" ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <PowerOff className="w-4 h-4" />
              )}
              Tắt tất cả
            </button>
          </div>
        </div>
      </div>

      {/* Lights Section */}
      <div className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="bg-gradient-to-r from-indigo-400/90 to-purple-400/70 backdrop-blur-xl rounded-2xl px-6 py-4 mb-4 border border-white/30 shadow-lg flex items-center gap-3"
        >
          <Lightbulb className="w-6 h-6 text-white" />
          <h2 className="text-xl font-bold text-white">Đèn</h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lights.map((device, index) => {
            const lightState = getDisplayLightState(device);
            const lightPreviewHex = getBrightnessPreviewHex(
              lightState.r,
              lightState.g,
              lightState.b,
              lightState.brightness
            );
            const lightSliderKey = `light-${device.id}`;
            const lightIsOn = !!device.trang_thai?.trang_thai_bat_tat;

            return (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg"
            >
              {/* Device Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${
                    device.trang_thai?.trang_thai_bat_tat ? 'from-blue-400 to-purple-400' : 'from-gray-200 to-gray-300'
                  } rounded-xl flex items-center justify-center`}>
                    <Lightbulb
                      className={`w-6 h-6 ${lightIsOn ? 'text-white' : 'text-gray-500'}`}
                      style={lightIsOn ? {
                        filter: `drop-shadow(0 0 ${Math.max(2, lightState.brightness / 12)}px ${lightPreviewHex})`,
                      } : undefined}
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{device.ten_thiet_bi}</h3>
                    <p className="text-xs text-gray-500">{device.vi_tri_lap_dat}</p>
                  </div>
                </div>
              </div>

              {/* Power Toggle Section */}
              <div className="flex items-center justify-between mb-4 p-4 bg-gradient-to-br from-cyan-50 to-purple-50 rounded-xl">
                <span className="text-sm font-semibold text-gray-700">Power</span>
                <button
                  onClick={() => {
                    console.log("Light power clicked:", device.id);
                    clearSliderControl(lightSliderKey);
                    if (lightIsOn) {
                      handleControl(device.id, "off");
                    } else {
                      handleControl(device.id, "set_rgb", {
                        r: lightState.r,
                        g: lightState.g,
                        b: lightState.b,
                        brightness: lightState.brightness,
                      });
                    }
                  }}
                  disabled={controlLoading === device.id}
                  className={`relative w-14 h-8 rounded-full transition-all cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed ${
                    lightIsOn
                      ? 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]'
                      : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform pointer-events-none ${
                    lightIsOn ? 'translate-x-6' : ''
                  }`}></div>
                </button>
              </div>

              {/* Color Picker */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Màu sắc</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={lightState.hex}
                      onChange={(e) => {
                        const rgb = hexToRgb(e.target.value);
                        const nextLightState = {
                          r: rgb.r,
                          g: rgb.g,
                          b: rgb.b,
                          brightness: lightState.brightness,
                        };
                        setDraftLightControls((current) => ({
                          ...current,
                          [device.id]: nextLightState,
                        }));
                        if (lightIsOn) {
                          flushSliderControl(lightSliderKey, device.id, "set_rgb", nextLightState);
                        }
                      }}
                      disabled={controlLoading === device.id}
                      className="w-10 h-10 cursor-pointer rounded-full border-2 border-white shadow-[0_0_4px_rgba(0,0,0,0.5)] bg-transparent overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:border-none"
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-gray-400">
                    <span>Xem trước</span>
                    <span>{lightPreviewHex.toUpperCase()}</span>
                  </div>
                  <div
                    className="h-14 w-full rounded-xl border border-gray-200 shadow-inner"
                    style={{ backgroundColor: lightPreviewHex }}
                    title="Brightness preview"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Độ sáng</span>
                    <span className="text-sm font-bold text-[#6366f1]">{lightState.brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={lightState.brightness}
                    onChange={(e) => {
                      const nextLightState = {
                        r: lightState.r,
                        g: lightState.g,
                        b: lightState.b,
                        brightness: clampBrightness(Number(e.target.value)),
                      };
                      setDraftLightControls((current) => ({
                        ...current,
                        [device.id]: nextLightState,
                      }));
                      if (lightIsOn) {
                        scheduleSliderControl(lightSliderKey, device.id, "set_rgb", nextLightState);
                      }
                    }}
                    onPointerUp={() => {
                      if (lightIsOn) flushSliderControl(lightSliderKey, device.id, "set_rgb", lightState);
                    }}
                    onTouchEnd={() => {
                      if (lightIsOn) flushSliderControl(lightSliderKey, device.id, "set_rgb", lightState);
                    }}
                    onKeyUp={() => {
                      if (lightIsOn) flushSliderControl(lightSliderKey, device.id, "set_rgb", lightState);
                    }}
                    className="device-range w-full"
                    style={{
                      background: `linear-gradient(to right, #6366f1 0%, #8b5cf6 ${lightState.brightness}%, #e5e7eb ${lightState.brightness}%, #e5e7eb 100%)`
                    }}
                  />
                </div>
              </div>
            </motion.div>
            );
          })}
        </div>
      </div>

      {/* Fans Section */}
      <div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-indigo-400/90 to-purple-400/70 backdrop-blur-xl rounded-2xl px-6 py-4 mb-4 border border-white/30 shadow-lg flex items-center gap-3"
        >
          <Fan className="w-6 h-6 text-white" />
          <h2 className="text-xl font-bold text-white">Quạt</h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fans.map((device, index) => {
            const fanSpeed = getDisplayFanSpeed(device);
            const fanSliderKey = `fan-${device.id}`;
            const fanIsOn = !!device.trang_thai?.trang_thai_bat_tat;
            const fanMode = resolveFanMode(runtimeState?.overrideModeText);

            return (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg"
            >
              {/* Device Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${
                    device.trang_thai?.trang_thai_bat_tat ? 'from-blue-400 to-purple-400' : 'from-gray-200 to-gray-300'
                  } rounded-xl flex items-center justify-center`}>
                    <Fan className={`w-6 h-6 ${fanIsOn ? 'text-white animate-spin' : 'text-gray-500'}`}
                      style={{ animationDuration: fanIsOn ? `${Math.max(0.4, 2 - fanSpeed / 100)}s` : 'auto' }}
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{device.ten_thiet_bi}</h3>
                    <p className="text-xs text-gray-500">{device.vi_tri_lap_dat}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-bold ${getFanModeClass(fanMode)}`}>
                  {fanMode}
                </span>
              </div>

              {/* Power Toggle Section */}
              <div className="flex items-center justify-between mb-4 p-4 bg-gradient-to-br from-cyan-50 to-purple-50 rounded-xl">
                <span className="text-sm font-semibold text-gray-700">Bật/Tắt</span>
                <button
                  onClick={() => {
                    console.log("Fan power clicked:", device.id);
                    clearSliderControl(fanSliderKey);
                    if (fanIsOn) {
                      handleControl(device.id, "off");
                    } else {
                      handleControl(device.id, "set_speed", {
                        speed: fanSpeed,
                      });
                    }
                  }}
                  disabled={controlLoading === device.id}
                  className={`relative w-14 h-8 rounded-full transition-all cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed ${
                    fanIsOn
                      ? 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]'
                      : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform pointer-events-none ${
                    fanIsOn ? 'translate-x-6' : ''
                  }`}></div>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  clearSliderControl(fanSliderKey);
                  handleControl(device.id, "auto");
                }}
                disabled={controlLoading === device.id}
                className="mb-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-[#6366f1] transition-all hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                Trả về Auto
              </button>

              {/* Speed Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Tốc độ</span>
                  <span className="text-sm font-bold text-[#6366f1]">{fanSpeed}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={fanSpeed}
                  onChange={(e) => {
                    const nextSpeed = clampPercent(Number(e.target.value));
                    setDraftFanSpeeds((current) => ({
                      ...current,
                      [device.id]: nextSpeed,
                    }));
                    if (fanIsOn) {
                      scheduleSliderControl(fanSliderKey, device.id, "set_speed", {
                        speed: nextSpeed,
                      });
                    }
                  }}
                  onPointerUp={() => {
                    if (fanIsOn) {
                      flushSliderControl(fanSliderKey, device.id, "set_speed", {
                        speed: fanSpeed,
                      });
                    }
                  }}
                  onTouchEnd={() => {
                    if (fanIsOn) {
                      flushSliderControl(fanSliderKey, device.id, "set_speed", {
                        speed: fanSpeed,
                      });
                    }
                  }}
                  onKeyUp={() => {
                    if (fanIsOn) {
                      flushSliderControl(fanSliderKey, device.id, "set_speed", {
                        speed: fanSpeed,
                      });
                    }
                  }}
                  className="device-range w-full"
                  style={{
                    background: `linear-gradient(to right, #6366f1 0%, #8b5cf6 ${fanSpeed}%, #e5e7eb ${fanSpeed}%, #e5e7eb 100%)`
                  }}
                />
              </div>
            </motion.div>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {lights.length === 0 && fans.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Không có thiết bị nào</p>
        </div>
      )}
    </div>
  );
}
