# Shelly Dimmer Gen3 HomeKit Integration via Homebridge, MQTT, Mosquitto, and Node.js Bridge

This guide documents how to control a Shelly Dimmer Gen3 from Apple HomeKit using Homebridge, the `mqttthing` plugin, Mosquitto as your MQTT broker, and a custom Node.js bridge script. The bridge script reformats MQTT messages from Homebridge into the correct RPC JSON format required by the Shelly device. The script is managed as a background service using PM2.

---

## 1. Mosquitto MQTT Broker Setup

- Install [Mosquitto](https://mosquitto.org/download/) on your Mac (or server).
  ```bash
  brew install mosquitto
  ```
- Start the Mosquitto service:
  ```bash
  brew services start mosquitto
  ```
- By default, Mosquitto listens on port 1883.  
  Your Homebridge, Shelly device, and Node.js bridge will all connect to this broker.

---

## 2. Shelly Device MQTT Configuration

- Open the Shelly web UI (e.g. `http://<shelly-ip>`).
- Go to **Settings → Integration → MQTT**.
- Enable MQTT and set the broker address to your Mac’s IP.
- Set the username and password if you configured Mosquitto for authentication (otherwise leave blank).
- Set the **Client ID** and **topic prefix** (e.g. `shellydimmerg3-<id>`).
- Save and reboot the Shelly device.

---

## 3. Homebridge & mqttthing Setup

- Install [Homebridge](https://homebridge.io/) and the [mqttthing](https://github.com/arachnetech/homebridge-mqttthing) plugin.
- Configure your Homebridge `config.json` to use `mqttthing` for your Shelly Dimmer:

```json
{
  "accessories": [
    {
      "accessory": "mqttthing",
      "type": "lightbulb",
      "name": "Kitchen Light",
      "url": "mqtt://<server-ip>",
      "topics": {
        "setOn": "shellydimmerg3-<id>/rpc",
        "setBrightness": "shellydimmerg3-<id>/rpc"
      },
      "integerValue": true,
      "logMqtt": true
    }
  ]
}
```
- Replace the topic and IP addresses with those matching your setup.

---

## 4. Node.js Bridge Script

Because Shelly Gen3 expects a single RPC JSON payload for on/off and brightness, we use a Node.js script to listen for MQTT messages and reformat them.

**Install dependencies:**
```bash
npm install mqtt
```

**Example script for multiple dimmers:**
```javascript
const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://<mqtt-server-ip>');

const dimmers = [
    {
        sourceTopic: 'shellydimmerg3-<id>/rpc',
        targetTopic: 'shellydimmerg3-<id>/rpc',
        lastBrightness: 100
    }
];

client.on('connect', () => {
    dimmers.forEach(dimmer => client.subscribe(dimmer.sourceTopic));
    console.log('Shelly RPC bridge running for multiple dimmers...');
});

client.on('message', (topic, message) => {
    const msg = message.toString();
    let payload;
    const num = parseInt(msg, 10);

    const dimmer = dimmers.find(d => d.sourceTopic === topic);
    if (!dimmer) return;

    if (!isNaN(num)) {
        // We are using values of 0 and 1 as backup to turn the device on and off
        if (num === 0) {
            payload = JSON.stringify({
                id: 1,
                src: 'homebridge',
                method: 'Light.Set',
                params: { id: 0, on: false }
            });
            client.publish(dimmer.targetTopic, payload);
        } else if (num === 1) {
            payload = JSON.stringify({
                id: 1,
                src: 'homebridge',
                method: 'Light.Set',
                params: { id: 0, on: true, brightness: dimmer.lastBrightness }
            });
            client.publish(dimmer.targetTopic, payload);
        } else if (num > 1 && num <= 100) {
            dimmer.lastBrightness = num;
            payload = JSON.stringify({
                id: 1,
                src: 'homebridge',
                method: 'Light.Set',
                params: { id: 0, on: true, brightness: dimmer.lastBrightness }
            });
            client.publish(dimmer.targetTopic, payload);
        }
    } else if (msg === 'true') {
        payload = JSON.stringify({
            id: 1,
            src: 'homebridge',
            method: 'Light.Set',
            params: { id: 0, on: true, brightness: dimmer.lastBrightness }
        });
        client.publish(dimmer.targetTopic, payload);
    } else if (msg === 'false') {
        payload = JSON.stringify({
            id: 1,
            src: 'homebridge',
            method: 'Light.Set',
            params: { id: 0, on: false }
        });
        client.publish(dimmer.targetTopic, payload);
    }
});
```

---

## 5. Running the Bridge Script as a Service with PM2

**Install PM2 globally:**
```bash
npm install -g pm2
```

**Start the script with PM2:**
```bash
pm2 start /Users/<username>/proj/shelly_mqtt_bridge/shelly_rpc_bridge.js --name shelly-rpc-bridge
```

**Set PM2 to auto-start on boot:**
```bash
pm2 startup
pm2 save
```

**PM2 management commands:**
- View status: `pm2 status`
- Restart: `pm2 restart shelly-rpc-bridge`
- Stop: `pm2 stop shelly-rpc-bridge`
- View logs: `pm2 logs shelly-rpc-bridge`

---

## 6. Summary

- Mosquitto acts as the MQTT broker for all communication.
- Shelly device is configured to use your Mosquitto broker.
- Homebridge with mqttthing publishes simple on/off and brightness values to MQTT.
- The Node.js bridge script listens for these values, reformats them into the correct Shelly Gen3 RPC JSON, and republishes them.
- PM2 ensures the bridge script runs automatically and stays running in the background.

---

**You can now control your Shelly Dimmer Gen3 from HomeKit, with reliable on/off and brightness adjustment.**