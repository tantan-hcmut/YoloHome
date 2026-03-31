#ifndef TASK_WIFI_H
#define TASK_WIFI_H

#include <WiFi.h>

bool Wifi_reconnect();
void startAP();
bool Wifi_hasStationConfig();

#endif
