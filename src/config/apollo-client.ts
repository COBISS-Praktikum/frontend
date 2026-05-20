import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

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

const client = new ApolloClient({
  link: new HttpLink({
    uri: getGraphqlUri(),
    fetch: fetch,
    credentials: 'omit',
  }),
  cache: new InMemoryCache(),
});

export default client;
