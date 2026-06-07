import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const getGraphqlUri = (): string => {
  if (!import.meta.env.PROD) {
    return '/graphql';
  }
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) {
    console.error('VITE_API_URL is not set.');
    return '/graphql';
  }
  return apiUrl.endsWith('/') ? `${apiUrl}graphql` : `${apiUrl}/graphql`;
};

const httpLink = new HttpLink({
  uri: getGraphqlUri(),
  credentials: 'same-origin',
});

const authLink = setContext((_, { headers }) => {
  let token: string | null = null;
  try {
    const auth0ClientKey = Object.keys(localStorage).find(key =>
      key.startsWith('@@auth0spajs@@') && key.endsWith(import.meta.env.VITE_AUTH0_CLIENT_ID)
    );
    if (auth0ClientKey) {
      const cachedData = JSON.parse(localStorage.getItem(auth0ClientKey) || '{}');
      token = cachedData?.body?.access_token || null;
    }
  } catch (error) {
    console.error('Error fetching Auth0 token:', error);
  }

  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

const client = new ApolloClient({
  link: ApolloLink.from([authLink, httpLink]),
  cache: new InMemoryCache(),
});

export default client;
