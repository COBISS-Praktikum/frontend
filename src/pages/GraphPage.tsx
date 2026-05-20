import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import ForceGraph2D, { type ForceGraphMethods, type NodeObject } from 'react-force-graph-2d';
import { Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { Footer } from '@/components/layout/Footer.tsx';
import { stripLanguageTag } from '@/lib/utils.ts';
import '@xyflow/react/dist/style.css';
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
  related?: ConceptNode[];
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


type HierarchyNodeKind = 'root' | 'broader' | 'shared' | 'narrower';
type HierarchyRelationKind = 'broader' | 'narrower' | 'related';

interface HierarchyNodeData extends Record<string, unknown> {
  label: string;
  uri: string;
  kind: HierarchyNodeKind;
  relations: HierarchyRelationKind[];
  onClick: (uri: string) => void;
}

interface HierarchyEdgeData extends Record<string, unknown> {
  relation: HierarchyRelationKind | 'shared';
}

type HierarchyFlowNode = Node<HierarchyNodeData, 'hierarchyConcept'>;
type HierarchyFlowEdge = Edge<HierarchyEdgeData>;

function getHierarchyNodeSize(kind: HierarchyNodeKind, label: string, relationCount = 1) {
  const baseWidth = kind === 'root' ? 300 : kind === 'shared' ? 290 : 250;
  const charsPerLine = kind === 'root' ? 22 : kind === 'shared' ? 20 : 24;
  const lines = Math.max(1, Math.ceil(Math.max(label.length, 12) / charsPerLine));
  const relationRows = kind === 'root' ? 0 : relationCount > 1 ? 1 : 0;

  return {
    width: baseWidth,
    height: (kind === 'root' ? 74 : kind === 'shared' ? 72 : 58) + (lines - 1) * 18 + relationRows * 22,
  };
}

function buildHierarchyLayout(nodes: HierarchyFlowNode[], edges: HierarchyFlowEdge[]) {
  const rootNode = nodes.find((node) => node.data.kind === 'root');
  if (!rootNode) return { nodes, edges };

  const getSize = (node: HierarchyFlowNode) => ({
    width: typeof node.style?.width === 'number' ? node.style.width : getHierarchyNodeSize(node.data.kind, node.data.label).width,
    height: typeof node.style?.height === 'number' ? node.style.height : getHierarchyNodeSize(node.data.kind, node.data.label).height,
  });

  const broaderNodes = nodes.filter((n) => n.data.kind === 'broader');
  const sharedNodes = nodes.filter((n) => n.data.kind === 'shared');
  const narrowerNodes = nodes.filter((n) => n.data.kind === 'narrower');
  const vGap = 60;
  const branchGap = 140;

  const rootSize = getSize(rootNode);

  const layoutColumn = (row: HierarchyFlowNode[], startY: number) => {
    let y = startY;

    return row.map((node) => {
      const size = getSize(node);
      const positioned = { ...node, position: { x: rootSize.width / 2 + branchGap, y } };
      y += size.height + vGap;
      return positioned;
    });
  };

  const columnHeight = (row: HierarchyFlowNode[]) =>
    row.length > 0 ? row.reduce((sum, node) => sum + getSize(node).height, 0) + vGap * (row.length - 1) : 0;

  const rootY = 0;
  const broaderStartY = -(vGap + columnHeight(broaderNodes));
  const relatedStartY = rootSize.height + vGap;
  const narrowerStartY = relatedStartY + columnHeight(sharedNodes) + vGap;

  return {
    nodes: [
      { ...rootNode, position: { x: -rootSize.width / 2, y: rootY } },
      ...layoutColumn(broaderNodes, broaderStartY),
      ...layoutColumn(sharedNodes, relatedStartY),
      ...layoutColumn(narrowerNodes, narrowerStartY),
    ],
    edges,
  };
}

const HierarchyConceptNode = memo(function HierarchyConceptNode({ data }: NodeProps<HierarchyFlowNode>) {
  const label = stripLanguageTag(data.label);
  const relationLabel =
    data.kind === 'root'
      ? 'Open selected term'
      : data.kind === 'broader'
        ? 'Open broader term'
        : data.kind === 'narrower'
          ? 'Open narrower term'
          : 'Open related term';
  const relationChips = data.kind === 'root' ? [] : data.relations.map((relation) => relation);
  const ariaLabel = `${relationLabel} ${label}`;

  return (
    <div className={`hierarchy-flow-node hierarchy-flow-node--${data.kind}`}>
      {data.kind === 'root' ? null : (
        <Handle type="target" position={Position.Left} className="hierarchy-flow-handle hierarchy-flow-handle--target" />
      )}

      <button
        type="button"
        className={`hierarchy-flow-node-card hierarchy-flow-node-card--${data.kind} nodrag nopan`}
        onClick={() => data.onClick(data.uri)}
        onMouseDown={(e) => e.stopPropagation()}
        title={data.uri}
        aria-label={ariaLabel}
      >
        <span className="hierarchy-flow-node-icon" aria-hidden="true">
          ✳
        </span>
        <span className="hierarchy-flow-node-copy">
          <span className="hierarchy-flow-node-title">{label}</span>
          {relationChips.length > 0 ? (
            <span className="hierarchy-flow-node-relations" aria-hidden="true">
              {relationChips.map((relation) => (
                <span key={relation} className={`hierarchy-flow-node-relation hierarchy-flow-node-relation--${relation}`}>
                  {relation}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      </button>

      {data.kind === 'root' ? (
        <Handle type="source" position={Position.Right} className="hierarchy-flow-handle hierarchy-flow-handle--source" />
      ) : null}
    </div>
  );
});

const HIERARCHY_NODE_TYPES = {
  hierarchyConcept: HierarchyConceptNode,
};

function createHierarchyNode(kind: HierarchyNodeKind, item: ConceptNode, onClick: (uri: string) => void, relations: HierarchyRelationKind[] = []): HierarchyFlowNode {
  const label = stripLanguageTag(item.prefLabel ?? item.prefLabelEn ?? item.prefLabelSl ?? item.uri) || item.uri;
  const { width, height } = getHierarchyNodeSize(kind, label, relations.length);

  return {
    id: `${kind}:${item.uri}`,
    type: 'hierarchyConcept',
    position: { x: 0, y: 0 },
    data: {
      label,
      uri: item.uri,
      kind,
      relations,
      onClick,
    },
    draggable: false,
    selectable: false,
    focusable: false,
    sourcePosition: kind === 'root' ? Position.Right : Position.Right,
    targetPosition: kind === 'root' ? Position.Right : Position.Left,
    style: {
      width,
      height,
    },
  };
}

function createHierarchyRootNode(concept: Concept, onClick: (uri: string) => void): HierarchyFlowNode {
  return createHierarchyNode('root', concept, onClick, []);
}

function buildHierarchyNodes(
  concept: Concept,
  broader: ConceptNode[],
  narrower: ConceptNode[],
  related: ConceptNode[],
  onClick: (uri: string) => void,
) {
  const grouped = new Map<string, { item: ConceptNode; relations: Set<HierarchyRelationKind> }>();

  const add = (relation: HierarchyRelationKind, item: ConceptNode) => {
    const current = grouped.get(item.uri) ?? { item, relations: new Set<HierarchyRelationKind>() };
    current.item = item;
    current.relations.add(relation);
    grouped.set(item.uri, current);
  };

  broader.forEach((item) => add('broader', item));
  narrower.forEach((item) => add('narrower', item));
  related.forEach((item) => add('related', item));

  const relationToKind = (relations: HierarchyRelationKind[]): Exclude<HierarchyNodeKind, 'root'> => {
    if (relations.length > 1) return 'shared';
    if (relations[0] === 'broader') return 'broader';
    if (relations[0] === 'narrower') return 'narrower';
    return 'shared';
  };

  const sortedEntries = Array.from(grouped.values()).sort((left, right) => {
    const priority = (relations: HierarchyRelationKind[]) => {
      if (relations.includes('broader') && !relations.includes('narrower') && !relations.includes('related')) return 0;
      if (relations.length > 1) return 1;
      if (relations.includes('related')) return 2;
      return 3;
    };

    const leftPriority = priority(Array.from(left.relations));
    const rightPriority = priority(Array.from(right.relations));
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return getConceptLabel(left.item).localeCompare(getConceptLabel(right.item), undefined, { sensitivity: 'base' });
  });

  const nodes: HierarchyFlowNode[] = [createHierarchyRootNode(concept, onClick)];
  const edges: HierarchyFlowEdge[] = [];

  sortedEntries.forEach(({ item, relations }) => {
    const relationList = Array.from(relations);
    const kind = relationToKind(relationList);
    const node = createHierarchyNode(kind, item, onClick, relationList);
    nodes.push(node);

    const edgeRelation = relationList.length === 1 ? relationList[0] : 'shared';
    const source = kind === 'broader' ? node.id : `root:${concept.uri}`;
    const target = kind === 'broader' ? `root:${concept.uri}` : node.id;

    edges.push({
      id: `${source}->${target}`,
      source,
      target,
      type: 'step',
      selectable: false,
      focusable: false,
      data: { relation: edgeRelation },
    });
  });

  return buildHierarchyLayout(nodes, edges);
}

function getConceptLabel(item: ConceptNode) {
  return stripLanguageTag(item.prefLabel ?? item.prefLabelEn ?? item.prefLabelSl ?? item.uri) || item.uri;
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
      related {
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
  const hierarchyFlowInstanceRef = useRef<{ fitView: (options?: { padding?: number }) => void } | null>(null);
  const [hierarchyViewportElement, setHierarchyViewportElement] = useState<HTMLDivElement | null>(null);
  const [hierarchyViewportSize, setHierarchyViewportSize] = useState({ width: 0, height: 0 });
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

  useEffect(() => {
    if (!hierarchyViewportElement) {
      return;
    }

    const measure = () => {
      const { width, height } = hierarchyViewportElement.getBoundingClientRect();
      const nextWidth = Math.max(0, Math.floor(width));
      const nextHeight = Math.max(0, Math.floor(height));

      setHierarchyViewportSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }

        return { width: nextWidth, height: nextHeight };
      });

    };

    const rafId = requestAnimationFrame(measure);
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(hierarchyViewportElement);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [hierarchyViewportElement]);

  const graphData = useMemo<GraphData>(() => {
    if (!data || !data.concept) {
      return { nodes: [], links: [] };
    }

    const concept = data.concept;
    const nodeMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];

    const addNode = (item: ConceptNode) => {
      if (!nodeMap.has(item.uri)) {
        nodeMap.set(item.uri, { id: item.uri, name: getConceptLabel(item), uri: item.uri });
      }
    };

    const addRelationGroup = (items: ConceptNode[] | undefined) => {
      items?.forEach((item) => {
        addNode(item);
        links.push({ source: concept.uri, target: item.uri });
      });
    };

    // Add the main concept
    addNode(concept);

    // Add broader, narrower, and related concepts
    addRelationGroup(concept.broader);
    addRelationGroup(concept.narrower);
    addRelationGroup(concept.related);

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
  const broaderTerms = useMemo(() => {
    const broader = concept?.broader ?? [];
    const seen = new Set<string>();

    return broader.filter((item) => {
      if (seen.has(item.uri)) {
        return false;
      }

      seen.add(item.uri);
      return true;
    });
  }, [concept?.broader]);

  const narrowerTerms = useMemo(() => {
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

  const broaderCount = broaderTerms.length;
  const narrowerCount = narrowerTerms.length;
  const activeTab = searchParams.get('tab') === 'hierarchy' ? 'hierarchy' : 'graph';

  const buildConceptUrl = useCallback(
    (targetUri: string, tab: 'graph' | 'hierarchy') => `/frontend/graph/${encodeURIComponent(targetUri)}?tab=${tab}`,
    [],
  );

  const handleTabChange = useCallback((value: string) => {
    const nextTab = value === 'hierarchy' ? 'hierarchy' : 'graph';
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', nextTab);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleConceptClick = useCallback((targetUri: string, tab: 'graph' | 'hierarchy') => {
    navigate(buildConceptUrl(targetUri, tab));
  }, [buildConceptUrl, navigate]);

  const handleHierarchyConceptClick = useCallback((targetUri: string) => {
    navigate(buildConceptUrl(targetUri, activeTab));
  }, [activeTab, buildConceptUrl, navigate]);

  const hierarchyFlow = useMemo(() => {
    if (!concept) {
      return {
        nodes: [],
        edges: [],
      };
    }

    return buildHierarchyNodes(concept, broaderTerms, narrowerTerms, concept.related ?? [], handleHierarchyConceptClick);
  }, [concept, broaderTerms, narrowerTerms, handleHierarchyConceptClick]);

  useEffect(() => {
    if (activeTab !== 'hierarchy') {
      return;
    }

    if (hierarchyViewportSize.width <= 0 || hierarchyViewportSize.height <= 0 || hierarchyFlow.nodes.length === 0) {
      return;
    }

    const rafId = requestAnimationFrame(() => {
      hierarchyFlowInstanceRef.current?.fitView({ padding: 0.22 });
    });

    return () => cancelAnimationFrame(rafId);
  }, [activeTab, hierarchyFlow.nodes.length, hierarchyViewportSize.height, hierarchyViewportSize.width]);

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
                        Browse the selected concept with broader terms above, shared/related terms grouped once, and narrower terms below.
                      </CardDescription>
                    </div>
                  </CardHeader>

                  <CardContent className="graph-hierarchy-content">
                    <div className="hierarchy-flow-shell">
                      <div ref={setHierarchyViewportElement} className="hierarchy-flow" aria-label="Concept hierarchy tree">
                        {hierarchyViewportSize.width > 0 && hierarchyViewportSize.height > 0 && hierarchyFlow.nodes.length > 0 ? (
                          <ReactFlow<HierarchyFlowNode, HierarchyFlowEdge>
                            nodes={hierarchyFlow.nodes}
                            edges={hierarchyFlow.edges}
                            nodeTypes={HIERARCHY_NODE_TYPES}
                            width={hierarchyViewportSize.width}
                            height={hierarchyViewportSize.height}
                            style={{ width: '100%', height: '100%' }}
                            onInit={(instance) => {
                              hierarchyFlowInstanceRef.current = instance;

                              try {
                                instance.fitView({ padding: 0.18 });
                              } catch {
                                // ignore
                              }
                            }}
                            minZoom={0.45}
                            maxZoom={1.3}
                            panOnDrag
                            zoomOnScroll={false}
                            zoomOnPinch
                            nodeClickDistance={0}
                            nodesDraggable={false}
                            nodesConnectable={false}
                            elementsSelectable={false}
                            preventScrolling={false}
                            defaultEdgeOptions={{
                              type: 'smoothstep', // Gives those crisp right angles with tiny rounded elbow points
                              focusable: false,
                              selectable: false,
                              style: {
                                stroke: '#0a9396', // Uses your brand teal line tracking color
                                strokeWidth: 2.5,
                              },
                            }}
                            proOptions={{ hideAttribution: true }}
                          />
                        ) : (
                          <div className="hierarchy-empty-state">Preparing hierarchy view…</div>
                        )}
                      </div>
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