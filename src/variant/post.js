const { DynamoDBDocument } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const { Client } = require('@opensearch-project/opensearch');
const nanoid = require('nanoid');

export const createVariant = async (event) => {
  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var result = {};
  var error = false;
  const data = JSON.parse(event.body);
  var id = nanoid(6);

  // Configure DynamoDB
  const tableName = "phones-"+process.env.NODE_ENV;
  const client = new DynamoDBClient({region: "us-east-1", endpoint: process.env.DYNAMODB_ENDPOINT});
  const docClient = DynamoDBDocument.from(client, {marshallOptions:{removeUndefinedValues:true}});
  // Configure OpenSearch
  var osClient = new Client({
    node: "https://" + process.env.OPENSEARCH_USER + ":" + process.env.OPENSEARCH_PASSWORD + "@" + process.env.OPENSEARCH_ENDPOINT
  });

  // Validate that all the data is correct
  if (!data.model || data.model == "") {
    error = true;
    message = "Missing parameters";
    status = 500;
  }

  // Try saving the variant in DynamoDB
  if (!error) {
    try {
      if (!data.enabled) {
        data.enabled = false;
      }
      // Save the variant in DynamoDB

      let params = {
        TableName: tableName,
        Item: {
          PK: "PHONE#"+data.phoneId,
          SK: "VARIANT#"+id,
          name: data.name,
          enabled: data.enabled,
          technologies: data.technologies,
          frequencies: data.frequencies
        }
      };
      let phone = await docClient.put(params);
      result = phone;
    } catch (e) {
      console.log(e);
      error = true;
      status = 500;
      message = e;
    }
  }

  // Try saving the variant in OpenSearch
  if (!error) {
    try {
      let document = {
        'brand': data.brand,
        'model': data.model,
        'variant': data.name,
        'fullName': data.brand + " " + data.model + " " + data.variant,
        'enabled': data.enabled,
      };
      await osClient.index({
        id: id,
        index:"variants",
        body: document,
        refresh:true
      });
    } catch (e) {
      console.log(e);
      error = true;
      status = 500;
      message = e;
    }
  }

  // Try updating the phone in OpenSearch
  if (!error) {
    try {
      let document = {
        "script": {
          "params":{
            "variant": data.name
          },
          "source": "ctx._source.variants.add(params.variant)",
          "lang": "painless",
        }
      };
      await osClient.update({
        id: data.phoneId,
        index:"phones",
        body: document,
        refresh:true
      });
    } catch (e) {
      console.log(e);
      error = true;
      status = 500;
      message = e;
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
        result: result,
        error: error,
        message: message
      },
      null,
      2
    ),
  };
};
