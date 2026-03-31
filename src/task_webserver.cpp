#include "task_webserver.h"

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

bool webserver_isrunning = false;

void Webserver_sendata(String data)
{
    if (ws.count() > 0)
    {
        ws.textAll(data);
        Serial.println("[WS] TX => " + data);
    }
}

void onEvent(AsyncWebSocket *server,
             AsyncWebSocketClient *client,
             AwsEventType type,
             void *arg,
             uint8_t *data,
             size_t len)
{
    (void)server;
    if (type == WS_EVT_CONNECT)
    {
        Serial.printf("[WS] Client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
    }
    else if (type == WS_EVT_DISCONNECT)
    {
        Serial.printf("[WS] Client #%u disconnected\n", client->id());
    }
    else if (type == WS_EVT_DATA)
    {
        AwsFrameInfo *info = reinterpret_cast<AwsFrameInfo *>(arg);
        if (info->opcode == WS_TEXT && info->final && info->index == 0)
        {
            String message(reinterpret_cast<const char *>(data), len);
            handleWebSocketMessage(message);
        }
    }
}

void connnectWSV()
{
    ws.onEvent(onEvent);
    server.addHandler(&ws);

    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request)
              { request->send(LittleFS, "/index.html", "text/html"); });
    server.on("/script.js", HTTP_GET, [](AsyncWebServerRequest *request)
              { request->send(LittleFS, "/script.js", "application/javascript"); });
    server.on("/styles.css", HTTP_GET, [](AsyncWebServerRequest *request)
              { request->send(LittleFS, "/styles.css", "text/css"); });
    server.on("/health", HTTP_GET, [](AsyncWebServerRequest *request)
              { request->send(200, "application/json", "{\"ok\":true,\"service\":\"YoloHome WebServer\"}"); });

    DefaultHeaders::Instance().addHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    ElegantOTA.begin(&server);
    server.begin();
    webserver_isrunning = true;
    Serial.println("[WEB] HTTP + WebSocket + OTA ready");
}

void Webserver_stop()
{
    ws.closeAll();
    server.end();
    webserver_isrunning = false;
}

void Webserver_reconnect()
{
    if (!webserver_isrunning)
    {
        connnectWSV();
    }
    ElegantOTA.loop();
    ws.cleanupClients();
}
