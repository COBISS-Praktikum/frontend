import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import ForceGraph2D from 'react-force-graph-2d';

interface ConceptNode {
  uri: string;
  prefLabel: string;
}

interface Concept extends ConceptNode {
  definition?: string;
  broader?: ConceptNode[];
  narrower?: ConceptNode[];
}

interface GetConceptResponse {
  concept: Concept;
}

interface GraphNode {
  id: string;
  name: string;
}

interface GraphLink {
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

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
  const { loading, error, data } = useQuery<GetConceptResponse>(GET_CONCEPT, {
    variables: { uri: decodeURIComponent(uri || '') },
  });

  const graphData = useMemo<GraphData>(() => {
    if (!data || !data.concept) {
      return { nodes: [], links: [] };
    }

    const concept = data.concept;
    const nodes: GraphNode[] = [{ id: concept.uri, name: concept.prefLabel }];
    const links: GraphLink[] = [];

    if (concept.broader) {
      concept.broader.forEach((b: ConceptNode) => {
        nodes.push({ id: b.uri, name: b.prefLabel });
        links.push({ source: concept.uri, target: b.uri });
      });
    }

    if (concept.narrower) {
      concept.narrower.forEach((n: ConceptNode) => {
        nodes.push({ id: n.uri, name: n.prefLabel });
        links.push({ source: concept.uri, target: n.uri });
      });
    }

    return { nodes, links };
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

