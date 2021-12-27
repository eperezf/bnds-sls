const { DynamoDBDocument } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const { Client } = require('@opensearch-project/opensearch');

// Delete a variant
export const deleteVariant = async (event) => {

  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var error = false;

  // Configure DynamoDB
  const tableName = "phones-"+process.env.NODE_ENV;
  const dynamoClient = new DynamoDBClient({
    region: process.env.DYNAMODB_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  });
  const docClient = DynamoDBDocument.from(dynamoClient, {marshallOptions:{removeUndefinedValues:true}});

  // Configure OpenSearch
  const osClient = new Client({
    node: "https://" + process.env.OPENSEARCH_USER + ":" + process.env.OPENSEARCH_PASSWORD + "@" + process.env.OPENSEARCH_ENDPOINT
  });

  // Try getting the variant data from DynamoDB
  var result = {};
  var variantData = {};
  try {
    let params = {
      TableName: tableName,
      Key: {
        "PK": "PHONE#"+event.pathParameters.phoneId,
        "SK": "VARIANT#" + event.pathParameters.variantId
      }
    };
    let variantResult = await docClient.get(params);
    variantData = variantResult.Item;
  } catch (e) {
    console.error("Error getting variant data from DynamoDB:");
    console.error(e);
    error = true;
    status = 500;
    message = e;
  }

  // Try deleting in DynamoDB
  try {
    let params = {
      TableName: tableName,
      Key: {
        PK: "PHONE#" + event.pathParameters.phoneId,
        SK: "VARIANT#" + event.pathParameters.variantId
      }
    };
    result = await docClient.delete(params);
  } catch (e) {
    console.error("Error deleting variant from DynamoDB:");
    console.error(e);
    error = true;
    status = 500;
    message = e;
  }

  // Try deleting in OpenSearch
  try {
    await osClient.delete({
      index: process.env.OPENSEARCH_VARIANT_INDEX,
      id: event.pathParameters.variantId
    });
  } catch (e) {
    console.error("Error deleting variant from OpenSearch:");
    console.error(e);
    error = true;
    status = 500;
    message = e;
  }

  // Try updating phone in OpenSearch
  try {
    let document = {
      "script": {
        "params":{
          "ogName": variantData.name
        },
        "source": `
          if (ctx._source.variants.contains(params.ogName)){
            ctx._source.variants.remove(ctx._source.variants.indexOf(params['ogName']))
          }
        `,
        "lang": "painless",
      },
    };
    await osClient.update({
      index: process.env.OPENSEARCH_PHONE_INDEX,
      id: event.pathParameters.phoneId,
      body: document
    });
  } catch (e) {
    console.error("Error updating phone in OpenSearch:");
    console.error(e);
    error = true;
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
        result: result,
        message: message,
        error: error
      },
      null,
      2
    ),
  };
};
