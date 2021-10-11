'use strict';
const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const nanoid = require ('nanoid');

// Delete an operator
module.exports.deleteOperator = async (event) => {

  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var error = false;

  // Configure DynamoDB
  const tableName = "operators-"+process.env.NODE_ENV;
  const dynamoClient = new DynamoDBClient({
    region: process.env.DYNAMODB_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  });
  const docClient = DynamoDBDocument.from(dynamoClient);
  var opData = {};

  // First check if the Generation exists
  var operator = {};
  var params = {
    TableName: tableName,
    Key: {
      "PK": "OPERATORS",
      "SK": "OPERATOR#" + event.pathParameters.id
    }
  };
  try {
    let op = await docClient.get(params);
    if (op.Item) {
      op.Item.id = op.Item.SK.replace("OPERATOR#","");
      delete op.Item.SK;
      delete op.Item.PK;
    }
    else {
      message="Operator not found";
      status = 404;
    }
    operator = op.Item;
  } catch (e) {
    console.log(e);
  }

  // If it exists, delete it.
  if (status == 200) {
    try {
      let params = {
        TableName: tableName,
        Key: {
          PK: "OPERATORS",
          SK: "OPERATOR#" + event.pathParameters.id
        }
      };
      var operatorDelete = await docClient.delete(params);
      var result = operatorDelete;
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
