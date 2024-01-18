const net = require('net');
const mqtt = require('mqtt');
const mqttPattern = require('mqtt-pattern');
const { v4: uuidv4 } = require('uuid');

// TCP server configuration
const tcpPort = 8080; // Change this to your desired TCP port

// MQTT broker configuration
const mqttBrokerUrl = 'mqtt://broker.hivemq.com'; // Change this to your MQTT broker's URL
const mqttBaseTopic = 'rocworks/bridge'; // Change this to the base MQTT topic
const mqttOptions = { username: 'username', password: 'password' }; // Change this to your MQTT credentials or pass them as command line arguments

// MQTT topics
const mqttOpenTopic = mqttBaseTopic+'/open';
const mqttCloseTopic = mqttBaseTopic+'/close';
const mqttOutputTopic = mqttBaseTopic+'/s->c';
const mqttInputTopic = mqttBaseTopic+'/c->s/+';

// Connections
var tcpClients = {};

// Create an MQTT client and connect to the broker
const mqttClient = mqtt.connect(mqttBrokerUrl, mqttOptions);

// Handle MQTT messages from the input topic
mqttClient.on('message', (topic, message) => {
    console.log(`Received message from MQTT topic "${topic}": ${message.length}`);
    if (mqttPattern.matches(mqttInputTopic, topic)) {
        let parts = topic.split("/");
        let uuid = parts[parts.length-1];
        let tcpClient = tcpClients[uuid];  
        if (tcpClient) {
            tcpClient.write(message);
        }
    }
});

// Subscribe to the input MQTT topic
mqttClient.subscribe(mqttInputTopic, (err) => {
    if (err) {
        console.error(`Error subscribing to MQTT topic: ${err}`);
    } else {
        console.log(`Subscribed to MQTT topic: ${mqttInputTopic}`);
    }
});            

// Create a TCP server
const tcpServer = net.createServer((tcpClient) => {
    console.log('Client connected');
    const uuid = uuidv4();
    tcpClients[uuid] = tcpClient;

    // Handle data received from the TCP client
    tcpClient.on('data', (data) => {
        const message = data.toString();
        console.log(`Received message from TCP client: ${message.length}`);

        // Publish the received message to an MQTT topic
        mqttClient.publish(mqttOutputTopic+"/"+uuid, data, (err) => {
            if (err) {
                console.error(`Error publishing to MQTT: ${err}`);
            } else {
                console.log(`Published message to MQTT: ${message.length}`);
            }
        });
    });

    // Handle client disconnect
    tcpClient.on('end', () => {
        console.log('Client disconnected');
        mqttClient.publish(mqttCloseTopic, uuid, (err) => {
            if (err) {
                console.error(`Error publishing to MQTT: ${err}`);
            } else {
                console.log(`Published message to MQTT: CLOSE`);
            }
        });         
        mqttClient.end();
    });  

    // Handle errors
    tcpClient.on('error', (err) => {
        console.error(`TCP client error: ${err}`);
        mqttClient.publish(mqttCloseTopic, uuid);
    });

    mqttClient.publish(mqttOpenTopic, uuid, (err) => {
        if (err) {
            console.error(`Error publishing to MQTT: ${err}`);
        } else {
            console.log(`Published message to MQTT: OPEN`);
        }
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
