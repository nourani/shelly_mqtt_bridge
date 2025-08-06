const mqtt = require('mqtt');

// Read from config file JSON config file:
const config = require('./shelly_rpc_bridge_config.json');
const client = mqtt.connect(`mqtt://${config.mqttBrokerIp}`);
// Print MQTT broker IP
console.log(`Connecting to MQTT broker at ${config.mqttBrokerIp}...`);

// Read dimmers array from config file:
const dimmers = config.dimmers.map(dimmers => ({
    sourceTopic: dimmers.sourceTopic,
    targetTopic: dimmers.targetTopic,
    lastBrightness: dimmers.lastBrightness || 100
}));


client.on('connect', () => {
    dimmers.forEach(dimmer => client.subscribe(dimmer.sourceTopic));
    console.log('Shelly RPC bridge running for multiple dimmers...');
});

client.on('message', (topic, message) => {
    const msg = message.toString();
    let payload;
    const num = parseInt(msg, 10);

    // Find which dimmer this message is for
    const dimmer = dimmers.find(d => d.sourceTopic === topic);
    if (!dimmer) return;

    if (!isNaN(num)) {
        if (num === 0) {
            payload = JSON.stringify({
                id: 1,
                src: 'homebridge',
                method: 'Light.Set',
                params: { id: 0, on: false }
            });
            client.publish(dimmer.targetTopic, payload);
            console.log(`[${topic}] Off (0): ${msg} -> ${payload}`);
        } else if (num === 1) {
            payload = JSON.stringify({
                id: 1,
                src: 'homebridge',
                method: 'Light.Set',
                params: { id: 0, on: true, brightness: dimmer.lastBrightness }
            });
            client.publish(dimmer.targetTopic, payload);
            console.log(`[${topic}] On (1): ${msg} -> ${payload}`);
        } else if (num > 1 && num <= 100) {
            dimmer.lastBrightness = num;
            payload = JSON.stringify({
                id: 1,
                src: 'homebridge',
                method: 'Light.Set',
                params: { id: 0, on: true, brightness: dimmer.lastBrightness }
            });
            client.publish(dimmer.targetTopic, payload);
            console.log(`[${topic}] Brightness: ${msg} -> ${payload}`);
        }
    } else if (msg === 'true') {
        payload = JSON.stringify({
            id: 1,
            src: 'homebridge',
            method: 'Light.Set',
            params: { id: 0, on: true, brightness: dimmer.lastBrightness }
        });
        client.publish(dimmer.targetTopic, payload);
        console.log(`[${topic}] On: ${msg} -> ${payload}`);
    } else if (msg === 'false') {
        payload = JSON.stringify({
            id: 1,
            src: 'homebridge',
            method: 'Light.Set',
            params: { id: 0, on: false }
        });
        client.publish(dimmer.targetTopic, payload);
        console.log(`[${topic}] Off: ${msg} -> ${payload}`);
    }
});