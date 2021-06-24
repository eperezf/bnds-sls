'use strict';

const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const nanoid = require ('nanoid');

module.exports.bootstrapSettings = async (event) => {
  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var result = {};
  var error = false;

  // Configure DynamoDB
  const tableName = "settings-"+process.env.NODE_ENV;
  const client = new DynamoDBClient({region: "us-east-1", endpoint: process.env.DYNAMODB_ENDPOINT});
  const docClient = DynamoDBDocument.from(client);

  console.log("BOOTSTRAPPING DATA");
  // FREQUENCY GENERATIONS
  let generations = [
    {
      "name": "2G",
      "enabled": true
    },
    {
      "name": "3G",
      "enabled": true
    },
    {
      "name": "4G",
      "enabled": true
    },
    {
      "name": "5G",
      "enabled": false
    }
  ];
  for (var generation of generations) {
    let params = {
      TableName: tableName,
      Item: {
        PK: "GENERATION#" + generation.name,
        SK: "DATA",
        name: generation.name,
        enabled: generation.enabled
      }
    };
    try {
      var genData = await docClient.put(params);
    } catch (e) {
      console.log(e);
      error = true;
      message = e;
    }
  }

  // FREQUENCIES
  let frequencies = [
    {
      "name": "1900MHz.",
      "generation": "2G",
      "frequency": [1900],
      "enabled": true
    },
    {
      "name": "900MHz.",
      "generation": "2G",
      "frequency": [900],
      "enabled": true
    },
    {
      "name": "850MHz.",
      "generation": "2G",
      "frequency": [900],
      "enabled": true
    },
    {
      "name": "1900MHz.",
      "generation": "3G",
      "frequency": [1900],
      "enabled": true
    },
    {
      "name": "900MHz.",
      "generation": "3G",
      "frequency": [900],
      "enabled": true
    },
    {
      "name": "850MHz.",
      "generation": "3G",
      "frequency": [900],
      "enabled": true
    },
    {
      "name": "1700/2100MHz. (AWS)",
      "generation": "3G",
      "frequency": [1700,2100],
      "enabled": true
    },
    {
      "name": "2600MHz.",
      "generation": "4G",
      "frequency": [2600],
      "enabled": true
    },
    {
      "name": "1900MHz.",
      "generation": "4G",
      "frequency": [1900],
      "enabled": true
    },
    {
      "name": "700MHz.",
      "generation": "4G",
      "frequency": [700],
      "enabled": true
    },
    {
      "name": "1700/2100MHz. (AWS)",
      "generation": "4G",
      "frequency": [1700,2100],
      "enabled": true
    },
  ];
  for (var frequency of frequencies) {
    let id = nanoid;
    let params = {
      TableName: tableName,
      Item: {
        PK: "GENERATION#" + frequency.generation,
        SK: "FREQUENCY#" + nanoid(6),
        generation: frequency.generation,
        name: frequency.name,
        frequency: frequency.frequency,
        enabled: frequency.enabled
      }
    };
    try {
      var freqData = await docClient.put(params);
    } catch (e) {
      console.log(e);
      error = true;
      message = e;
    }
  }

  // TECHNOLOGIES
  let technologies = [
    {
      "name":"Voz Wi-Fi",
      "enabled": true,
    },
    {
      "name":"VoLTE",
      "enabled": true,
    },
    {
      "name":"SAE",
      "enabled": true,
    },
    {
      "name":"LTE-A (4G+)",
      "enabled": true,
    },
    {
      "name":"HDVoice",
      "enabled": true,
    },
    {
      "name":"eSIM",
      "enabled": true,
    },
  ];
  for (var technology of technologies) {
    let params = {
      TableName: tableName,
      Item: {
        PK: "TECHNOLOGIES",
        SK: "TECHNOLOGY#" + nanoid(6),
        name: technology.name,
        enabled: technology.enabled
      }
    };
    try {
      var techData = await docClient.put(params);
    } catch (e) {
      console.log(e);
      error = true;
      message = e;
    }
  }


  // Return the data
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(
      {
        result: result,
        error: error,
        message: message
      },
      null,
      2
    ),
  };
};
