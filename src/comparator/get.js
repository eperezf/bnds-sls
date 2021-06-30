'use strict';
const { DynamoDBDocument, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const { Client } = require('@elastic/elasticsearch');

module.exports.compare = async (event) => {

  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  const data = event.pathParameters;

  // Configure DynamoDB
  const dynamoClient = new DynamoDBClient({region: "us-east-1", endpoint: process.env.DYNAMODB_ENDPOINT});
  const docClient = DynamoDBDocument.from(dynamoClient);

  var technologies;
  var frequencies = [];

  // Get the phone

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
                query: data.phone,
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
      if (phone._source.fullName == data.phone) {
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
      TableName: "phones-" + process.env.NODE_ENV,
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
      technologies={};
      frequencies=[];
      status = 404;
      message = "Phone not found";
    }

  }
  else {
    resultData = {};
    technologies={};
    frequencies=[];
    status = 404;
    message = "Phone not found";
  }
  // Select the correct variant
  if (resultData.variants) {
    if (resultData.exactMatch) {
      // Iterate through variants to set the correct one
      resultData.variants.forEach((variant, i) => {
        if (variant.variant == exactMatch.variant) {
          resultData.variant = variant.variant;
          resultData.technologies = variant.technologies;
          resultData.frequencies = variant.frequencies;
        }
      });
      delete resultData.variants;
    }
    else {
      // Take the first variant
      resultData.variant = resultData.variants[0].variant;
      resultData.technologies = resultData.variants[0].technologies;
      resultData.frequencies = resultData.variants[0].frequencies;
      delete resultData.variants;
    }
  }

  // Get the operator
  var operatorData;
  let opParams = {
    TableName: "operators-" + process.env.NODE_ENV,
    Key: {
      PK: data.operator,
      SK: "DATA"
    }
  };
  try {
    operatorData = await docClient.get(opParams);
  } catch (e) {
    console.log(e);
    status = 500;
    message = e;
  }
  if (!operatorData.Item) {
    operatorData.Item = {};
    if (message == "ok") {
      message = "Operator not found";
      status = 404;
    }
    else {
      message += ", Operator not found";
    }
  }

  // Get the frequencies
  var generations;
  try {
    let params = {
    TableName: "settings-" + process.env.NODE_ENV,
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

  for (var generation of generations.Item.list) {
    let params = {
      TableName: "settings-" + process.env.NODE_ENV,
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

  // Get the technologies
  var technologies;
  try {
    let params = {
    TableName: "settings-" + process.env.NODE_ENV,
    KeyConditionExpression: "PK = :PK And begins_with(SK, :SK)",
    ExpressionAttributeValues: {
      ":PK": "TECHNOLOGIES",
      ":SK": "TECHNOLOGY#"
    }
  };
    technologies = await docClient.query(params);
  } catch (e) {
    console.log(e);
    status = 500;
    message = e;
  }
  technologies = technologies.Items;

  if (status == 404) {
    technologies = [];
    frequencies = [];
  }

  // Compare technologies with smartphone and operator
  technologies.forEach((technology, i) => {
    var id = technology.SK.replace("TECHNOLOGY#","");
    if (resultData.technologies.includes(id)) {
      technology.phone = true;
    }
    else {
      technology.phone = false;
    }
    if (operatorData.Item.technologies.includes(id)) {
      technology.operator = true;
    }
    else {
      technology.operator = false;
    }
  });

  // Compare frequencies with smartphone and operator
  frequencies.forEach((generation, i) => {
    console.log(generation);
    generation.frequencies.forEach((frequency, i) => {
      var id = frequency.SK.replace("FREQUENCY#","");
      if (resultData.frequencies.includes(id)) {
        frequency.phone = true;
      }
      else {
        frequency.phone = false;
      }
      if (operatorData.Item.frequencies.includes(id)) {
        frequency.operator = true;
      }
      else {
        frequency.operator = false;
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
        technologies: technologies,
        frequencies: frequencies,
        operator: operatorData.Item,
        phone: resultData,
        message: message
      },
      null,
      2
    ),
  };
};
