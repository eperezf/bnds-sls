const { DynamoDBDocument} = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const { Client } = require('@opensearch-project/opensearch');

// Update a variant
export const updateVariant = async (event) => {

  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var error = false;
  var result = {};

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
  var osClient = new Client({
    node: "https://" + process.env.OPENSEARCH_USER + ":" + process.env.OPENSEARCH_PASSWORD + "@" + process.env.OPENSEARCH_ENDPOINT
  });

  var data = JSON.parse(event.body);
  var phoneId = event.pathParameters.phoneId;
  var variantId = event.pathParameters.variantId;

  // Try updating variant in DynamoDB
  try {
    let params = {
      TableName: tableName,
      Key: {
        PK: "PHONE#"+phoneId,
        SK: "VARIANT#"+variantId
      },
      UpdateExpression: "set #n = :n, #c = :c, #e = :e, #t = :t, #f = :f",
      ExpressionAttributeValues: {
        ":n": data.name,
        ":c": data.comment,
        ":e": data.enabled,
        ":t": data.technologies,
        ":f": data.frequencies,
        ":id": "VARIANT#"+variantId
      },
      ExpressionAttributeNames: {
        "#n": "name",
        "#c": "comment",
        "#e": "enabled",
        "#t": "technologies",
        "#f": "frequencies",
      },
      ReturnValues: "UPDATED_NEW",
      ConditionExpression: "SK=:id",
      RemoveUndefinedValues: "TRUE"
    };
    var operatorUpdate = await docClient.update(params);
    result = operatorUpdate;
  } catch (e) {
    console.error("DynamoDB Error while updating variant:");
    console.error(e);
    error = true;
    status = 500;
    message = e;
  }

  // Try updating Phone in OpenSearch
  try {
    let document = {
      "script": {
        "params":{
          "ogName": data.ogName,
          "variant": data.name,

        },
        "source": `
          if (ctx._source.variants.contains(params.ogName)){
            ctx._source.variants.remove(ctx._source.variants.indexOf(params['ogName']))
          }
          ctx._source.variants.add(params.variant)`,
        "lang": "painless",
      },
    };
    await osClient.update({
      index: process.env.OPENSEARCH_PHONE_INDEX,
      id: phoneId,
      body: document
    });
  } catch (e) {
    console.error("OpenSearch Error while updating phone:");
    console.error(e.meta.body.error);
    message = e;
    status = 500;
    error = true;
  }

  // Try updating variant in OpenSearch
  try {
    let document = {
      "script": {
        "params":{
          "variant": data.name,
          "enabled": data.enabled
        },
        "source": "ctx._source.fullName = ctx._source.brand + ' ' + ctx._source.model + ' ' + params.variant; ctx._source.variant = params.variant",
        "lang": "painless",
      },
    };
    await osClient.update({
      index: process.env.OPENSEARCH_VARIANT_INDEX,
      id: variantId,
      body: document
    });
  } catch (e) {
    console.error("OpenSearch Error while updating variants:");
    console.error(e.meta.body.error);
    message = e;
    status = 500;
    error = true;
  }

  // Return the data
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(
      {
        result : result,
        message: message,
        error: error
      },
      null,
      2
    ),
  };
};
