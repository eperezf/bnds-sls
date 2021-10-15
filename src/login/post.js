'use strict';

const AmazonCognitoIdentity = require('amazon-cognito-identity-js');

module.exports.loginUser = async (event) => {
  // Parse and configure claims and data
  var status = 200;
  var message = "ok";
  var result = {};
  var error = false;
  const data = JSON.parse(event.body);

  // Configure Cognito
  var poolData = {
    UserPoolId: process.env.AWS_COGNITO_USERPOOLID,
    ClientId: process.env.AWS_COGNITO_CLIENTID
  };
  var userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

  // Initialize data
  var userData = {
  	Username: data.email,
  	Pool: userPool,
  };
  var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

  // Initialize authentication
  var authenticationData = {
  	Username: data.email,
  	Password: data.password,
  };
  var authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);

  // Authenticate user
  var idToken = "";
  var refreshToken = "";
  var accessToken = "";
  var tokens = {};
  var loginRes;
  try {
    loginRes = await asyncAuthenticateUser(cognitoUser, authenticationDetails);
    console.log(loginRes);
    if (!loginRes.idToken) {
      result = "Password change required"
    } else {
      idToken = loginRes.idToken.jwtToken;
      refreshToken = loginRes.refreshToken.token;
      accessToken = loginRes.accessToken.jwtToken;
      result = {
        "idToken": idToken,
        "refreshToken": refreshToken,
        "accessToken": accessToken
      };
    }

  } catch (e) {
    console.log("ERROR");
    console.log(e);
    message = e;
    error = true;
    status = 500;
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

function asyncAuthenticateUser(cognitoUser, cognitoAuthenticationDetails) {
  return new Promise(function(resolve, reject) {
    cognitoUser.authenticateUser(cognitoAuthenticationDetails, {
      onSuccess: resolve,
      onFailure: reject,
      newPasswordRequired: resolve
    });
  });
}
