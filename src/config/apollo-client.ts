import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

// Determine GraphQL endpoint
// In development: use relative /graphql (proxied by Vite dev server)
// In production: use full URL from environment variable
const getGraphqlUri = (): string => {
  const isDev = !import.meta.env.PROD;

  if (isDev) {
    // In development, use relative path to benefit from Vite's dev server proxy
    return '/graphql';
  }

  // In production, construct full URL from environment variable
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) {
    console.warn('VITE_API_URL environment variable not set');
    return '/graphql';
  }

  // Ensure proper formatting of the GraphQL endpoint URL
  return apiUrl.endsWith('/')
    ? `${apiUrl}graphql`
    : `${apiUrl}/graphql`;
};

const client = new ApolloClient({
  link: new HttpLink({ uri: getGraphqlUri() }),
  cache: new InMemoryCache(),
});

export default client;
