#ifndef TASK_WEBSERVER_H
#define TASK_WEBSERVER_H

#include <ArduinoJson.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ElegantOTA.h>
#include "LittleFS.h"
#include "task_handler.h"

extern AsyncWebServer server;
extern AsyncWebSocket ws;

void Webserver_stop();
void Webserver_reconnect();
void Webserver_sendata(String data);

#endif
