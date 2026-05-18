import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

// Determine GraphQL endpoint
// In development: use relative /graphql (proxied by Vite dev server)
// In production: use full URL from environment variable (must be HTTPS for GitHub Pages)
const getGraphqlUri = (): string => {
  const isDev = !import.meta.env.PROD;

  if (isDev) {
    // In development, use relative path to benefit from Vite's dev server proxy
    return '/graphql';
  }

  // In production, construct full URL from environment variable
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) {
    console.error('VITE_API_URL environment variable not set. Backend connection will fail.');
    return '/graphql';
  }

  // Ensure HTTPS for production (required by GitHub Pages and mixed content policy)
  if (apiUrl.startsWith('http://')) {
    console.error(
      'VITE_API_URL must use HTTPS for production deployment on GitHub Pages. ' +
      'Current URL: ' + apiUrl + '. ' +
      'Please update your backend to support HTTPS or use a reverse proxy.'
    );
  }

  // Ensure proper formatting of the GraphQL endpoint URL
  return apiUrl.endsWith('/')
    ? `${apiUrl}graphql`
    : `${apiUrl}/graphql`;
};

const client = new ApolloClient({
  link: new HttpLink({
    uri: getGraphqlUri(),
    credentials: 'include', // Send cookies if available
  }),
  cache: new InMemoryCache(),
});

export default client;
