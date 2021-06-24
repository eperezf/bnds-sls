'use strict';

const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const { Client } = require('@elastic/elasticsearch');

module.exports.createPhone = async (event) => {
  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var result = {};
  var error = false;
  const data = JSON.parse(event.body);

  // Configure DynamoDB
  const tableName = "phones-"+process.env.NODE_ENV;
  const client = new DynamoDBClient({region: "us-east-1", endpoint: process.env.DYNAMODB_ENDPOINT});
  const docClient = DynamoDBDocument.from(client);

  //Configure Elasticsearch
  const esclient = new Client({
  node: process.env.ELASTIC_ENDPOINT,
  auth: {
    username: process.env.ELASTIC_USERNAME,
    password: process.env.ELASTIC_PASSWORD
  }
  });

  let params = {
    TableName: tableName,
    Item: {
      PK: data.brand,
      SK: data.model,
      imgUrl: data.imgUrl,
      reviewUrl: data.reviewUrl,
      variants: data.variants
    }
  };
  try {
    var phoneData = await docClient.put(params);
  } catch (e) {
    console.log(e);
    error = true;
    message = e;
  }

  data.variants.forEach((variant, i) => {
    esclient.index({
      index: 'phones',
      body: {
        fullName: data.brand + " " + data.model + " " + variant.variant,
        PK: data.brand,
        SK: data.model,
        variant: variant.variant,
        enabled: variant.enabled
      }
    });
  });

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
