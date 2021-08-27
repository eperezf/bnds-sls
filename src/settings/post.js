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
  var tableName = "settings-"+process.env.NODE_ENV;
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
    generation.id = nanoid(6);
    let params = {
      TableName: tableName,
      Item: {
        PK: "GENERATIONS",
        SK: "GENERATION#"+generation.id,
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
