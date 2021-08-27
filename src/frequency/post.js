'use strict';
const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const nanoid = require ('nanoid');

module.exports.createFrequency = async (event) => {

  // Parse and configure claims and data
  var status = 200;
  var error = false;
  var message = "ok";
  var result = {};

  // Configure DynamoDB
  const tableName = "settings-"+process.env.NODE_ENV;
  const dynamoClient = new DynamoDBClient({
    region: process.env.DYNAMODB_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  });
  // Setup Dynamodb Client
  const docClient = DynamoDBDocument.from(dynamoClient);

  // Parse body
  let data = JSON.parse(event.body);
  console.log(data);
  // If some data is empty, reject it (shouldn't happen)
  if (data.generation == "" || !data.generation) {
    console.log("GEN IS EMPTY");
    status = 500;
    error = true;
    message = "El nombre o generación no pueden ser vacíos";
  }

  if(data.name == "" || !data.name){
    console.log("NAME IS EMPTY");
    status = 500;
    error = true;
    message = "El nombre o generación no pueden ser vacíos";
  }

  if (!error){
    // Add the frequency to the db
    console.log(data);

    var frequency = {};
    try {
      let id = nanoid(6);
      console.log(id);
      console.log(tableName);
      console.log(data.generation);
      let params = {
        TableName: tableName,
        Item: {
          PK: "GENERATION#" + data.generation,
          SK: "FREQUENCY#" + id,
          enabled: true,
          generation: data.generation
        }
      };
      frequency = await docClient.put(params);
      result = frequency;
    } catch (e) {
      console.log(e);
      message = "Error agregando frecuencia";
      error = e;
      status = 500;
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
