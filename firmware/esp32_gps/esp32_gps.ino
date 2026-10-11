/*
 * RouteView ESP32 GPS sender
 * Sends signed vehicle positions to /api/vehicles/ingest.
 *
 * Wokwi-compatible: use "NEO-6M GPS" part + Wi-Fi gateway.
 * Replace VEHICLE_ID, ROUTE_ID, WIFI_*, API_URL, OPERATOR_TOKEN.
 *
 * NOTE: The operator JWT should ideally be issued per device and short-lived.
 * For Wokwi demos a longer token is fine.
 */
#include <WiFi.h>
#include <HTTPClient.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>

// --- config ---
const char* WIFI_SSID   = "Wokwi-GUEST";
const char* WIFI_PASS   = "";
const char* API_URL     = "http://host.wokwi.internal:4000/api/vehicles/ingest";
const char* OPERATOR_TOKEN = "REPLACE_WITH_OPERATOR_JWT";
const long  VEHICLE_ID  = 1;
const long  ROUTE_ID    = 1;
// --------------

TinyGPSPlus gps;
HardwareSerial gpsSerial(1);

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600, SERIAL_8N1, 16, 17); // RX=16, TX=17 (Wokwi default)
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi connected");
}

unsigned long lastPost = 0;

void loop() {
  while (gpsSerial.available() > 0) gps.encode(gpsSerial.read());

  if (millis() - lastPost > 3000 && gps.location.isValid()) {
    lastPost = millis();
    postPosition(
      gps.location.lat(), gps.location.lng(),
      gps.speed.isValid() ? gps.speed.kmph() : 0.0,
      gps.course.isValid() ? (int)gps.course.deg() : 0
    );
  }
}

void postPosition(double lat, double lng, double speedKmh, int heading) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + OPERATOR_TOKEN);

  String body = String("{\"vehicle_id\":") + VEHICLE_ID +
                ",\"route_id\":" + ROUTE_ID +
                ",\"lat\":" + String(lat, 7) +
                ",\"lng\":" + String(lng, 7) +
                ",\"speed_kmh\":" + String(speedKmh, 2) +
                ",\"heading_deg\":" + heading +
                ",\"source\":\"gps\"}";

  int code = http.POST(body);
  Serial.printf("POST %d -> %s\n", code, body.c_str());
  http.end();
}