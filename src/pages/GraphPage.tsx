import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import ForceGraph2D, { type ForceGraphMethods, type NodeObject } from 'react-force-graph-2d';
import { Badge } from '@/components/ui/badge.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { Footer } from '@/components/layout/Footer.tsx';
import { stripLanguageTag } from '@/lib/utils.ts';
import './GraphPage.css';

interface ConceptNode {
  uri: string;
  prefLabel?: string | null;
  prefLabelSl?: string | null;
  prefLabelEn?: string | null;
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
  uri: string;
  x?: number;
  y?: number;
  color?: string;
}

interface GraphLink {
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface HierarchySectionProps {
  relation: 'broader' | 'narrower';
  title: string;
  description: string;
  items: ConceptNode[] | undefined;
  expanded: boolean;
  onToggle: () => void;
  onItemClick: (item: ConceptNode) => void;
  emptyLabel: string;
}

function HierarchySection({
                            relation,
                            title,
                            description,
                            items,
                            expanded,
                            onToggle,
                            onItemClick,
                            emptyLabel,
                          }: HierarchySectionProps) {
  const itemCount = items?.length ?? 0;

  return (
      <section className={`hierarchy-section hierarchy-section--${relation}`}>
        <div className="hierarchy-section-head">
          <button
              type="button"
              className="hierarchy-section-toggle"
              onClick={onToggle}
              aria-expanded={expanded}
          >
            <span className="hierarchy-section-toggle-mark">{expanded ? '−' : '+'}</span>
            <span className="hierarchy-section-title">{title}</span>
            <span className="hierarchy-section-count">{itemCount}</span>
          </button>
          <p className="hierarchy-section-description">{description}</p>
        </div>

        {expanded ? (
            itemCount > 0 ? (
                <div className="hierarchy-node-list">
                  {items?.map((item) => (
                      <button
                          key={item.uri}
                          type="button"
                          className="hierarchy-node-card hierarchy-node-card--button"
                          onClick={() => onItemClick(item)}
                      >
                        <span className="hierarchy-node-mark" aria-hidden="true" />
                        <div className="hierarchy-node-content">
                          <h5>{stripLanguageTag(item.prefLabel)}</h5>
                          <p>{item.uri}</p>
                        </div>
                      </button>
                  ))}
                </div>
            ) : (
                <div className="hierarchy-empty-state">{emptyLabel}</div>
            )
        ) : null}
      </section>
  );
}

const GET_CONCEPT = gql`
  query GetConcept($uri: String!) {
    concept(uri: $uri) {
      uri
      prefLabel
      prefLabelSl
      prefLabelEn
      definition
      broader {
        uri
        prefLabel
        prefLabelSl
        prefLabelEn
      }
      narrower {
        uri
        prefLabel
        prefLabelSl
        prefLabelEn
      }
    }
  }
`;

function GraphPage() {
  const { uri } = useParams<{ uri: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const [graphViewportElement, setGraphViewportElement] = useState<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [hierarchyExpanded, setHierarchyExpanded] = useState({
    broader: true,
    narrower: true,
  });
  const { loading, error, data } = useQuery<GetConceptResponse>(GET_CONCEPT, {
    variables: { uri: decodeURIComponent(uri || '') },
  });

  // Measure the graph container whenever it mounts or resizes.
  // This fixes first render when the viewport appears after loading.
  useEffect(() => {
    if (!graphViewportElement) {
      return;
    }

    const measure = () => {
      const { width, height } = graphViewportElement.getBoundingClientRect();
      const nextWidth = Math.max(0, Math.floor(width));
      const nextHeight = Math.max(0, Math.floor(height));

      setViewportSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }

        return { width: nextWidth, height: nextHeight };
      });
    };

    const rafId = requestAnimationFrame(measure);
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(graphViewportElement);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [graphViewportElement]);

  const graphData = useMemo<GraphData>(() => {
    if (!data || !data.concept) {
      return { nodes: [], links: [] };
    }

    const concept = data.concept;
    const nodeMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];

    // Add the main concept
    nodeMap.set(concept.uri, { id: concept.uri, name: stripLanguageTag(concept.prefLabel), uri: concept.uri });

    // Add broader concepts
    if (concept.broader) {
      concept.broader.forEach((b: ConceptNode) => {
        if (!nodeMap.has(b.uri)) {
          nodeMap.set(b.uri, { id: b.uri, name: stripLanguageTag(b.prefLabel), uri: b.uri });
        }
        links.push({ source: concept.uri, target: b.uri });
      });
    }

    // Add narrower concepts
    if (concept.narrower) {
      concept.narrower.forEach((n: ConceptNode) => {
        if (!nodeMap.has(n.uri)) {
          nodeMap.set(n.uri, { id: n.uri, name: stripLanguageTag(n.prefLabel), uri: n.uri });
        }
        links.push({ source: concept.uri, target: n.uri });
      });
    }

    // Pre-position nodes in a circle so d3 starts from a reasonable layout
    // and needs far fewer ticks to converge.
    const nodes = Array.from(nodeMap.values());
    const angleStep = nodes.length > 1 ? (2 * Math.PI) / nodes.length : 0;
    nodes.forEach((node, i) => {
      node.x = Math.cos(i * angleStep) * 80;
      node.y = Math.sin(i * angleStep) * 80;
    });

    return { nodes, links };
  }, [data]);

  const concept = data?.concept;
  const hierarchyBroaderTerms = useMemo(() => {
    const broader = concept?.broader ?? [];
    const narrowerUris = new Set((concept?.narrower ?? []).map((item) => item.uri));
    const seen = new Set<string>();

    return broader.filter((item) => {
      if (narrowerUris.has(item.uri) || seen.has(item.uri)) {
        return false;
      }

      seen.add(item.uri);
      return true;
    });
  }, [concept?.broader, concept?.narrower]);

  const hierarchyNarrowerTerms = useMemo(() => {
    const narrower = concept?.narrower ?? [];
    const seen = new Set<string>();

    return narrower.filter((item) => {
      if (seen.has(item.uri)) {
        return false;
      }

      seen.add(item.uri);
      return true;
    });
  }, [concept?.narrower]);

  const broaderCount = hierarchyBroaderTerms.length;
  const narrowerCount = hierarchyNarrowerTerms.length;
  const activeTab = searchParams.get('tab') === 'hierarchy' ? 'hierarchy' : 'graph';

  const buildConceptUrl = (targetUri: string, tab: 'graph' | 'hierarchy') =>
      `/frontend/graph/${encodeURIComponent(targetUri)}?tab=${tab}`;

  const handleTabChange = (value: string) => {
    const nextTab = value === 'hierarchy' ? 'hierarchy' : 'graph';
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', nextTab);
    setSearchParams(nextParams, { replace: true });
  };

  const handleConceptClick = (targetUri: string, tab: 'graph' | 'hierarchy') => {
    navigate(buildConceptUrl(targetUri, tab));
  };

  const toggleHierarchySection = (section: 'broader' | 'narrower') => {
    setHierarchyExpanded((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (!concept) return <p>No concept found.</p>;

  return (
      <>
        <div className="graph-page">
          <section className="graph-shell">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="graph-tabs">
              <div className="graph-toolbar">
                <div className="graph-title-block">
                  <Badge variant="secondary">Selected term</Badge>
                  <h2 className="graph-title">{stripLanguageTag(concept.prefLabel)}</h2>
                  <p className="graph-subtitle">URI: {concept.uri}</p>
                </div>

                <TabsList className="graph-tabs-list">
                  <TabsTrigger value="graph">Graph</TabsTrigger>
                  <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="graph" className="graph-tab-content">
                <Card className="graph-card">
                  <CardHeader className="graph-card-header">
                    <div className="graph-card-heading">
                      <CardTitle>Concept overview</CardTitle>
                      <CardDescription>
                        Explore the selected concept and its connected broader and narrower terms.
                      </CardDescription>
                    </div>
                  </CardHeader>

                  <CardContent className="graph-card-content">
                    <div className="graph-stage">
                      <div className="graph-overlay">
                        <Badge variant="outline">Selected term</Badge>
                        <h3>{stripLanguageTag(concept.prefLabel)}</h3>
                        <p className="graph-overlay-uri">{concept.uri}</p>
                        <p className="graph-overlay-definition">
                          {concept.definition ?? 'No definition is available for this concept yet.'}
                        </p>

                        <Separator className="graph-overlay-separator" />

                        <div className="graph-metrics" aria-label="Concept relation summary">
                          <div className="graph-metric">
                            <span>Broader</span>
                            <strong>{broaderCount}</strong>
                          </div>
                          <div className="graph-metric">
                            <span>Narrower</span>
                            <strong>{narrowerCount}</strong>
                          </div>
                          <div className="graph-metric">
                            <span>Total links</span>
                            <strong>{broaderCount + narrowerCount}</strong>
                          </div>
                        </div>
                      </div>

                      <div ref={setGraphViewportElement} className="graph-viewport">
                        {viewportSize.width > 0 && viewportSize.height > 0 ? (
                            <ForceGraph2D
                                ref={fgRef}
                                graphData={graphData}
                                width={viewportSize.width}
                                height={viewportSize.height}
                                nodeLabel="name"
                                nodeAutoColorBy="name"
                                backgroundColor="#ffffff"
                                // Aggressive parameters to stop layout quickly:
                                // - warmupTicks: minimal upfront ticks (nodes are pre-positioned in circle)
                                // - d3AlphaDecay: VERY fast cooling (0.05 instead of default 0.0228)
                                // - d3AlphaMin: stop simulation early at 0.01
                                // - cooldownTicks/cooldownTime: hard cap on simulation runtime
                                warmupTicks={20}
                                d3AlphaDecay={0.05}
                                d3AlphaMin={0.01}
                                cooldownTicks={30}
                                cooldownTime={300}
                                nodeCanvasObject={(node: NodeObject<GraphNode>, ctx) => {
                                   // Draw the node circle
                                   const radius = 4;
                                   const x = node.x ?? 0;
                                   const y = node.y ?? 0;
                                   ctx.fillStyle = node.color || '#666';
                                   ctx.beginPath();
                                   ctx.arc(x, y, radius, 0, 2 * Math.PI);
                                   ctx.fill();

                                   // Draw simple label (skip background for perf)
                                   const label = node.name;
                                   const fontSize = 6;

                                   ctx.fillStyle = '#001219';
                                   ctx.font = `bold ${fontSize}px Arial`;
                                   ctx.textAlign = 'center';
                                   ctx.textBaseline = 'middle';
                                   ctx.fillText(label, x, y - radius - 8);
                                 }}
                                onNodeClick={(node: GraphNode) => {
                                  // Resume animation on interaction so user can still drag/interact
                                  if (fgRef.current?.resumeAnimation) {
                                    fgRef.current.resumeAnimation();
                                  }
                                  handleConceptClick(node.uri, 'graph');
                                }}
                                onNodeHover={(node: NodeObject<GraphNode> | null) => {
                                  // Resume animation on hover for smooth interaction
                                  if (node && fgRef.current?.resumeAnimation) {
                                    fgRef.current.resumeAnimation();
                                  }
                                }}
                                nodePointerAreaPaint={(node: NodeObject<GraphNode>, color: string, ctx: CanvasRenderingContext2D) => {
                                   const x = node.x ?? 0;
                                   const y = node.y ?? 0;
                                   ctx.fillStyle = color;
                                   ctx.beginPath();
                                   ctx.arc(x, y, 6, 0, 2 * Math.PI);
                                   ctx.fill();
                                 }}
                            />
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="hierarchy" className="graph-tab-content">
                <Card className="graph-card graph-card--hierarchy">
                  <CardHeader className="graph-card-header">
                    <div className="graph-card-heading">
                      <Badge variant="outline">Hierarchy</Badge>
                      <CardTitle>Concept hierarchy</CardTitle>
                      <CardDescription>
                        Browse the selected concept as a compact tree with broader terms above and narrower terms below.
                      </CardDescription>
                    </div>
                  </CardHeader>

                  <CardContent className="graph-hierarchy-content">
                    <div className="hierarchy-view">
                      <HierarchySection
                          relation="broader"
                          title="Broader terms"
                          description="More general concepts that sit above the selected term."
                          items={hierarchyBroaderTerms}
                          expanded={hierarchyExpanded.broader}
                          onToggle={() => toggleHierarchySection('broader')}
                          onItemClick={(item) => handleConceptClick(item.uri, 'hierarchy')}
                          emptyLabel="No broader terms are available for this concept."
                      />

                      <div className="hierarchy-root-wrap">
                        <div className="hierarchy-root-card">
                          <Badge variant="secondary">Selected term</Badge>
                          <div className="hierarchy-root-title-row">
                            <span className="hierarchy-node-mark hierarchy-node-mark--root" aria-hidden="true" />
                            <h3>{stripLanguageTag(concept.prefLabel)}</h3>
                          </div>
                          <p className="hierarchy-root-uri">{concept.uri}</p>
                          <p className="hierarchy-root-definition">
                            {concept.definition ?? 'No definition is available for this concept yet.'}
                          </p>
                          <div className="hierarchy-root-stats" aria-label="Hierarchy summary">
                            <div>
                              <span>Broader</span>
                              <strong>{broaderCount}</strong>
                            </div>
                            <div>
                              <span>Narrower</span>
                              <strong>{narrowerCount}</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      <HierarchySection
                          relation="narrower"
                          title="Narrower terms"
                          description="More specific concepts that branch out from the selected term."
                          items={hierarchyNarrowerTerms}
                          expanded={hierarchyExpanded.narrower}
                          onToggle={() => toggleHierarchySection('narrower')}
                          onItemClick={(item) => handleConceptClick(item.uri, 'hierarchy')}
                          emptyLabel="No narrower terms are available for this concept."
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </section>
        </div>
        <Footer />
      </>
  );
}

export default GraphPage;