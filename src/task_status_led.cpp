#include "task_status_led.h"

#include <Adafruit_NeoPixel.h>
#include "global.h"
#include "hw_pins.h"

namespace
{
constexpr uint32_t BOOT_INDICATOR_GRACE_MS = 2500;
constexpr bool ONBOARD_LED_ACTIVE_HIGH = true;

Adafruit_NeoPixel onboardRgb(ONBOARD_RGB_LED_COUNT, PIN_ONBOARD_RGB, NEO_GRB + NEO_KHZ800);

void writeOnboardLed(const bool turnOn)
{
  const uint8_t level = turnOn
                            ? (ONBOARD_LED_ACTIVE_HIGH ? HIGH : LOW)
                            : (ONBOARD_LED_ACTIVE_HIGH ? LOW : HIGH);
  digitalWrite(PIN_ONBOARD_LED, level);
}

void setOnboardRgb(const RuntimeConfig &cfg, uint8_t r, uint8_t g, uint8_t b, uint8_t brightness)
{
  if (!cfg.onboardRgbEnabled)
  {
    onboardRgb.clear();
    onboardRgb.show();
    return;
  }

  onboardRgb.setBrightness(brightness);
  onboardRgb.setPixelColor(0, onboardRgb.Color(r, g, b));
  onboardRgb.show();
}

SystemIndicatorMode resolveIndicatorMode(const SystemState &st, const uint32_t nowMs, const uint32_t bootStartedMs)
{
  if ((nowMs - bootStartedMs) < BOOT_INDICATOR_GRACE_MS && st.sensorTimestampMs == 0)
  {
    return SYS_MODE_BOOT;
  }

  if (st.sensorTimestampMs != 0 && !st.sensorValid)
  {
    return SYS_MODE_FAULT;
  }
  if (st.voiceActive)
  {
    return SYS_MODE_VOICE_ACTIVE;
  }
  if (st.overrideMode != OVERRIDE_MODE_AUTO)
  {
    return SYS_MODE_MANUAL_LOCKDOWN;
  }
  if (st.autoFanRequest && st.fanOn)
  {
    return SYS_MODE_AI_COOLING;
  }
  if (st.apModeActive && !st.wifiConnected)
  {
    return SYS_MODE_AP_CONFIG;
  }
  if (st.wifiConnected && !st.cloudConnected)
  {
    return SYS_MODE_WIFI_ONLY;
  }
  return SYS_MODE_NORMAL;
}

void publishResolvedMode(SystemIndicatorMode mode)
{
  if (xStateMutex != nullptr && xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(20)) == pdTRUE)
  {
    gState.indicatorMode = mode;
    xSemaphoreGive(xStateMutex);
  }
}
} // namespace

void task_status_led(void *pvParameters)
{
  (void)pvParameters;

  pinMode(PIN_ONBOARD_LED, OUTPUT);
  writeOnboardLed(false);

  onboardRgb.begin();
  onboardRgb.clear();
  onboardRgb.show();

  uint32_t tick = 0;
  const uint32_t bootStartedMs = millis();

  RuntimeConfig cfg = {};
  SystemState st = {};
  cfg.onboardLedEnabled = true;
  cfg.onboardRgbEnabled = true;
  st.indicatorMode = SYS_MODE_BOOT;

  getRuntimeConfig(cfg);
  getSystemState(st);
  publishResolvedMode(SYS_MODE_BOOT);

  for (;;)
  {
    RuntimeConfig nextCfg = cfg;
    SystemState nextSt = st;

    if (getRuntimeConfig(nextCfg))
    {
      cfg = nextCfg;
    }

    if (getSystemState(nextSt))
    {
      st = nextSt;
    }

    const uint32_t nowMs = millis();
    const SystemIndicatorMode effectiveMode = resolveIndicatorMode(st, nowMs, bootStartedMs);
    if (effectiveMode != st.indicatorMode)
    {
      st.indicatorMode = effectiveMode;
      publishResolvedMode(effectiveMode);
    }

    const bool blinkSlow = ((tick / 5U) % 2U) == 0U;
    const bool blinkFast = ((tick / 2U) % 2U) == 0U;
    const bool pulse = ((tick / 8U) % 2U) == 0U;

    if (!cfg.onboardLedEnabled)
    {
      writeOnboardLed(false);
    }
    else
    {
      switch (effectiveMode)
      {
      case SYS_MODE_FAULT:
      case SYS_MODE_VOICE_ACTIVE:
        writeOnboardLed(blinkFast);
        break;
      case SYS_MODE_MANUAL_LOCKDOWN:
        writeOnboardLed(true);
        break;
      case SYS_MODE_AI_COOLING:
      case SYS_MODE_AP_CONFIG:
      case SYS_MODE_WIFI_ONLY:
      case SYS_MODE_NORMAL:
      case SYS_MODE_BOOT:
      default:
        writeOnboardLed(blinkSlow);
        break;
      }
    }

    switch (effectiveMode)
    {
    case SYS_MODE_FAULT:
      setOnboardRgb(cfg, 255, 0, 0, 96);
      break;
    case SYS_MODE_VOICE_ACTIVE:
      setOnboardRgb(cfg, blinkFast ? 255 : 16, blinkFast ? 255 : 16, blinkFast ? 255 : 16, 96);
      break;
    case SYS_MODE_MANUAL_LOCKDOWN:
      setOnboardRgb(cfg, pulse ? 180 : 96, 0, 255, 96);
      break;
    case SYS_MODE_AI_COOLING:
      setOnboardRgb(cfg, 255, pulse ? 128 : 64, 0, 110);
      break;
    case SYS_MODE_AP_CONFIG:
      setOnboardRgb(cfg, 0, 64, pulse ? 255 : 96, 100);
      break;
    case SYS_MODE_WIFI_ONLY:
      setOnboardRgb(cfg, 0, pulse ? 180 : 90, 255, 96);
      break;
    case SYS_MODE_NORMAL:
      setOnboardRgb(cfg, 0, 255, 0, 80);
      break;
    case SYS_MODE_BOOT:
    default:
      // Use a dedicated blue startup pulse instead of white so startup can be
      // visually distinguished from the normal runtime states.
      setOnboardRgb(cfg, 0, 96, pulse ? 255 : 140, 72);
      break;
    }

    tick++;
    vTaskDelay(pdMS_TO_TICKS(80));
  }
}
