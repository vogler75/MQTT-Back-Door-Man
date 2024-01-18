const net = require('net');
const mqtt = require('mqtt');

// TCP server configuration
const tcpPort = 8080; // Change this to your desired TCP port

// MQTT broker configuration
const mqttBrokerUrl = 'mqtt://broker.hivemq.com'; // Change this to your MQTT broker's URL
const mqttBaseTopic = 'tcp/bridge'; // Change this to the base MQTT topic

// MQTT topics
const mqttInputTopic = mqttBaseTopic+'/c->s'; // Change this to the input MQTT topic
const mqttOutputTopic = mqttBaseTopic+'/s->c'; // Change this to the output MQTT topic
const mqttStatusTopic = mqttBaseTopic+'/status'; // Change this to the open MQTT topic

// Create a TCP server
const tcpServer = net.createServer((client) => {
    console.log('Client connected');

    // Create an MQTT client and connect to the broker
    const mqttClient = mqtt.connect(mqttBrokerUrl);

    // Handle MQTT messages from the input topic
    mqttClient.on('message', (topic, message) => {
        console.log(`Received message from MQTT topic "${topic}": ${message.length}`);
        client.write(message);
    });

    // Subscribe to the input MQTT topic
    mqttClient.subscribe(mqttInputTopic, (err) => {
        if (err) {
            console.error(`Error subscribing to MQTT topic: ${err}`);
        } else {
            console.log(`Subscribed to MQTT topic: ${mqttInputTopic}`);
        }
    });            

    mqttClient.publish(mqttStatusTopic, "OPEN", (err) => {
        if (err) {
            console.error(`Error publishing to MQTT: ${err}`);
        } else {
            console.log(`Published message to MQTT: OPEN`);
        }
    });    

    // Handle data received from the TCP client
    client.on('data', (data) => {
        const message = data.toString();
        console.log(`Received message from TCP client: ${message.length}`);

        // Publish the received message to an MQTT topic
        mqttClient.publish(mqttOutputTopic, data, (err) => {
            if (err) {
                console.error(`Error publishing to MQTT: ${err}`);
            } else {
                console.log(`Published message to MQTT: ${message.length}`);
            }
        });
    });

    // Handle client disconnect
    client.on('end', () => {
        console.log('Client disconnected');
        mqttClient.publish(mqttStatusTopic, "CLOSE", (err) => {
            if (err) {
                console.error(`Error publishing to MQTT: ${err}`);
            } else {
                console.log(`Published message to MQTT: CLOSE`);
            }
        });         
        mqttClient.end();
    });

    // Handle errors
    client.on('error', (err) => {
        console.error(`TCP client error: ${err}`);
    });
});

// Start the TCP server and listen on the specified port
tcpServer.listen(tcpPort, () => {
    console.log(`TCP server listening on port ${tcpPort}`);
});

// Handle server errors
tcpServer.on('error', (err) => {
    console.error(`TCP server error: ${err}`);
});
