'use strict';
const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");

module.exports.getGenerations = async (event) => {

  // Parse and configure claims and data
  var status = 200;
  var message = "ok";

  // Configure DynamoDB
  const tableName = "settings-"+process.env.NODE_ENV;
  const dynamoClient = new DynamoDBClient({
    region: process.env.DYNAMODB_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  });
  const docClient = DynamoDBDocument.from(dynamoClient);

  var generationList;
  try {
    let params = {
    TableName: tableName,
    Key: {
      PK: "GENERATIONS",
      SK: "LIST"
    }
  };
    generationList = await docClient.get(params);
    console.log(generationList);
  } catch (e) {
    console.log(e);
    status = 500;
    message = e;
  }
  var generations = [];
  if (generationList.Item) {
    for (var generation of generationList.Item.list) {
      let params = {
        TableName: tableName,
        KeyConditionExpression: "PK = :PK And begins_with(SK, :SK)",
        ExpressionAttributeValues: {
          ":PK": "GENERATION#" + generation,
          ":SK": "DATA"
        },
        ExpressionAttributeNames: {
          "#name": "name"
        },
        ProjectionExpression:"#name,enabled,frequency,SK"
      };
      try {
        let gen = await docClient.query(params);
        delete gen.Items[0].SK;
        generations.push(gen.Items[0]);
      } catch (e) {
        console.log(e);
      }
    }
  }
  else {
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
