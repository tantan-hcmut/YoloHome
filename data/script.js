let ws = null;
let reconnectTimer = null;

const state = {
  config: null,
  runtime: null,
  sensorHistory: [],
  tinyHistory: [],
  chartMaxPoints: 40,
};

// Flags khóa UI chống nhảy lùi giá trị (Bộ đếm thời gian cho từng UI Control)
const uiLocks = {
  fan: null,
  light: null,
  color: null,
  wifiForm: null,
  aioForm: null,
  automationForm: null,
  rampForm: null,
  isAiRunning: false // Theo dõi xem AI có đang giành quyền điều khiển quạt không
};

// Cờ kiểm tra trạng thái mạng
let currentIp = null;
let configPollInterval = null;
let configPollDeadlineTimer = null;

const flowState = {
  pendingWifi: false,
  pendingAio: false,
  pendingWifiSsid: "",
  knownApIp: "192.168.4.1",
  knownStationIp: "",
  allowAutoReconnect: true,
};

const $ = (id) => document.getElementById(id);

// ================ System Utils ================

// Hàm cập nhật ô input nhưng bỏ qua nếu người dùng đang đặt con trỏ chuột gõ vào đó
function updateInputIfNotFocused(id, newValue) {
    const el = $(id);
    if (el && document.activeElement !== el) {
        el.value = newValue;
    }
}

// Hàm đặt khóa UI trong 4 giây. Mọi cập nhật từ server vào UI đó sẽ bị chặn để người dùng kịp thao tác
function lockUI(key) {
    if (uiLocks[key]) clearTimeout(uiLocks[key]);
    uiLocks[key] = setTimeout(() => { uiLocks[key] = null; }, 4000); 
}
function isUILocked(key) {
    return uiLocks[key] !== null;
}

function showToast(message, type = "info") {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.className = `toast ${type} show`;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    el.className = "toast";
  }, 3000);
}

function setDot(id, status) {
  const el = $(id);
  if (!el) return;
  el.className = "pulse-dot";
  if (status === "warn") el.classList.add("warn");
  else if (status === "offline") el.classList.add("offline");
}

function initNavigation() {
  const buttons = document.querySelectorAll(".nav-item");
  const pages = document.querySelectorAll(".page");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      buttons.forEach((b) => b.classList.remove("active"));
      pages.forEach((page) => page.classList.remove("active"));
      btn.classList.add("active");
      const targetPage = $(target);
      if (targetPage) targetPage.classList.add("active");
      
      if (target === 'page-overview') drawSensorChart();
    });
  });
}

function setupToggleBtn(id, onChangeCallback) {
  const btn = $(id);
  if (!btn) return;
  btn.addEventListener("click", () => {
    const isCurrentlyOn = btn.classList.contains("on");
    const newState = !isCurrentlyOn;
    
    // Đảo trạng thái hiển thị ngay lập tức để tạo cảm giác phản hồi nhanh
    setToggleBtnState(id, newState);
    
    if (typeof onChangeCallback === "function") {
      onChangeCallback(newState);
    }
  });
}

function setToggleBtnState(id, isON) {
  const btn = $(id);
  if (!btn) return;
  if (isON) {
    btn.classList.add("on");
    btn.textContent = "BẬT";
  } else {
    btn.classList.remove("on");
    btn.textContent = "TẮT";
  }
}

function setupPasswordToggle(inputId, btnId) {
    const input = $(inputId);
    const btn = $(btnId);
    if (!input || !btn) return;
    
    btn.addEventListener("click", () => {
        if (input.type === "password") {
            input.type = "text";
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        } else {
            input.type = "password";
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        }
    });
}


function lockForm(key, ms = 12000) {
  if (uiLocks[key]) clearTimeout(uiLocks[key]);
  uiLocks[key] = setTimeout(() => { uiLocks[key] = null; }, ms);
}

function clearFormLock(key) {
  if (uiLocks[key]) clearTimeout(uiLocks[key]);
  uiLocks[key] = null;
}

function isFormLocked(key) {
  return uiLocks[key] !== null;
}

function formContainsFocus(formId) {
  const form = $(formId);
  return !!(form && document.activeElement && form.contains(document.activeElement));
}

function bindFormDirty(formId, lockKey) {
  const form = $(formId);
  if (!form) return;
  form.querySelectorAll("input, select, textarea").forEach((el) => {
    ["input", "change", "keydown"].forEach((evt) => {
      el.addEventListener(evt, () => lockForm(lockKey));
    });
  });
}


function validIp(ip) {
  return typeof ip === "string" && ip.length > 0 && ip !== "0.0.0.0";
}

function closeStatusModal() {
  const modal = $("status-modal");
  if (modal) modal.classList.remove("show");
}

function showStatusModal({
  type = "info",
  title = "Thông báo hệ thống",
  message = "",
  linkHref = "",
  linkText = "",
  primaryText = "",
  secondaryText = "Đóng",
  lockClose = false,
}) {
  const modal = $("status-modal");
  const icon = $("status-modal-icon");
  const titleEl = $("status-modal-title");
  const msgEl = $("status-modal-message");
  const linkBox = $("status-modal-link-box");
  const linkEl = $("status-modal-link");
  const primaryBtn = $("status-modal-primary");
  const secondaryBtn = $("status-modal-secondary");
  if (!modal || !icon || !titleEl || !msgEl || !linkBox || !linkEl || !primaryBtn || !secondaryBtn) return;

  icon.className = `modal-icon ${type}`.trim();
  titleEl.textContent = title;
  msgEl.textContent = message;

  if (linkHref) {
    linkEl.href = linkHref;
    linkEl.textContent = linkText || linkHref;
    linkBox.classList.remove("hidden");
  } else {
    linkBox.classList.add("hidden");
    linkEl.href = "#";
    linkEl.textContent = "http://0.0.0.0";
  }

  if (primaryText && linkHref) {
    primaryBtn.textContent = primaryText;
    primaryBtn.href = linkHref;
    primaryBtn.classList.remove("hidden");
  } else {
    primaryBtn.classList.add("hidden");
    primaryBtn.href = "#";
  }

  secondaryBtn.textContent = secondaryText;
  secondaryBtn.disabled = !!lockClose;
  secondaryBtn.onclick = () => {
    if (!lockClose) closeStatusModal();
  };

  modal.classList.add("show");
}

function stopConfigPolling() {
  if (configPollInterval) {
    clearInterval(configPollInterval);
    configPollInterval = null;
  }
  if (configPollDeadlineTimer) {
    clearTimeout(configPollDeadlineTimer);
    configPollDeadlineTimer = null;
  }
}

function startConfigPolling(timeoutMs = 30000, intervalMs = 1000, onTimeout = null) {
  stopConfigPolling();
  configPollInterval = setInterval(() => {
    sendJson({ page: "get_config" });
  }, intervalMs);
  configPollDeadlineTimer = setTimeout(() => {
    stopConfigPolling();
    if (typeof onTimeout === "function") onTimeout();
  }, timeoutMs);
}

function beginWifiFlow(ssid) {
  flowState.pendingWifi = true;
  flowState.pendingWifiSsid = ssid || "(WiFi mới)";
  flowState.allowAutoReconnect = false;
  showStatusModal({
    type: "info",
    title: "Đang lưu cấu hình Wi‑Fi",
    message: `Thiết bị đang lưu cấu hình và sẽ thử kết nối vào mạng "${flowState.pendingWifiSsid}". Vui lòng chờ...`,
    secondaryText: "Đóng tạm",
  });
}

function beginAioFlow() {
  flowState.pendingAio = true;
  if (state.config?.runtime?.wifiConnected) {
    showStatusModal({
      type: "info",
      title: "Đang lưu Adafruit IO",
      message: "Thiết bị đã lưu cấu hình cloud và đang kiểm tra kết nối Adafruit IO...",
      secondaryText: "Đóng tạm",
    });
  } else {
    showStatusModal({
      type: "warn",
      title: "Đã lưu Adafruit IO",
      message: "Cấu hình Adafruit IO đã được lưu. Hệ thống sẽ chỉ kết nối cloud sau khi Wi‑Fi kết nối thành công.",
      secondaryText: "Đã hiểu",
    });
  }
}

// ================ WebSocket Connection ================
function connectWebSocket() {
  clearTimeout(reconnectTimer);
  const gateway = `ws://${window.location.host}/ws`;
  setDot("ws-dot", "warn");
  $("ws-text").textContent = "Đang kết nối...";

  ws = new WebSocket(gateway);

  ws.onopen = () => {
    setDot("ws-dot", "online");
    $("ws-text").textContent = "Đã kết nối";
    sendJson({ page: "get_config" });
    if (flowState.allowAutoReconnect) {
      showToast("Đã thiết lập kết nối tới phần cứng", "success");
    }
  };

  ws.onclose = () => {
    setDot("ws-dot", "offline");
    $("ws-text").textContent = "Mất kết nối";

    if (flowState.pendingWifi) {
      stopConfigPolling();
      const linkIp = flowState.knownStationIp;
      if (validIp(linkIp)) {
        showStatusModal({
          type: "success",
          title: "Wi‑Fi đã sẵn sàng",
          message: "Board đã rời địa chỉ 192.168.4.1. Hãy mở lại giao diện bằng địa chỉ IP mới dưới đây.",
          linkHref: `http://${linkIp}`,
          linkText: `http://${linkIp}`,
          primaryText: "Mở địa chỉ mới",
          secondaryText: "Đóng",
        });
      } else {
        showStatusModal({
          type: "warn",
          title: "Board đang chuyển sang Wi‑Fi mới",
          message: `Kết nối tới 192.168.4.1 đã ngắt vì thiết bị đang chuyển sang mạng "${flowState.pendingWifiSsid || "Wi‑Fi mới"}". Hãy kết nối máy của bạn sang cùng mạng đó, sau đó truy cập lại bằng IP mới của board (xem trên router hoặc Serial Monitor).`,
          secondaryText: "Đã hiểu",
        });
      }
      return;
    }

    if (!flowState.allowAutoReconnect) {
      return;
    }

    reconnectTimer = setTimeout(connectWebSocket, 2000);
  };

  ws.onerror = () => {
    setDot("ws-dot", "offline");
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleWsMessage(data);
    } catch (err) {
      console.warn("WebSocket Payload Parsing Error", err);
    }
  };
}

function sendJson(payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  } else {
    showToast("Lỗi: Không thể gửi lệnh. Đã mất kết nối.", "error");
  }
}

// ================ Message Handlers ================
function handleWsMessage(data) {
  const page = data.page;
  if (!page) return;

  switch (page) {
    case "sensor": handleSensor(data); break;
    case "tinyml": handleTinyml(data); break;
    case "control": handleControl(data); break;
    case "config": handleConfig(data.value || {}); break;
    case "setting_saved":
    case "threshold_saved": 
      clearFormLock("wifiForm");
      clearFormLock("aioForm");
      clearFormLock("automationForm");
      clearFormLock("rampForm");

      if (flowState.pendingWifi) {
        showStatusModal({
          type: "info",
          title: "Đã lưu Wi‑Fi",
          message: `Thiết bị đang thử kết nối vào mạng "${flowState.pendingWifiSsid || "Wi‑Fi mới"}". Khi lấy được IP mới, hệ thống sẽ hiển thị ngay tại đây.`,
          secondaryText: "Đóng tạm",
        });
        startConfigPolling(45000, 1000, () => {
          flowState.pendingWifi = false;
          flowState.allowAutoReconnect = true;
          showStatusModal({
            type: "warn",
            title: "Chưa nhận được IP mới",
            message: `Thiết bị đã lưu Wi‑Fi nhưng giao diện hiện tại không nhận được địa chỉ IP mới kịp thời. Hãy kiểm tra router / Serial Monitor để lấy IP của board trong mạng "${flowState.pendingWifiSsid || "Wi‑Fi mới"}" rồi mở lại giao diện.`,
            secondaryText: "Đã hiểu",
          });
        });
        break;
      }

      if (flowState.pendingAio) {
        if (state.config?.runtime?.wifiConnected) {
          showStatusModal({
            type: "info",
            title: "Đã lưu Adafruit IO",
            message: "Thiết bị đang kiểm tra kết nối cloud. Vui lòng chờ trong giây lát...",
            secondaryText: "Đóng tạm",
          });
          startConfigPolling(20000, 1200, () => {
            flowState.pendingAio = false;
            showStatusModal({
              type: "warn",
              title: "Cloud chưa lên ngay",
              message: "Cấu hình Adafruit IO đã được lưu nhưng giao diện chưa thấy cloud online trong thời gian chờ. Hãy kiểm tra lại Wi‑Fi, AIO Username và AIO Key.",
              secondaryText: "Đã hiểu",
            });
          });
        } else {
          flowState.pendingAio = false;
          showStatusModal({
            type: "warn",
            title: "Đã lưu Adafruit IO",
            message: "Cấu hình cloud đã được lưu. Tuy nhiên thiết bị chưa có Wi‑Fi, nên Adafruit IO sẽ chỉ kết nối sau khi Wi‑Fi kết nối thành công.",
            secondaryText: "Đã hiểu",
          });
        }
        break;
      }

      showToast(data.message || "Cập nhật cấu hình thành công", "success");
      break;
    case "setting_error":
    case "threshold_error":
    case "voice_error":
    case "device_error":
      clearFormLock("wifiForm");
      clearFormLock("aioForm");
      clearFormLock("automationForm");
      clearFormLock("rampForm");
      stopConfigPolling();
      flowState.pendingWifi = false;
      flowState.pendingAio = false;
      flowState.allowAutoReconnect = true;
      showStatusModal({
        type: "error",
        title: "Cập nhật cấu hình thất bại",
        message: data.message || "Đã xảy ra lỗi khi cập nhật cấu hình.",
        secondaryText: "Đóng",
      });
      break;
    case "fan_command_queued":
    case "light_command_queued":
    case "device_saved": showToast(data.message || "Lệnh điều khiển đã được gửi", "info"); break;
    case "reset_done":
      alert("Đã gửi lệnh Factory Reset. Đang thực thi trình khởi động lại hệ thống...");
      setTimeout(() => window.location.reload(), 1500);
      break;
    case "device":
      if(data.value && data.value.name === "LED1") setToggleBtnState("toggle-led1", data.value.status === "ON");
      if(data.value && data.value.name === "LED2") setToggleBtnState("toggle-led2", data.value.status === "ON");
      break;
  }
}

// ================ System Updates ================
function handleSensor(data) {
  if (typeof data.temp === "number") $("temp-value").textContent = data.temp.toFixed(1);
  if (typeof data.humi === "number") $("humi-value").textContent = data.humi.toFixed(0);

  const status = resolveEnvironmentState(data.temp, data.humi);
  const stEl = $("env-state");
  stEl.textContent = status.label;
  stEl.style.color = status.color;

  if (typeof data.temp === "number" && typeof data.humi === "number") {
    pushSensorPoint(data.temp, data.humi);
    drawSensorChart();
  }
}

function handleTinyml(data) {
  if (typeof data.score === "number") $("tiny-score").textContent = data.score.toFixed(3);
  if (typeof data.smooth === "number") $("tiny-smooth").textContent = data.smooth.toFixed(3);
  if (typeof data.acc === "number") $("tiny-acc").textContent = `${data.acc.toFixed(1)}%`;
  
  $("tiny-pred").textContent = data.pred ? "BẤT THƯỜNG (Nóng)" : "BÌNH THƯỜNG";
  $("tiny-pred").style.color = data.pred ? "var(--danger)" : "var(--primary)";
  $("tiny-gt").textContent = data.gt ? "HOT (Bất thường)" : "NORMAL";

  const score = typeof data.score === "number" ? data.score : 0;
  state.tinyHistory.push({ score, hot: !!data.pred });
  if (state.tinyHistory.length > state.chartMaxPoints) state.tinyHistory.shift();
  renderTinyBars();
}

function handleControl(data) {
  const speed = Number(data.fanSpeedPercent || 0);
  
  // Lưu cờ kiểm tra xem AI có đang tự bật quạt không
  uiLocks.isAiRunning = !!data.autoFanRequest;
  
  $("fan-state-text").textContent = `Trạng thái: ${data.fanOn ? "Hoạt động" : "Ngắt"}`;
  $("fan-chip").textContent = data.autoFanRequest ? "CHẾ ĐỘ AI" : data.fanOn ? "MANUAL" : "OFF";
  $("auto-target-speed").textContent = Number(data.aiTargetFanSpeedPercent || 0);
  $("auto-elapsed").textContent = formatMinutes(data.aiCoolingElapsedMs || 0);
  $("badge-override").textContent = decodeOverride(data.overrideMode);

  // Chỉ cập nhật Slider nếu nó không bị khóa bởi người dùng (Drag Lock)
  if (!isUILocked("fan")) {
    $("fan-speed-slider").value = speed;
    $("fan-speed-readout").textContent = `${speed}%`;
  }

  if (data.lightState) {
    const { r = 255, g = 255, b = 255, brightness = 255 } = data.lightState;
    const hex = rgbToHex(r, g, b);
    
    // Đổi tỷ lệ 0-255 về 0-100%
    const bright100 = Math.round((brightness / 255) * 100);
    
    if (!isUILocked("color")) {
        $("light-color").value = hex;
    }
    if (!isUILocked("light")) {
        $("light-brightness").value = bright100;
        $("light-brightness-readout").textContent = bright100 + "%";
    }
    
    // Luôn update nền review
    updateLightPreview($("light-color").value, $("light-brightness").value);
  }

  setDot("cloud-dot", data.cloudConnected ? "online" : (data.wifiConnected ? "warn" : "offline"));
  $("cloud-text").textContent = data.cloudConnected ? "Cloud Đã kết nối" : (data.wifiConnected ? "Mạng khả dụng" : "Ngoại tuyến");
}

function handleConfig(cfg) {
  state.config = cfg;
  state.runtime = cfg.runtime || null;

  const runtime = cfg.runtime || {};
  const stationIp = validIp(runtime.stationIp) ? runtime.stationIp : (runtime.wifiConnected && validIp(runtime.ip) && runtime.ip !== "192.168.4.1" ? runtime.ip : "");
  const apIp = validIp(runtime.apIp) ? runtime.apIp : ((!runtime.wifiConnected && validIp(runtime.ip)) ? runtime.ip : "");
  const preferredIp = stationIp || apIp || (validIp(runtime.ip) ? runtime.ip : "0.0.0.0");

  if (validIp(apIp)) flowState.knownApIp = apIp;
  if (validIp(stationIp)) flowState.knownStationIp = stationIp;
  currentIp = preferredIp;
  if ($("badge-ip")) $("badge-ip").textContent = preferredIp || "0.0.0.0";

  if (flowState.pendingWifi && runtime.wifiConnected && validIp(stationIp)) {
    flowState.pendingWifi = false;
    if (flowState.pendingAio) {
      showStatusModal({
        type: runtime.cloudConnected ? "success" : "info",
        title: runtime.cloudConnected ? "Wi‑Fi và Cloud đã sẵn sàng" : "Wi‑Fi đã sẵn sàng",
        message: runtime.cloudConnected
          ? "Thiết bị đã vào mạng mới và kết nối Adafruit IO thành công. Dùng địa chỉ dưới đây để tiếp tục điều khiển."
          : "Thiết bị đã vào mạng mới. Hệ thống đang tiếp tục kết nối Adafruit IO ở nền. Dùng địa chỉ dưới đây để tiếp tục điều khiển.",
        linkHref: `http://${stationIp}`,
        linkText: `http://${stationIp}`,
        primaryText: "Mở địa chỉ mới",
        secondaryText: "Đóng",
      });
      flowState.pendingAio = false;
      stopConfigPolling();
      flowState.allowAutoReconnect = false;
    } else {
      showStatusModal({
        type: "success",
        title: "Wi‑Fi đã kết nối thành công",
        message: "Thiết bị đã nhận được địa chỉ IP mới. Hãy mở lại giao diện bằng đường dẫn dưới đây.",
        linkHref: `http://${stationIp}`,
        linkText: `http://${stationIp}`,
        primaryText: "Mở địa chỉ mới",
        secondaryText: "Đóng",
      });
      stopConfigPolling();
      flowState.allowAutoReconnect = false;
    }
  } else if (flowState.pendingAio && !flowState.pendingWifi && runtime.cloudConnected) {
    flowState.pendingAio = false;
    stopConfigPolling();
    showStatusModal({
      type: "success",
      title: "Adafruit IO đã kết nối",
      message: "Thiết bị đã lưu cấu hình cloud và kết nối Adafruit IO thành công.",
      linkHref: validIp(stationIp) ? `http://${stationIp}` : "",
      linkText: validIp(stationIp) ? `http://${stationIp}` : "",
      primaryText: validIp(stationIp) ? "Mở giao diện" : "",
      secondaryText: "Đóng",
    });
  }

  // Settings
  if (cfg.settings && !isFormLocked("wifiForm") && !formContainsFocus("wifi-form")) {
    updateInputIfNotFocused("wifi-ssid", cfg.settings.ssid || "");
    updateInputIfNotFocused("wifi-pass", cfg.settings.password || "");
  }
  if (cfg.settings && !isFormLocked("aioForm") && !formContainsFocus("aio-form")) {
    updateInputIfNotFocused("aio-username", cfg.settings.aioUsername || "");
    updateInputIfNotFocused("aio-key", cfg.settings.aioKey || "");
    updateInputIfNotFocused("aio-feed-prefix", cfg.settings.feedPrefix || "yolohome");
  }

  // Thresholds
  if (cfg.thresholds && !isFormLocked("automationForm") && !formContainsFocus("automation-form")) {
    updateInputIfNotFocused("temp-cold", cfg.thresholds.tempCold ?? 25);
    updateInputIfNotFocused("temp-hot", cfg.thresholds.tempHot ?? 30);
    updateInputIfNotFocused("humi-dry", cfg.thresholds.humiDry ?? 40);
    updateInputIfNotFocused("humi-humid", cfg.thresholds.humiHumid ?? 70);
    updateInputIfNotFocused("ai-on", cfg.thresholds.aiOn ?? 0.65);
    updateInputIfNotFocused("ai-off", cfg.thresholds.aiOff ?? 0.45);
  }

  // Timing
  if (cfg.timing && !isFormLocked("automationForm") && !formContainsFocus("automation-form")) {
    updateInputIfNotFocused("override-minutes", cfg.timing.overrideMinutes ?? 5);
  }

  // Flags
  if (cfg.flags) setToggleBtnState("btn-auto-fan", !!cfg.flags.autoFanEnabled);

  // Ramp Profile
  if (cfg.fanRamp && !isFormLocked("rampForm") && !formContainsFocus("ramp-form")) {
    $("fan-ramp-start").value = cfg.fanRamp.startPercent ?? 50;
    $("fan-ramp-mid").value = cfg.fanRamp.midPercent ?? 70;
    $("fan-ramp-end").value = cfg.fanRamp.endPercent ?? 100;
    $("fan-ramp-mid-minutes").value = cfg.fanRamp.midMinutes ?? 5;
    $("fan-ramp-full-minutes").value = cfg.fanRamp.fullMinutes ?? 10;
    updateRampViz();
  }

  if (cfg.runtime) {
    setDot("cloud-dot", cfg.runtime.cloudConnected ? "online" : (cfg.runtime.wifiConnected ? "warn" : "offline"));
  }

  if (Array.isArray(cfg.devices)) {
    renderDevicesInfo(cfg.devices);
    const led1 = cfg.devices.find((d) => d.name === "LED1");
    const led2 = cfg.devices.find((d) => d.name === "LED2");
    if (led1) setToggleBtnState("toggle-led1", led1.status === "ON");
    if (led2) setToggleBtnState("toggle-led2", led2.status === "ON");
  }
}

// ================ Formatting & Helpers ================
function resolveEnvironmentState(temp, humi) {
  if (!state.config || !state.config.thresholds) return { label: "MÔI TRƯỜNG ỔN ĐỊNH", color: "var(--success)" };
  const thr = state.config.thresholds;
  if (temp > thr.tempHot || humi > thr.humiHumid) return { label: "MỨC NGUY HIỂM (Nóng/Ẩm)", color: "var(--danger)" };
  if (temp < thr.tempCold || humi < thr.humiDry) return { label: "CẢNH BÁO (Lạnh/Khô)", color: "var(--warning)" };
  return { label: "MÔI TRƯỜNG ỔN ĐỊNH", color: "var(--success)" };
}

function formatMinutes(ms) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}m ${seconds}s`;
}

function decodeOverride(val) {
  if (val === 1) return "FORCED ON";
  if (val === 2) return "FORCED OFF";
  return "AUTO RUN";
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`;
}
function hexToRgb(hex) {
  const raw = hex.replace("#", "");
  return { r: parseInt(raw.slice(0, 2), 16), g: parseInt(raw.slice(2, 4), 16), b: parseInt(raw.slice(4, 6), 16) };
}

function updateLightPreview(hex, brightness100) {
  const preview = $("light-preview");
  if (!preview) return;
  const alpha = Math.max(0.1, Math.min(1, Number(brightness100 || 0) / 100));
  preview.style.background = `${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
}

function updateRampViz() {
  $("viz-start").textContent = `${$("fan-ramp-start").value || 0}%`;
  $("viz-mid").textContent = `${$("fan-ramp-mid").value || 0}%`;
  $("viz-end").textContent = `${$("fan-ramp-end").value || 0}%`;
}

function renderDevicesInfo(devices) {
  const list = $("device-list");
  if (!list) return;
  list.innerHTML = "";
  devices.forEach((dev) => {
    list.innerHTML += `
      <div class="device-card-mini">
        <strong>${dev.label || dev.name}</strong>
        <div><span>Trạng thái I/O:</span> <span>${dev.status || "--"}</span></div>
        <div><span>Chân GPIO:</span> <span class="mono">${dev.gpio ?? "--"}</span></div>
        ${dev.speedPercent !== undefined ? `<div><span>Xung PWM:</span> <span>${dev.speedPercent}%</span></div>` : ""}
      </div>
    `;
  });
}

// ================ Drawing Charts ================
function pushSensorPoint(temp, humi) {
  const label = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  state.sensorHistory.push({ label, temp, humi });
  if (state.sensorHistory.length > state.chartMaxPoints) state.sensorHistory.shift();
}

function drawSensorChart() {
  const canvas = $("sensorChart");
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const history = state.sensorHistory;
  if (!history.length) return;

  const left = 30; const right = 10; const top = 15; const bottom = 25;
  const w = canvas.width - left - right;
  const h = canvas.height - top - bottom;

  const values = history.flatMap((p) => [p.temp, p.humi]);
  let min = Math.min(...values); let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15;
  min -= pad; max += pad;

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = top + (h / 4) * i;
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(canvas.width - right, y); ctx.stroke();
    ctx.fillStyle = "#94a3b8"; ctx.font = "10px sans-serif";
    ctx.fillText(Math.round(max - ((max-min)/4)*i), 5, y + 4);
  }

  const mapY = (v) => top + h * (1 - (v - min) / (max - min));
  const stepX = history.length > 1 ? w / (history.length - 1) : w;

  function drawLine(key, strokeColor) {
    ctx.beginPath();
    history.forEach((p, i) => {
      const x = left + stepX * i;
      const y = mapY(p[key]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = strokeColor; ctx.lineWidth = 2.5; ctx.stroke();
  }
  
  drawLine("temp", "#f97316");
  drawLine("humi", "#3b82f6");
}

function renderTinyBars() {
  const container = $("tiny-bars");
  if (!container) return;
  container.innerHTML = "";
  state.tinyHistory.forEach((item) => {
    const bar = document.createElement("div");
    bar.className = `tiny-bar ${item.hot ? "hot" : ""}`;
    const h = Math.max(8, Math.min(100, item.score * 100));
    bar.style.height = `${h}%`;
    container.appendChild(bar);
  });
}

// ================ Binding Events ================

// Kiểm tra ghi đè AI
function checkAiOverride() {
    if (uiLocks.isAiRunning) {
        return confirm("Hệ thống trợ lý AI đang TỰ ĐỘNG BẬT quạt làm mát. Bạn có chắc chắn muốn can thiệp tắt/bật thủ công không?");
    }
    return true;
}

function bindEvents() {
  
  // Nút Show/Hide Passwords
  setupPasswordToggle("wifi-pass", "toggle-wifi-pass");
  setupPasswordToggle("aio-key", "toggle-aio-key");

  bindFormDirty("wifi-form", "wifiForm");
  bindFormDirty("aio-form", "aioForm");
  bindFormDirty("automation-form", "automationForm");
  bindFormDirty("ramp-form", "rampForm");

  // Gắn Lock Timer để Slider không nhảy khi đang thao tác
  $("fan-speed-slider").addEventListener("input", (e) => {
      lockUI("fan");
      $("fan-speed-readout").textContent = `${e.target.value}%`;
  });
  
  $("light-brightness").addEventListener("input", (e) => {
      lockUI("light");
      $("light-brightness-readout").textContent = e.target.value + "%";
      updateLightPreview($("light-color").value, e.target.value);
  });
  
  $("light-color").addEventListener("input", (e) => {
      lockUI("color");
      updateLightPreview(e.target.value, $("light-brightness").value);
  });

  // Fan Actions
  $("btn-fan-on").addEventListener("click", () => {
      if (!checkAiOverride()) return;
      lockUI("fan"); // Khóa thêm UI sau khi gửi để không bị giật lùi chờ phản hồi
      sendJson({ page: "device", value: { name: "FAN", status: "ON", action: "SET_SPEED", speed: Number($("fan-speed-slider").value) }})
  });
  
  $("btn-fan-auto").addEventListener("click", () => {
      sendJson({ page: "device", value: { name: "FAN", action: "AUTO" }})
  });
  
  $("btn-fan-off").addEventListener("click", () => {
      if (!checkAiOverride()) return;
      sendJson({ page: "device", value: { name: "FAN", status: "OFF" }})
  });

  // Light Actions
  $("btn-light-on").addEventListener("click", () => {
    lockUI("light");
    lockUI("color");
    const rgb = hexToRgb($("light-color").value);
    const b255 = Math.round((Number($("light-brightness").value) / 100) * 255);
    sendJson({ page: "device", value: { name: "LIGHT", status: "ON", r: rgb.r, g: rgb.g, b: rgb.b, brightness: b255 }});
  });
  
  $("btn-light-off").addEventListener("click", () => sendJson({ page: "device", value: { name: "LIGHT", status: "OFF" }}));

  // Toggle internal LEDs
  setupToggleBtn("toggle-led1", (isON) => {
    sendJson({ page: "device", value: { name: "LED1", status: isON ? "ON" : "OFF" }});
  });
  setupToggleBtn("toggle-led2", (isON) => {
    sendJson({ page: "device", value: { name: "LED2", status: isON ? "ON" : "OFF" }});
  });
  
  setupToggleBtn("btn-auto-fan", null); 

  // Forms Actions
  $("wifi-form").addEventListener("submit", (e) => {
    e.preventDefault();
    lockForm("wifiForm", 15000);
    flowState.pendingAio = false;
    beginWifiFlow($("wifi-ssid").value.trim());
    sendJson({ page: "setting", value: { ssid: $("wifi-ssid").value.trim(), password: $("wifi-pass").value }});
  });

  $("aio-form").addEventListener("submit", (e) => {
    e.preventDefault();
    lockForm("aioForm", 15000);
    beginAioFlow();
    sendJson({ page: "setting", value: { aioUsername: $("aio-username").value.trim(), aioKey: $("aio-key").value.trim(), feedPrefix: $("aio-feed-prefix").value.trim() }});
  });

  $("automation-form").addEventListener("submit", (e) => {
    e.preventDefault();
    lockForm("automationForm", 15000);
    sendJson({
      page: "automation",
      value: {
        tempCold: Number($("temp-cold").value), tempHot: Number($("temp-hot").value),
        humiDry: Number($("humi-dry").value), humiHumid: Number($("humi-humid").value),
        aiOn: Number($("ai-on").value), aiOff: Number($("ai-off").value),
        overrideMinutes: Number($("override-minutes").value),
        autoFanEnabled: $("btn-auto-fan").classList.contains("on")
      }
    });
  });

  $("ramp-form").addEventListener("submit", (e) => {
    e.preventDefault();
    lockForm("rampForm", 15000);
    sendJson({
      page: "automation",
      value: {
        fanRampStartPercent: Number($("fan-ramp-start").value),
        fanRampMidPercent: Number($("fan-ramp-mid").value),
        fanRampEndPercent: Number($("fan-ramp-end").value),
        fanRampMidMinutes: Number($("fan-ramp-mid-minutes").value),
        fanRampFullMinutes: Number($("fan-ramp-full-minutes").value)
      }
    });
  });
  
  ["fan-ramp-start", "fan-ramp-mid", "fan-ramp-end"].forEach((id) => {
    $(id).addEventListener("input", updateRampViz);
  });

  // Factory Reset
  $("btn-reset").addEventListener("click", () => {
    if (confirm("CẢNH BÁO: Bạn đang yêu cầu xóa cấu hình phần cứng. Bạn có chắc chắn muốn tiến hành định dạng lại LittleFS và Factory Reset thiết bị?")) {
      sendJson({ page: "reset_factory" });
    }
  });
}

// ================ Application Startup ================
window.addEventListener("resize", drawSensorChart);

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  bindEvents();
  if ($("status-modal-secondary")) {
    $("status-modal-secondary").addEventListener("click", () => {
      if (!flowState.pendingWifi) {
        flowState.allowAutoReconnect = true;
      }
      closeStatusModal();
    });
  }
  connectWebSocket();
});