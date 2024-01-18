const mqtt = require('mqtt');
const net = require('net');

// MQTT broker configuration
const mqttBrokerUrl = 'mqtt://broker.hivemq.com'; // Change this to your MQTT broker's URL
const mqttBaseTopic = 'tcp/bridge'; // Change this to the base MQTT topic

// TCP server configuration
var destinationHost = 'localhost';
var destinationPort = 22;

if (process.argv.length > 1) 
    destinationHost = process.argv[2]; 
if (process.argv.length > 2) 
    destinationPort = process.argv[3];

// MQTT topics
const mqttStatusTopic = mqttBaseTopic+'/status'; // Change this to the open MQTT topic
const mqttInputTopic = mqttBaseTopic+'/s->c'; // Change this to the input MQTT topic
const mqttOutputTopic = mqttBaseTopic+'/c->s'; // Change this to the output MQTT topic

// Create an MQTT client and connect to the broker
const mqttClient = mqtt.connect(mqttBrokerUrl);

// Subscribe to the input MQTT topic
mqttClient.subscribe([mqttStatusTopic, mqttInputTopic], (err) => {
    if (err) {
        console.error(`Error subscribing to MQTT topic: ${err}`);
    } else {
        console.log(`Subscribed to MQTT topic: ${mqttInputTopic}`);
    }
});

var tcpClient;

// Handle MQTT messages
mqttClient.on('message', (topic, message) => {
    console.log(`Received message from MQTT topic "${topic}": ${message.length}`);

    // Check if the received message is from the input topic
    if (topic === mqttStatusTopic) {
        // Connect to a local TCP server and send the message
        if (message.toString() === "OPEN") {       
            tcpClient = net.connect({ port: destinationPort, host: destinationHost }, () => {
                console.log(`Connected to ${destinationHost} TCP server on port ${destinationPort}`);
            });

            // Handle errors for the TCP client
            tcpClient.on('error', (err) => {
                console.error(`TCP client error: ${err}`);
            });

            tcpClient.on('data', (data) => {
                console.log(`Received data from TCP server: ${data.length}`);
    
                // Publish the received data to the output MQTT topic
                mqttClient.publish(mqttOutputTopic, data, (err) => {
                    if (err) {
                        console.error(`Error publishing to MQTT: ${err}`);
                    } else {
                        console.log(`Published message to MQTT topic "${mqttOutputTopic}": ${data.length}`);
                    }
                });
            });            
        }
        else if (message.toString() === "CLOSE") {          
            tcpClient.end();
            tcpClient = null;
        }       
    }

    if (topic === mqttInputTopic && tcpClient) {
        console.log(`Write message to ${destinationHost} TCP server: ${message.length}`);
        tcpClient.write(message);
    }
});

// Handle MQTT client errors
mqttClient.on('error', (err) => {
    console.error(`MQTT client error: ${err}`);
});
