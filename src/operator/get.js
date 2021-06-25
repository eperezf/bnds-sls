'use strict';
const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");

module.exports.getOperators = async (event) => {

  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var skipElastic = false;
  const data = event.queryStringParameters;

  // Configure DynamoDB
  const tableName = "operators-"+process.env.NODE_ENV;
  const dynamoClient = new DynamoDBClient({region: "us-east-1", endpoint: process.env.DYNAMODB_ENDPOINT});
  const docClient = DynamoDBDocument.from(dynamoClient);


    var params = {
      TableName: tableName,
      Key: {
        "PK": "OPERATORS",
        "SK": "LIST"
      }
    };
    var resultData;
    try {
      resultData = await docClient.get(params);
    } catch (e) {
      console.log(e);
      status = 500;
      message = e;
    }
  // Return the data
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(
      {
        operators: resultData.Item.list,
        message: message
      },
      null,
      2
    ),
  };
};
