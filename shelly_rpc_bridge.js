const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://<server-ip>'); // Replace with your MQTT broker IP

// Add your Shelly Gen 3 dimmers here
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