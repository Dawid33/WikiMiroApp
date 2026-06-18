const AUTH_CONFIG_KEY = "devops-roadmap-auth-config";
const DEVOPS_SCOPE = "499b84ac-1321-427f-aa17-267ca6975798/.default";

let msalInstance = null;
let currentAccount = null;

function loadAuthConfig() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_CONFIG_KEY)) || {};
  } catch {
    return {};
  }
}

function saveAuthConfig(config) {
  localStorage.setItem(AUTH_CONFIG_KEY, JSON.stringify(config));
}

function getRedirectUri() {
  return window.location.origin + window.location.pathname;
}

function initMsal(clientId, tenantId) {
  const config = {
    auth: {
      clientId: clientId,
      authority: `https://login.microsoftonline.com/${tenantId || "common"}`,
      redirectUri: getRedirectUri(),
    },
    cache: {
      cacheLocation: "localStorage",
      storeAuthStateInCookie: false,
    },
  };

  msalInstance = new msal.PublicClientApplication(config);
  return msalInstance.initialize();
}

async function handleRedirect() {
  if (!msalInstance) return null;
  const response = await msalInstance.handleRedirectPromise();
  if (response) {
    currentAccount = response.account;
    return response.account;
  }
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    currentAccount = accounts[0];
    return accounts[0];
  }
  return null;
}

async function signIn() {
  if (!msalInstance) {
    throw new Error("MSAL not initialized. Save your App Config first.");
  }
  await msalInstance.loginRedirect({
    scopes: [DEVOPS_SCOPE],
  });
}

async function signOut() {
  if (!msalInstance || !currentAccount) return;
  await msalInstance.logoutRedirect({
    account: currentAccount,
    postLogoutRedirectUri: getRedirectUri(),
  });
}

async function getAccessToken() {
  if (!msalInstance || !currentAccount) {
    throw new Error("Not signed in.");
  }

  try {
    const response = await msalInstance.acquireTokenSilent({
      scopes: [DEVOPS_SCOPE],
      account: currentAccount,
    });
    return response.accessToken;
  } catch (err) {
    const response = await msalInstance.acquireTokenRedirect({
      scopes: [DEVOPS_SCOPE],
      account: currentAccount,
    });
    return response ? response.accessToken : null;
  }
}

function isSignedIn() {
  return currentAccount !== null;
}

function getAccountName() {
  return currentAccount ? currentAccount.name || currentAccount.username : "";
}
