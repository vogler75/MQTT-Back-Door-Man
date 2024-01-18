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
    if (topic === mqttCloseTopic) {
        let uuid = message.toString();
        let tcpClient = tcpClients[uuid];
        if (tcpClient) {
            tcpClient.end();
        }
    }
    else if (mqttPattern.matches(mqttInputTopic, topic)) {
        let parts = topic.split("/");
        let uuid = parts[parts.length-1];
        let tcpClient = tcpClients[uuid];  
        if (tcpClient) {
            tcpClient.write(message);
        }
    }
});

// Subscribe to the input MQTT topic
mqttClient.subscribe([mqttCloseTopic, mqttInputTopic], (err) => {
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
        console.log(`Received message from TCP client: ${data.length}`);
        mqttClient.publish(mqttOutputTopic+"/"+uuid, data);
    });

    // Handle client disconnect
    tcpClient.on('end', () => {
        console.log('Client disconnected');
        mqttClient.publish(mqttCloseTopic, uuid);         
    });  

    // Handle errors
    tcpClient.on('error', (err) => {
        console.error(`TCP client error: ${err}`);
        mqttClient.publish(mqttCloseTopic, uuid);
    });

    mqttClient.publish(mqttOpenTopic, uuid);           
});

// Start the TCP server and listen on the specified port
tcpServer.listen(tcpPort, () => {
    console.log(`TCP server listening on port ${tcpPort}`);
});

// Handle server errors
tcpServer.on('error', (err) => {
    console.error(`TCP server error: ${err}`);
});
