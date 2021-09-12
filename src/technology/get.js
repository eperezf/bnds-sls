'use strict';
const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");

// List all technologys
module.exports.listTechnologies = async (event) => {

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
  var technologys = [];
  let params = {
    TableName: tableName,
    KeyConditionExpression: "PK = :PK",
    ExpressionAttributeValues: {
      ":PK": "TECHNOLOGIES",
    },
    ExpressionAttributeNames: {
      "#name": "name"
    },
    ProjectionExpression:"#name,enabled,frequency,SK"
  };
  try {
    let gen = await docClient.query(params);
    technologys = gen.Items;
    for (var technology of technologys) {
      technology.id = technology.SK.replace("TECHNOLOGY#","");
      delete technology.SK;
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
        technologys: technologys,
        message: message
      },
      null,
      2
    ),
  };
};

// Get a technology
module.exports.getTechnology = async (event) => {

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
  var technology = {};
  var params = {
    TableName: tableName,
    Key: {
      "PK": "TECHNOLOGIES",
      "SK": "TECHNOLOGY#" + event.pathParameters.id
    }
  };
  try {
    let gen = await docClient.get(params);
    if (gen.Item) {
      gen.Item.id = gen.Item.SK.replace("TECHNOLOGY#","");
      delete gen.Item.SK;
      delete gen.Item.PK;
    }
    else {
      message="Technology not found";
      status = 404;
    }
    technology = gen.Item;
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
        technology: technology,
        message: message
      },
      null,
      2
    ),
  };
};
