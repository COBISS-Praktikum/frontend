import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

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

const client = new ApolloClient({
  link: new HttpLink({
    uri: getGraphqlUri(),
    fetch: import.meta.env.PROD ? createProxiedFetch() : fetch,
    credentials: 'omit',
  }),
  cache: new InMemoryCache(),
});

export default client;
