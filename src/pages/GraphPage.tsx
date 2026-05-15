import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import ForceGraph2D from 'react-force-graph-2d';

const GET_CONCEPT = gql`
  query GetConcept($uri: String!) {
    concept(uri: $uri) {
      uri
      prefLabel
      definition
      broader {
        uri
        prefLabel
      }
      narrower {
        uri
        prefLabel
      }
    }
  }
`;

function GraphPage() {
  const { uri } = useParams<{ uri: string }>();
  const { loading, error, data } = useQuery<any>(GET_CONCEPT, {
    variables: { uri: decodeURIComponent(uri || '') },
  });
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  useEffect(() => {
    if (data && data.concept) {
      const concept = data.concept;
      const nodes: any[] = [{ id: concept.uri, name: concept.prefLabel }];
      const links: any[] = [];

      if (concept.broader) {
        concept.broader.forEach((b: any) => {
          nodes.push({ id: b.uri, name: b.prefLabel });
          links.push({ source: concept.uri, target: b.uri });
        });
      }

      if (concept.narrower) {
        concept.narrower.forEach((n: any) => {
          nodes.push({ id: n.uri, name: n.prefLabel });
          links.push({ source: concept.uri, target: n.uri });
        });
      }

      // @ts-ignore
      setGraphData({ nodes, links });
    }
  }, [data]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
    <ForceGraph2D
      graphData={graphData}
      nodeLabel="name"
      nodeAutoColorBy="name"
      linkDirectionalParticles={2}
    />
    </div>
  );
}

export default GraphPage;

