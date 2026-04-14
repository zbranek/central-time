#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN 10
#define RST_PIN 9
#define PHOTO_PIN 2

MFRC522 mfrc522(SS_PIN, RST_PIN);

bool lastBeamState = HIGH;
unsigned long lastTriggerTime = 0;
const int debounceMs = 200;

String lastRFID = "";
unsigned long lastRFIDTime = 0;
const int rfidTimeout = 3000; // ms

void setup() {
  Serial.begin(115200);

  pinMode(PHOTO_PIN, INPUT_PULLUP);

  SPI.begin();
  mfrc522.PCD_Init();

  Serial.println("READY");
}

void loop() {
  checkPhotoGate();
  checkRFID();
}

// ====== FOTOBUŇKA ======
void checkPhotoGate() {
  bool current = digitalRead(PHOTO_PIN);

  if (current == LOW && lastBeamState == HIGH) {
    unsigned long now = millis();

    if (now - lastTriggerTime > debounceMs) {
      triggerFinish();
      lastTriggerTime = now;
    }
  }

  lastBeamState = current;
}

// ====== RFID ======
void checkRFID() {
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial()) return;

  String uid = "";

  for (byte i = 0; i < mfrc522.uid.size; i++) {
    uid += String(mfrc522.uid.uidByte[i], HEX);
  }

  uid.toUpperCase();

  lastRFID = uid;
  lastRFIDTime = millis();

  Serial.print("RFID;");
  Serial.println(uid);

  mfrc522.PICC_HaltA();
}

// ====== FINISH EVENT ======
void triggerFinish() {
  String rider = "";

  // pokud byl RFID nedávno načten
  if (millis() - lastRFIDTime < rfidTimeout) {
    rider = lastRFID;
  }

  Serial.print("FINISH;");
  Serial.println(rider);
}