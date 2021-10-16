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
  const docClient = DynamoDBDocument.from(client, {marshallOptions:{removeUndefinedValues:true}});

  // Configure S3
  const S3client = new S3Client();

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
    // Try saving the operator
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
    // Save the operator
    let operator = await docClient.put(params);
    result = operator;
    // Create the S3 command
    const command = new PutObjectCommand({
      Bucket:process.env.AWS_S3_BUCKET_NAME,
      Key:"operators/"+id+".png",
      ACL: 'public-read'
    });
    // Get the signed URL
    const url = await getSignedUrl(S3client, command, {expiresIn: 600});
    result.uploadUrl=url;

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
