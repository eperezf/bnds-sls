'use strict';
const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const { Client } = require('@elastic/elasticsearch');

module.exports.getPhoneData = async (event) => {

  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var skipElastic = false;
  const data = event.pathParameters;


  // Configure DynamoDB
  const tableName = "phones-"+process.env.NODE_ENV;
  const dynamoClient = new DynamoDBClient({region: "us-east-1", endpoint: process.env.DYNAMODB_ENDPOINT});
  const docClient = DynamoDBDocument.from(dynamoClient);

  // Configure elasticsearch
  const client = new Client({
    node: process.env.ELASTIC_ENDPOINT,
    auth: {
      username: process.env.ELASTIC_USERNAME,
      password: process.env.ELASTIC_PASSWORD
    }
  });

  // Get closest match from Elastic
  const result = await client.search({
    index: 'phones',
    size: 5,
    body: {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: data.fullName,
                type: "bool_prefix",
                fields: [
                  "fullName",
                  "fullName._2gram",
                  "fullName._3gram"
                ]
              }
            },
            {
              term: {"enabled": true}
            },
          ]
        }
      }
    }
  });

  var phoneData = result.body.hits.hits;
  var exactMatch;
  var resultData;
  if (phoneData.length > 0) {
    for (var phone of phoneData) {
      if (phone._source.fullName == data.fullName) {
        exactMatch = phone._source;
      }
    }
    var queryPhone;
    if (exactMatch) {
      queryPhone = exactMatch;
    }
    else {
      queryPhone = phoneData[0]._source;
    }
    // Get phone data
    var params = {
      TableName: tableName,
      Key: {
        PK: queryPhone.PK,
        SK: queryPhone.SK
      }
    };
    try {
      resultData = await docClient.get(params);
    } catch (e) {
      console.log(e);
      status = 500;
      message = e;
    }
    if (resultData.Item) {
      if (exactMatch) {
        resultData.Item.exactMatch = true;
      }
      else {
        resultData.Item.exactMatch = false;
      }
      resultData = resultData.Item;
    }
    else {
      resultData = {};
      status = 404;
      message = "Phone not found";
    }

  }
  else {
    resultData = {};
    status = 404;
    message = "Phone not found";
  }


  // Return the data
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(
      {
        phone: resultData,
        message: message
      },
      null,
      2
    ),
  };
};

module.exports.autocomplete = async (event) => {
  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var skipElastic = false;
  const data = event.pathParameters;
  // Configure elasticsearch
  const client = new Client({
    node: process.env.ELASTIC_ENDPOINT,
    auth: {
      username: process.env.ELASTIC_USERNAME,
      password: process.env.ELASTIC_PASSWORD
    }
  });
  // Get closest match from Elastic
  const result = await client.search({
    index: 'phones',
    size: 5,
    body: {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: data.fullName,
                type: "bool_prefix",
                fields: [
                  "fullName",
                  "fullName._2gram",
                  "fullName._3gram"
                ]
              }
            },
            {
              term: {"enabled": true}
            },
          ]
        }
      }
    }
  });
  var phones = [];
  result.body.hits.hits.forEach((phone, i) => {
    phones.push(phone._source.fullName);
  });
  // Return the data
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(
      {
        phones: phones,
        message: message
      },
      null,
      2
    ),
  };
};
