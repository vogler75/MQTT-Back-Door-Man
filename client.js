const net = require('net');
const mqtt = require('mqtt');
const mqttPattern = require('mqtt-pattern');

// MQTT broker configuration
const mqttBrokerUrl = 'mqtt://broker.hivemq.com'; // Change this to your MQTT broker's URL
const mqttBaseTopic = 'rocworks/bridge'; // Change this to the base MQTT topic
const mqttOptions = { username: 'username', password: 'password' }; // Change this to your MQTT credentials or pass them as command line arguments

// TCP destination server configuration
var destinationHost = 'localhost'; // Change this to your desired TCP host or pass it as a command line argument
var destinationPort = 22; // Change this to your desired TCP port or pass it as a command line argument

if (process.argv.length > 2) 
    destinationHost = process.argv[2]; 
if (process.argv.length > 3) 
    destinationPort = process.argv[3];

console.log("Destination: "+destinationHost+":"+destinationPort);

// MQTT topics
const mqttOpenTopic = mqttBaseTopic+'/open';
const mqttCloseTopic = mqttBaseTopic+'/close';
const mqttOutputTopic = mqttBaseTopic+'/c->s';
const mqttInputTopic = mqttBaseTopic+'/s->c/+';

// Create an MQTT client and connect to the broker
const mqttClient = mqtt.connect(mqttBrokerUrl, mqttOptions);

// Subscribe to the input MQTT topic
mqttClient.subscribe([mqttOpenTopic, mqttCloseTopic, mqttInputTopic], (err) => {
    if (err) {
        console.error(`Error subscribing to MQTT topic: ${err}`);
    } else {
        console.log(`Subscribed to MQTT topic: ${mqttInputTopic}`);
    }
});

var tcpClients = {};

// Handle MQTT messages
mqttClient.on('message', (topic, message) => {
    console.log(`Received message from MQTT topic "${topic}": ${message.length}`);

    // Check if the received message is from the input topic
    if (topic === mqttOpenTopic) {
        // Connect to a local TCP server and send the message
        let uuid = message.toString();
        let tcpClient = net.connect({ port: destinationPort, host: destinationHost }, () => {
            console.log(`Connected to ${destinationHost} TCP server on port ${destinationPort}`);           
        });

        tcpClients[uuid] = tcpClient;        

        // Handle errors for the TCP client
        tcpClient.on('error', (err) => {
            console.error(`TCP client error: ${err}`);
            // TODO: send close to server
        });

        tcpClient.on('data', (data) => {
            console.log(`Received data from TCP server: ${data.length}`);

            // Publish the received data to the output MQTT topic
            mqttClient.publish(mqttOutputTopic+"/"+uuid, data, (err) => {
                if (err) {
                    console.error(`Error publishing to MQTT: ${err}`);
                } else {
                    console.log(`Published message to MQTT topic "${mqttOutputTopic}": ${data.length}`);
                }
            });
        });            
    }
    else if (topic === mqttCloseTopic) {      
        let uuid = message.toString();    
        let tcpClient = tcpClients[uuid]
        if (tcpClient) {
            tcpClient.end();
            delete tcpClients[uuid];    
        }
    }           
    else if (mqttPattern.matches(mqttInputTopic, topic)) {
        let parts = topic.split("/");
        let uuid = parts[parts.length-1];
        let tcpClient = tcpClients[uuid];
        if (tcpClient) {
            console.log(`Write message to ${destinationHost} TCP server: ${message.length}`);
            tcpClient.write(message);
        }
    }
});

// Handle MQTT client errors
mqttClient.on('error', (err) => {
    console.error(`MQTT client error: ${err}`);
});
