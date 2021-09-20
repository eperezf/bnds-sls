'use strict';
const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const nanoid = require ('nanoid');

// Create a generation
module.exports.deleteFrequency = async (event) => {

  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var error = false;

  // Configure DynamoDB
  const tableName = "settings-"+process.env.NODE_ENV;
  const dynamoClient = new DynamoDBClient({
    region: process.env.DYNAMODB_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  });
  const docClient = DynamoDBDocument.from(dynamoClient);
  var genData = {};

  // First check if the Frequency exists
  var generation = {};
  var params = {
    TableName: tableName,
    Key: {
      "PK": "FREQUENCIES",
      "SK": "FREQUENCY#" + event.pathParameters.id
    }
  };
  try {
    let gen = await docClient.get(params);
    if (gen.Item) {
      gen.Item.id = gen.Item.SK.replace("FREQUENCY#","");
      delete gen.Item.SK;
      delete gen.Item.PK;
    }
    else {
      message="Frequency not found";
      status = 404;
    }
    generation = gen.Item;
  } catch (e) {
    console.log(e);
  }

  // If it exists, delete it.
  if (status == 200) {
    try {
      let params = {
        TableName: tableName,
        Key: {
          PK: "FREQUENCIES",
          SK: "FREQUENCY#" + event.pathParameters.id
        }
      };
      var frequencyDelete = await docClient.delete(params);
      var result = frequencyDelete;
    } catch (e) {
      message = e;
      status = 500;
      error = true;
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
        message: message
      },
      null,
      2
    ),
  };
};
