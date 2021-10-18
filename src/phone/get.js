'use strict';
const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const { Client } = require('@elastic/elasticsearch');

module.exports.getPhone = async (event) => {
  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  const data = event.pathParameters;
  console.log(data);
  var phoneData = {};
  phoneData.variants = [];

  // Configure DynamoDB
  const tableName = "phones-"+process.env.NODE_ENV;
  const dynamoClient = new DynamoDBClient({region: "us-east-1", endpoint: process.env.DYNAMODB_ENDPOINT});
  const docClient = DynamoDBDocument.from(dynamoClient);

  // Get phone data
  var params = {
    TableName: tableName,
    KeyConditionExpression: "#pk = :pk",
    ExpressionAttributeValues: {
      ":pk":"PHONE#"+event.pathParameters.id
    },
    ExpressionAttributeNames: {
      "#pk":"PK"
    }
  };
  try {
    var result = await docClient.query(params);
    if (result.Items[0]) {
      for (var phone of result.Items) {
        console.log(phone);
        if (phone.SK == "DATA") {
          phoneData.id = phone.PK.replace("PHONE#","");
          phoneData.brand = phone.brand;
          phoneData.model = phone.model;
          phoneData.enabled = phone.enabled;
        }
        else if (phone.SK.startsWith("VARIANT")) {
          phone.id = phone.SK.replace("VARIANT#","");
          delete phone.SK;
          delete phone.PK;
          phoneData.variants.push(phone);
        }
      }
    } else {
      status = 404;
      message = "Phone not found";
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
        phone: phoneData,
        message: message
      },
      null,
      2
    ),
  };

};
