const cors = require('cors');
const { Kafka } = require('kafkajs');
const bodyParser = require('body-parser');
const getRegionFromIP = require('../utils/getRegionFromIp'); 

// Middleware
// app.use(cors()); 
// app.use(bodyParser.json());

// Region mappings
const regionMap = {
  'North': ['Delhi', 'Haryana', 'Punjab', 'Uttarakhand', 'Himachal Pradesh', 'Jammu and Kashmir', 'Uttar Pradesh'],
  'South': ['Kerala', 'Karnataka', 'Tamil Nadu', 'Andhra Pradesh', 'Telangana'],
  'East': ['West Bengal', 'Odisha', 'Bihar', 'Jharkhand'],
  'West': ['Rajasthan', 'Gujarat', 'Maharashtra', 'Goa'],
  'Central': ['Madhya Pradesh', 'Chhattisgarh'],
  'Northeast': ['Assam', 'Manipur', 'Meghalaya', 'Tripura', 'Mizoram', 'Arunachal Pradesh', 'Nagaland', 'Sikkim']
};

const regionValues = {
  'North': 0,
  'South': 1,
  'East': 2,
  'West': 3,
  'Central': 4,
  'Northeast': 5
};

function classifyState(state) {
  for (const [region, states] of Object.entries(regionMap)) {
    if (states.includes(state)) return region;
  }
  return 'Unknown';
}

// Kafka Configuration
const kafka = new Kafka({
  clientId: 'Codyash710',
  brokers: ['pkc-7xoy1.eu-central-1.aws.confluent.cloud:9092'],
  ssl: true,
  sasl: {
    mechanism: 'plain',
    username: 'QHJFS7WLXRWPCSBX',
    password: '4lYzgK8en3XusMQ6BqeDOBe1bHJCl/CppGLSHg0UBLUWKTDUXxGFEiRvLxvd5ica'
  }
});

const producer = kafka.producer();

async function sendMessage(topic, message) {
  try {
    const ip = message.ip;
    const state = await getRegionFromIP(ip);
    const region = classifyState(state);
    const partition = regionValues[region] ?? 0;

    await producer.connect();
    await producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(message),
          partition
        }
      ]
    });
    await producer.disconnect();

    console.log('Message sent successfully');
    return true;
  } catch (err) {
    console.error('Error sending message:', err);
    return false;
  }
}

// Produce Message Controller
const produceMessage = async (req, res) => {
  const { topic, message } = req.body;
  try {
    const success = await sendMessage(topic, message);
    if (success) {
      return res.json({
        status: 'Message sent successfully'
      });
    } else {
      return res.status(500).json({ status: 'Failed to send message' });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = produceMessage;