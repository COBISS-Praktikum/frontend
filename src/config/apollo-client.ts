import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const PROXY_ENDPOINT = 'https://corsproxy.io/?';

// Determine GraphQL endpoint.
// Development: use the local Vite proxy at /graphql.
// Production: keep the backend URL in env, but route requests through an HTTPS proxy
// because GitHub Pages cannot talk to the HTTP backend directly.
const getGraphqlUri = (): string => {
  if (!import.meta.env.PROD) {
    return '/graphql';
  }

  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) {
    console.error('VITE_API_URL environment variable not set. Backend connection will fail.');
    return '/graphql';
  }

  return apiUrl.endsWith('/') ? `${apiUrl}graphql` : `${apiUrl}/graphql`;
};

const createProxiedFetch = (): typeof fetch => {
  return (input, init) => {
    const requestUrl =
        typeof input === 'string'
            ? input
            : input instanceof Request
                ? input.url
                : String(input);

    const proxiedUrl = `${PROXY_ENDPOINT}${encodeURIComponent(requestUrl)}`;
    return fetch(proxiedUrl, init);
  };
};

// 1. Create the base HTTP Link with your custom fetch logic
const httpLink = new HttpLink({
  uri: getGraphqlUri(),
  fetch: import.meta.env.PROD ? createProxiedFetch() : fetch,
  // Changed credentials from 'omit' to 'same-origin' or removed if utilizing Authorization headers,
  // but keeping it predictable for your backend environment.
  credentials: 'same-origin',
});

// 2. Setup the authentication link to inject the Bearer token dynamically
const authLink = setContext((_, { headers }) => {
  let token: string | null = null;

  try {
    // When cacheLocation="localstorage" is active, Auth0 saves tokens under a specific format.
    // We scan localStorage keys to extract the valid target access token.
    const auth0ClientKey = Object.keys(localStorage).find(key =>
        key.startsWith('@@auth0spajs@@') && key.endsWith(import.meta.env.VITE_AUTH0_CLIENT_ID)
    );

    if (auth0ClientKey) {
      const cachedData = JSON.parse(localStorage.getItem(auth0ClientKey) || '{}');
      // Extract the bearer token from the structure
      token = cachedData?.body?.access_token || null;
    }
  } catch (error) {
    console.error('Error fetching Auth0 token from localStorage cache:', error);
  }

  // Return headers to Apollo link chain
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    }
  };
});

// 3. Compose them together using ApolloLink.from()
const client = new ApolloClient({
  link: ApolloLink.from([authLink, httpLink]),
  cache: new InMemoryCache(),
});

export default client;