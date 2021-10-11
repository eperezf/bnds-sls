'use strict';
const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");

module.exports.listOperators = async (event) => {

  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  const data = event.queryStringParameters;

  // Configure DynamoDB
  const tableName = "operators-"+process.env.NODE_ENV;
  const dynamoClient = new DynamoDBClient({region: "us-east-1", endpoint: process.env.DYNAMODB_ENDPOINT});
  const docClient = DynamoDBDocument.from(dynamoClient);


    var params = {
      TableName: tableName,
      KeyConditionExpression: "PK = :PK",
      ExpressionAttributeValues: {
        ":PK": "OPERATORS",
      },
      ExpressionAttributeNames: {
        "#name": "name"
      },
      ProjectionExpression:"#name,SK,enabled"
    };
    var resultData;
    try {
      resultData = await docClient.query(params);
      if (resultData.Items.length > 0) {
        for (var item of resultData.Items) {
          item.id = item.SK.replace("OPERATOR#","");
          delete item.SK;
          delete item.PK;
        }
      }
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
        operators: resultData.Items,
        message: message
      },
      null,
      2
    ),
  };
};

// Get an operator
module.exports.getOperator = async (event) => {

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
  var operator = {};
  var params = {
    TableName: tableName,
    Key: {
      "PK": "OPERATORS",
      "SK": "OPERATOR#" + event.pathParameters.id
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
    operator = gen.Item;
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
        operator: operator,
        message: message
      },
      null,
      2
    ),
  };
};
