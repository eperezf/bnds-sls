const AmazonCognitoIdentity = require('amazon-cognito-identity-js');

export const loginUser = async (event) => {
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
  var loginRes;
  try {
    loginRes = await asyncAuthenticateUser(cognitoUser, authenticationDetails);
    if (!loginRes.idToken) {
      error = true;
      message = "PasswordChangeRequired";
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
    message = e.name;
    error = true;
    status = 200;
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

export const refreshToken = async (event) => {
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
  const cognitoRefreshToken = new AmazonCognitoIdentity.CognitoRefreshToken({RefreshToken: data.token});

  var idToken = "";
  var refreshToken = "";
  var accessToken = "";
  var refreshRes;
  try {
    refreshRes = await asyncRefreshSession(cognitoUser, cognitoRefreshToken);
    idToken = refreshRes.idToken.jwtToken;
    refreshToken = refreshRes.refreshToken.token;
    accessToken = refreshRes.accessToken.jwtToken;
    result = {
      "idToken": idToken,
      "refreshToken": refreshToken,
      "accessToken": accessToken
    };
  } catch (e) {
    console.log("ERROR");
    console.log(e);
    message = e.name;
    error = true;
    status = 200;
  }
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

function asyncRefreshSession(cognitoUser, cognitoRefreshToken) {
  return new Promise(function(resolve, reject) {
    cognitoUser.refreshSession(cognitoRefreshToken, (err, session) => {
      if (err) {
        reject(err);
      } else {
        resolve(session);
      }
    });
  });
}

function asyncAuthenticateUser(cognitoUser, cognitoAuthenticationDetails) {
  return new Promise(function(resolve, reject) {
    cognitoUser.authenticateUser(cognitoAuthenticationDetails, {
      onSuccess: resolve,
      onFailure: reject,
      newPasswordRequired: resolve
    });
  });
}
