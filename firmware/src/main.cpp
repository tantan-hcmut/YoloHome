#include <Arduino.h>

#include "global.h"
#include "task_adafruit_io.h"
#include "task_actuator.h"
#include "task_check_info.h"
#include "task_control_logic.h"
#include "task_status_led.h"
#include "task_toogle_boot.h"
#include "task_webserver.h"
#include "temp_humi_monitor.h"
#include "tinyml.h"

void setup()
{
  Serial.begin(115200);
  delay(250);
  Serial.println("\n[YoloHome] Booting...");

  initGlobalResources();
  check_info_File(false);
  Webserver_reconnect();

  // Bring up user-facing indicators and the BOOT button first so the board
  // immediately reflects the current startup phase and factory reset remains
  // responsive even while networking is still initializing.
  xTaskCreatePinnedToCore(task_status_led,
                          "StatusLedTask",
                          4096,
                          nullptr,
                          2,
                          nullptr,
                          0);

  xTaskCreatePinnedToCore(Task_Toogle_BOOT,
                          "BootButtonTask",
                          4096,
                          nullptr,
                          5,
                          nullptr,
                          1);

  xTaskCreatePinnedToCore(temp_humi_monitor,
                          "SensorTask",
                          4096,
                          nullptr,
                          3,
                          nullptr,
                          1);

  xTaskCreatePinnedToCore(tiny_ml_task,
                          "TinyMLTask",
                          8192,
                          nullptr,
                          2,
                          nullptr,
                          1);

  xTaskCreatePinnedToCore(task_control_logic,
                          "ControlLogicTask",
                          4096,
                          nullptr,
                          4,
                          nullptr,
                          1);

  xTaskCreatePinnedToCore(task_actuator,
                          "ActuatorTask",
                          4096,
                          nullptr,
                          3,
                          nullptr,
                          0);

  xTaskCreatePinnedToCore(task_adafruit_io,
                          "AdafruitIoTask",
                          6144,
                          nullptr,
                          2,
                          nullptr,
                          0);
}

void loop()
{
  Webserver_reconnect();
  vTaskDelay(pdMS_TO_TICKS(50));
}
