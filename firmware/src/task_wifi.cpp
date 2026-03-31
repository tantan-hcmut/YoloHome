#include "task_wifi.h"
#include "global.h"

#ifndef SSID_AP
#define SSID_AP "ESP32 LOCAL"
#endif

#ifndef PASS_AP
#define PASS_AP "12345678"
#endif

namespace
{
constexpr uint32_t WIFI_RETRY_INTERVAL_MS = 10000;
constexpr uint32_t WIFI_AP_FALLBACK_DELAY_MS = 8000;
constexpr uint32_t WIFI_CONNECT_TIMEOUT_MS = 15000;
constexpr uint32_t WIFI_AP_HANDOFF_GRACE_MS = 25000;

bool gApStarted = false;
bool gStationBeginIssued = false;
bool gWifiInitialized = false;
uint32_t gLastConnectAttemptMs = 0;
uint32_t gStationConnectedSinceMs = 0;
char gLastAttemptedSsid[64] = {};

bool isApModeActive()
{
  const wifi_mode_t mode = WiFi.getMode();
  return mode == WIFI_AP || mode == WIFI_AP_STA;
}

void ensureWifiInitialized()
{
  if (gWifiInitialized)
  {
    return;
  }

  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
#if defined(ARDUINO_ARCH_ESP32)
  WiFi.setSleep(false);
#endif
  gWifiInitialized = true;
}

void rememberAttemptedSsid(const char *ssid)
{
  copyStringSafe(gLastAttemptedSsid, sizeof(gLastAttemptedSsid), ssid == nullptr ? "" : ssid);
}

bool stationConfigChanged(const RuntimeConfig &cfg)
{
  if (strncmp(gLastAttemptedSsid, cfg.wifiSsid, sizeof(gLastAttemptedSsid)) != 0)
  {
    return true;
  }

  if (WiFi.status() == WL_CONNECTED)
  {
    const String currentSsid = WiFi.SSID();
    if (!currentSsid.equals(String(cfg.wifiSsid)))
    {
      return true;
    }
  }

  return false;
}

void beginStationConnect(const RuntimeConfig &cfg)
{
  ensureWifiInitialized();
  WiFi.mode(gApStarted ? WIFI_AP_STA : WIFI_STA);
  WiFi.disconnect(false, false);
  WiFi.begin(cfg.wifiSsid, cfg.wifiPass);
  rememberAttemptedSsid(cfg.wifiSsid);
  gLastConnectAttemptMs = millis();
  gStationBeginIssued = true;
  Serial.printf("[WiFi] Connecting to SSID: %s\n", cfg.wifiSsid);
}

void stopAPIfNeeded(const bool force = false)
{
  if (!gApStarted)
  {
    return;
  }

  if (!force && gStationConnectedSinceMs != 0 && (millis() - gStationConnectedSinceMs) < WIFI_AP_HANDOFF_GRACE_MS)
  {
    return;
  }

  WiFi.softAPdisconnect(true);
  gApStarted = false;
  WiFi.mode(WIFI_STA);
  Serial.println("[WiFi] Fallback AP stopped (station connected)");
}
} // namespace

void startAP()
{
  ensureWifiInitialized();

  if (gApStarted)
  {
    return;
  }

  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(String(SSID_AP), String(PASS_AP));
  gApStarted = true;

  Serial.print("[WiFi] AP IP: ");
  Serial.println(WiFi.softAPIP());
  updateConnectivityState(WiFi.status() == WL_CONNECTED, false, true);
}

bool Wifi_hasStationConfig()
{
  RuntimeConfig cfg;
  if (!getRuntimeConfig(cfg))
  {
    return false;
  }
  return strlen(cfg.wifiSsid) > 0;
}

bool Wifi_reconnect()
{
  ensureWifiInitialized();

  RuntimeConfig cfg;
  if (!getRuntimeConfig(cfg))
  {
    return false;
  }

  if (strlen(cfg.wifiSsid) == 0)
  {
    gStationBeginIssued = false;
    rememberAttemptedSsid("");
    startAP();
    updateConnectivityState(false, false, isApModeActive());
    return false;
  }

  const wl_status_t status = WiFi.status();
  if (status == WL_CONNECTED)
  {
    if (gStationConnectedSinceMs == 0)
    {
      gStationConnectedSinceMs = millis();
    }

    const bool sameSsid = WiFi.SSID().equals(String(cfg.wifiSsid));
    if (sameSsid)
    {
      stopAPIfNeeded();
      updateConnectivityState(true, false, isApModeActive());
      return true;
    }

    Serial.println("[WiFi] Runtime SSID changed, reconnecting station...");
    WiFi.disconnect(false, true);
    gStationBeginIssued = false;
    gStationConnectedSinceMs = 0;
  }

  const uint32_t nowMs = millis();
  const bool configChanged = stationConfigChanged(cfg);
  const bool connectionExpired = gStationBeginIssued && ((nowMs - gLastConnectAttemptMs) >= WIFI_CONNECT_TIMEOUT_MS);
  const bool attemptDue = !gStationBeginIssued || configChanged || connectionExpired || ((nowMs - gLastConnectAttemptMs) >= WIFI_RETRY_INTERVAL_MS);

  if (attemptDue)
  {
    beginStationConnect(cfg);
  }

  const bool connected = WiFi.status() == WL_CONNECTED;
  if (connected)
  {
    if (gStationConnectedSinceMs == 0)
    {
      gStationConnectedSinceMs = nowMs;
    }
    stopAPIfNeeded();
    Serial.print("[WiFi] STA IP: ");
    Serial.println(WiFi.localIP());
  }
  else if (gStationBeginIssued && (nowMs - gLastConnectAttemptMs) >= WIFI_AP_FALLBACK_DELAY_MS)
  {
    startAP();
  }

  if (!connected)
  {
    gStationConnectedSinceMs = 0;
  }

  updateConnectivityState(connected, false, isApModeActive());
  return connected;
}
