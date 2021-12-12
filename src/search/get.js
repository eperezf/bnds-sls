//const { DynamoDBDocument } = require("@aws-sdk/lib-dynamodb");
//const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const { Client } = require('@opensearch-project/opensearch');

export const autocomplete = async (event) => {
  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var phones = [];
  var error = false;

  // Configure OpenSearch
  var client = new Client({
    node: "https://" + process.env.OPENSEARCH_USER + ":" + process.env.OPENSEARCH_PASSWORD + "@" + process.env.OPENSEARCH_ENDPOINT
  });

  // Configure the query
  let params = {
    index: process.env.OPENSEARCH_VARIANT_INDEX,
    body: {
      'query': {
        'bool': {
          'must': [
            {
              'match': {
                'fullName': {
                  'query': event.queryStringParameters.s,
                  'analyzer': 'standard'
                }
              }
            },
            {
              term: {"enabled": true}
            }
          ]
        }
      }
    },
    size:10
  };

  try {
    // Search for the document.
    var response = await client.search(params);
    for (var hit of response.body.hits.hits) {
      phones.push(hit._source.fullName);
    }
  } catch (e) {
    console.error(e);
    status = 500;
    error = true;
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
        phones: phones,
        error: error,
        message: message
      },
      null,
      2
    ),
  };
};
