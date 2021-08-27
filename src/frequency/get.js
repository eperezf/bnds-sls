'use strict';
const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");

// List all the frequencies
module.exports.getFrequencies = async (event) => {

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
  var frequencies = [];

  try {
    // Set parameters
    let params = {
      TableName: tableName,
      KeyConditionExpression: "PK = :PK",
      ExpressionAttributeValues: {
        ":PK": "FREQUENCIES"
      },
      ExpressionAttributeNames: {
        "#name": "name"
      },
      ProjectionExpression:"#name,enabled,frequency,SK"
    };
    // Do query
    let frequency = await docClient.query(params);
    frequencies = frequency.Items;
    console.log(frequency);
  } catch (e) {
    console.log(e);
    error = true;
    message = e;
    status = 500;
  }
  // Return the data
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(
      {
        frequencies: frequencies,
        message: message
      },
      null,
      2
    ),
  };
};

// Get specific frequency
module.exports.getFrequency = async (event) => {

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

  var frequency = {};
  console.log(event.pathParameters.id);
  var id = event.pathParameters.id;
  if (id ==""|| !id) {
    error = true;
    status = 500;
    message ="ID Cannot be empty";
  }

  if (!error) {
    try {
      // Get billing data.
      let params = {
        TableName: tableName,
        Key: {
          PK: "",
          SK: billingID
        },
        ProjectionExpression: "paymentMethod, planId, subscriptionStart, subscriptionEnd, nextBillingDate, cancelAtEnd, currentPeriodStart, currentPeriodEnd"
      };
      var billingData = await docClient.get(params);
      billingData = billingData.Item;
    } catch (e) {

    } finally {

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
        frequency: frequency,
        message: message
      },
      null,
      2
    ),
  };
};
