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
  var frequencies = [];
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
      status = 404;
      message = "Phone not found";
    }

  }
  else {
    resultData = {};
    status = 404;
    message = "Phone not found";
  }
  // Select the correct variant
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
    resultData.variant = resultData.variants[0];
    resultData.technologies = resultData.variants[0].technologies;
    resultData.frequencies = resultData.variants[0].frequencies;
    delete resultData.variants;
  }
  console.log(resultData);

  // Get operator data
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
  console.log(operatorData.Item);


  // Set the final comparation array

  technologies.forEach((technology, i) => {
    // Phone
    if (resultData.technologies.includes(technology.SK.replace("TECHNOLOGY#",""))) {
      console.log("TECH PH OK");
      technology.phone = true;
    }
    else {
      console.log("TECH NOT OK");
      technology.phone = false;
    }
    // Operator
    if (operatorData.Item.technologies.includes(technology.SK.replace("TECHNOLOGY#",""))) {
      console.log("TECH OP OK");
      technology.operator = true;
    }
    else {
      console.log("TECH NOT OK");
      technology.operator = false;
    }
    delete technology.PK;
    delete technology.SK;
  });
  console.log(technologies);

  delete resultData.technologies;
  delete resultData.frequencies;
  delete operatorData.Item.technologies;
  delete operatorData.Item.frequencies;





  // Return the data
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(
      {
        technologies: technologies,
        operator: operatorData.Item,
        phone: resultData,
        message: message
      },
      null,
      2
    ),
  };
};
