const { DynamoDBDocument } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const { Client } = require('@opensearch-project/opensearch');

// Delete a phone
export const deletePhone = async (event) => {

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
  const osClient = new Client({
    node: "https://" + process.env.OPENSEARCH_USER + ":" + process.env.OPENSEARCH_PASSWORD + "@" + process.env.OPENSEARCH_ENDPOINT
  });

  var phoneVarList = [];
  var deleteRequests = [];

  // Try get phone and variants
  try {
    let params = {
      TableName: tableName,
      KeyConditionExpression: "#pk = :pk",
      ExpressionAttributeValues: {
        ":pk":"PHONE#"+event.pathParameters.id
      },
      ExpressionAttributeNames: {
        "#pk":"PK"
      }
    };
    let result = await docClient.query(params);
    phoneVarList = result.Items;
  } catch (e) {
    console.log("ERROR GETTING PHONE AND VARIANTS:");
    console.log(e);
    error = true;
    status = 500;
    message = e;
  }
  for (var item of phoneVarList) {
    let request = {
      DeleteRequest: {
        Key: {
          PK: item.PK,
          SK: item.SK
        }
      }
    };
    deleteRequests.push(request);
  }
  // Try deleting phone and variants in DynamoDB
  try {
    result = await docClient.batchWrite({
      RequestItems: {
        [tableName] : deleteRequests
      }
    });
  } catch (e) {
    console.log("Error deleting variants from DynamoDB:");
    console.log(e);
    error = true;
    status = 500;
    message = e;
  }

  // Try deleting phone in OpenSearch
  try {
    await osClient.delete({
      index: "phones",
      id: event.pathParameters.id
    });
  } catch (e) {
    console.log("Error deleting phone from OpenSearch:");
    console.log(e);
    error = true;
    status = 500;
    message = e;
  }

  // Try deleting variants in OpenSearch
  try {
    let document = {
      "query": {
        "match": {
          "phone": event.pathParameters.id
        }
      }
    };
    await osClient.deleteByQuery({
      index: 'variants',
      id: event.pathParameters.phoneId,
      body: document
    });
  } catch (e) {
    console.log("Error deleting variants in OpenSearch:");
    console.log(e);
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
