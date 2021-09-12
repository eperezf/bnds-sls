'use strict';
const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");

// List all generations
module.exports.listGenerations = async (event) => {

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
  var generations = [];
  let params = {
    TableName: tableName,
    KeyConditionExpression: "PK = :PK",
    ExpressionAttributeValues: {
      ":PK": "GENERATIONS",
    },
    ExpressionAttributeNames: {
      "#name": "name"
    },
    ProjectionExpression:"#name,enabled,frequency,SK"
  };
  try {
    let gen = await docClient.query(params);
    generations = gen.Items;
    for (var generation of generations) {
      generation.id = generation.SK.replace("GENERATION#","");
      delete generation.SK;
    }
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
        generations: generations,
        message: message
      },
      null,
      2
    ),
  };
};

// Get a generation
module.exports.getGeneration = async (event) => {

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
  var generation = {};
  var params = {
    TableName: tableName,
    Key: {
      "PK": "GENERATIONS",
      "SK": "GENERATION#" + event.pathParameters.id
    }
  };
  try {
    let gen = await docClient.get(params);
    if (gen.Item) {
      gen.Item.id = gen.Item.SK.replace("GENERATION#","");
      delete gen.Item.SK;
      delete gen.Item.PK;
    }
    else {
      message="Generation not found";
      status = 404;
    }
    generation = gen.Item;
  } catch (e) {
    console.log(e);
  }
  // Return the data
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(
      {
        generation: generation,
        message: message
      },
      null,
      2
    ),
  };
};
