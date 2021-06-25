'use strict';
const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");

module.exports.getFrequencies = async (event) => {

  // Parse and configure claims and data
  var status = 200;
  var message = "ok";

  // Configure DynamoDB
  const tableName = "settings-"+process.env.NODE_ENV;
  const dynamoClient = new DynamoDBClient({region: "us-east-1", endpoint: process.env.DYNAMODB_ENDPOINT});
  const docClient = DynamoDBDocument.from(dynamoClient);

  var generations;
  try {
    let params = {
    TableName: tableName,
    Key: {
      PK: "GENERATIONS",
      SK: "LIST"
    }
  };
    generations = await docClient.get(params);
  } catch (e) {
    console.log(e);
    status = 500;
    message = e;
  }
  var frequencies = [];
  for (var generation of generations.Item.list) {
    let params = {
      TableName: tableName,
      KeyConditionExpression: "PK = :PK And begins_with(SK, :SK)",
      ExpressionAttributeValues: {
        ":PK": "GENERATION#" + generation,
        ":SK": "FREQUENCY"
      },
      ExpressionAttributeNames: {
        "#name": "name"
      },
      ProjectionExpression:"#name,enabled,frequency,SK"
    };
    try {
      let frequency = await docClient.query(params);
      let gen = {
        "name": generation,
        "frequencies": frequency.Items
      };
      frequencies.push(gen);
    } catch (e) {
      console.log(e);
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
        frequencies: frequencies,
        message: message
      },
      null,
      2
    ),
  };
};
