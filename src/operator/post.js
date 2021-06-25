'use strict';

const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const { Client } = require('@elastic/elasticsearch');

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


  try {
    let params = {
      TableName: tableName,
      Item: {
        PK: data.name,
        SK: "DATA",
        imgUrl: data.imgUrl,
        webUrl: data.webUrl,
        enabled: data.enabled,
        frequencies: data.frequencies,
        technologies: data.technologies
      }
    };
    var phoneData = await docClient.put(params);
  } catch (e) {
    console.log(e);
    error = true;
    status = 500;
    message = e;
  }

  try {
    let params = {
      TableName: tableName,
      Key : {
        'PK': "OPERATORS",
        'SK': "LIST"
      },
      UpdateExpression: "SET #list = list_append(if_not_exists(#list, :empty), :name)",
      ExpressionAttributeNames: {
        "#list": "list"
      },
      ExpressionAttributeValues: {
        ":name": [data.name],
        ":empty": []
      }
    };
    var listData = await docClient.update(params);
    console.log(listData);
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
        result: result,
        error: error,
        message: message
      },
      null,
      2
    ),
  };
};
