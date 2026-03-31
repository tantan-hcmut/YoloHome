#include "task_toogle_boot.h"

#include <Arduino.h>

#include "hw_pins.h"
#include "task_check_info.h"

namespace
{
constexpr uint32_t HOLD_TIME_MS = 3000;
constexpr uint32_t DEBOUNCE_MS = 40;
constexpr uint32_t SAMPLE_MS = 20;

bool isBootPressedRaw()
{
  return digitalRead(PIN_BOOT_BUTTON) == LOW;
}
} // namespace

void Task_Toogle_BOOT(void *pvParameters)
{
  (void)pvParameters;
  pinMode(PIN_BOOT_BUTTON, INPUT_PULLUP);

  bool stablePressed = false;
  bool resetTriggered = false;
  uint32_t debounceStartMs = 0;
  uint32_t stablePressStartMs = 0;
  bool lastRawPressed = false;

  Serial.println("[BOOT] Hold BOOT > 3s for factory reset");

  for (;;)
  {
    const uint32_t nowMs = millis();
    const bool rawPressed = isBootPressedRaw();

    if (rawPressed != lastRawPressed)
    {
      lastRawPressed = rawPressed;
      debounceStartMs = nowMs;
    }

    if ((nowMs - debounceStartMs) >= DEBOUNCE_MS)
    {
      if (rawPressed != stablePressed)
      {
        stablePressed = rawPressed;
        if (stablePressed)
        {
          stablePressStartMs = nowMs;
          resetTriggered = false;
          Serial.println("[BOOT] Button pressed");
        }
        else
        {
          stablePressStartMs = 0;
          resetTriggered = false;
          Serial.println("[BOOT] Button released");
        }
      }
    }

    if (stablePressed && !resetTriggered && stablePressStartMs != 0 && (nowMs - stablePressStartMs) >= HOLD_TIME_MS)
    {
      resetTriggered = true;
      Serial.println("[BOOT] Factory reset triggered by BOOT button");
      Factory_reset_and_restart(250);
    }

    vTaskDelay(pdMS_TO_TICKS(SAMPLE_MS));
  }
}
