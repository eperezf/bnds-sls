const { DynamoDBDocument } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const { Client } = require('@opensearch-project/opensearch');

// List the phones by page from OpenSearch
export const listPhones = async (event) => {
  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var phones = {};
  phones.phones = [];
  var error = false;

  // Configure OpenSearch
  var client = new Client({
    node: "https://" + process.env.OPENSEARCH_USER + ":" + process.env.OPENSEARCH_PASSWORD + "@" + process.env.OPENSEARCH_ENDPOINT
  });

  // If there's a page parameter, set the From correctly (only 10 by 10 for now)
  let from = 0;
  let params = {
    index: process.env.OPENSEARCH_PHONE_INDEX,
    body: {},
    size:10,
    from: from,
    sort: "brand.keyword:asc"
  };
  if (event.queryStringParameters) {
    // If a page was selected, change the query
    if (event.queryStringParameters.p) {
      from+=(10*(event.queryStringParameters.p-1));
      params.from = from;
    }
    // If a search term was sent, set the search data
    if (event.queryStringParameters.s) {
      params.body = {
        'query': {
          'match': {
            'fullName': {
              'query': event.queryStringParameters.s,
              'analyzer': 'standard'
            }
          }
        }
      };
    }
  }

  // Search for the document.
    var response = await client.search(params);

    for (var hit of response.body.hits.hits) {
      phones.phones.push({
        id: hit._id,
        brand: hit._source.brand,
        model: hit._source.model,
        enabled: hit._source.enabled,
        variants: hit._source.variants
      });
    }
    phones.total = response.body.hits.total.value;

  // Return the data
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(
      {
        phones: phones,
        error: error,
        message: message
      },
      null,
      2
    ),
  };
};

export const getPhone = async (event) => {
  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
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
        if (phone.SK == "DATA") {
          phoneData.id = phone.PK.replace("PHONE#","");
          phoneData.brand = phone.brand;
          phoneData.model = phone.model;
          phoneData.review = phone.review;
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
    console.error(e);
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
