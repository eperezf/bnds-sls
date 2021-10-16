'use strict';

const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const nanoid = require ('nanoid');

module.exports.createOperator = async (event) => {
  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var result = {};
  var error = false;
  const data = JSON.parse(event.body);

  // Configure DynamoDB
  const tableName = "operators-"+process.env.NODE_ENV;
  const client = new DynamoDBClient({region: "us-east-1", endpoint: process.env.DYNAMODB_ENDPOINT});
  const docClient = DynamoDBDocument.from(client);

  // Validate that all the data is correct
  if (!data.name || data.name == "") {
    error = true;
    message = "Missing parameters";
    status = 500;
  }

  if (!data.webUrl || data.webUrl == "") {
    error = true;
    message = "Missing parameters";
    status = 500;
  }

  try {
    let id = nanoid(6);
    let params = {
      TableName: tableName,
      Item: {
        PK: "OPERATORS",
        SK: "OPERATOR#" + id,
        name: data.name,
        webUrl: data.webUrl,
        enabled: data.enabled,
        technologies: data.technologies,
        frequencies: data.frequencies
      }
    };
    let operator = await docClient.put(params);
    result = operator;
  } catch (e) {
    console.log(e);
    message = "Error agregando Operadora";
    error = e;
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
        result: result,
        error: error,
        message: message
      },
      null,
      2
    ),
  };
};

module.exports.uploadOperatorImage = async (event) => {
  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var result = {};
  var error = false;
  const data = JSON.parse(event.body);
  console.log("Configuring S3");
  const client = new S3Client();
  console.log("Client set");
  const command = new PutObjectCommand({
    Bucket:"static-dev.bnds.cl",
    Key:"operators/id",
    ACL: 'public-read'
  });
  console.log("Command set");
  console.log("Getting signed URL");
  const url = await getSignedUrl(client, command, {expiresIn: 600});
  console.log(url);

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
