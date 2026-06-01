import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import * as d3 from 'd3-force';
import ForceGraph2D, { type ForceGraphMethods, type NodeObject } from 'react-force-graph-2d';
import { Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { Footer } from '@/components/layout/Footer.tsx';
import { SEO } from '@/components/layout/SEO.tsx';
import { stripLanguageTag } from '@/lib/utils.ts';
import { useConceptDefinition } from '@/hooks/useConceptDefinition.ts';
import { useTheme } from '@/hooks/useTheme.ts';
import '@xyflow/react/dist/style.css';
import './GraphPage.css';

interface ConceptNode {
  uri: string;
  prefLabel?: string | null;
  prefLabelSl?: string | null;
  prefLabelEn?: string | null;
}

interface Concept extends ConceptNode {
  definition?: string | null;
  broader?: ConceptNode[];
  narrower?: ConceptNode[];
  related?: ConceptNode[];
}

interface GetConceptResponse {
  concept: Concept;
}

interface ConceptEdge {
  sourceUri: string;
  targetUri: string;
  relationType: 'broader' | 'narrower' | 'related' | string;
}

interface NeighborhoodResponse {
  conceptNeighborhood: ConceptNode[];
  conceptNeighborhoodEdges: ConceptEdge[];
}

interface GraphNode {
  id: string;
  name: string;
  uri: string;
  x?: number;
  y?: number;
  color?: string;
  isCluster?: boolean;
  clusterKind?: 'broader' | 'narrower' | 'related';
  isExpanded?: boolean;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// ─── COBISS canvas palette (theme-aware) ────────────────────────────────────
// The force-graph canvas is painted in JS, so it can't read CSS variables the
// way the DOM does — we keep two explicit palettes and pick one by theme.
type CanvasPalette = {
  bg: string;
  navy: string;
  navyHover: string;
  teal: string;
  clusterBg: string;
  clusterText: string;
  nodeText: string;
  centerStroke: string;
  nodeStroke: string;
  clusterStroke: string;
  btnFill: string;
  clusterBtnHover: string;
  nodeBtnHover: string;
  shadowCenter: string;
  shadowNode: string;
  link: string;
  linkDim: string;
  arrow: string;
  edge: string;
};

const CANVAS_PALETTE: Record<'light' | 'dark', CanvasPalette> = {
  light: {
    bg: '#ffffff',
    navy: '#004b87',
    navyHover: '#0070c0',
    teal: '#00a99d',
    clusterBg: '#eef3f8',
    clusterText: '#1f3a52',
    nodeText: '#ffffff',
    centerStroke: '#ffffff',
    nodeStroke: 'rgba(255, 255, 255, 0.85)',
    clusterStroke: 'rgba(0, 75, 135, 0.22)',
    btnFill: '#ffffff',
    clusterBtnHover: '#d6e3f0',
    nodeBtnHover: 'rgba(0, 169, 157, 0.16)',
    shadowCenter: 'rgba(0, 169, 157, 0.35)',
    shadowNode: 'rgba(0, 75, 135, 0.25)',
    link: 'rgba(0, 75, 135, 0.22)',
    linkDim: 'rgba(100, 116, 139, 0.18)',
    arrow: 'rgba(0, 75, 135, 0.45)',
    edge: 'rgba(0, 75, 135, 0.45)',
  },
  dark: {
    bg: '#0c1a28',
    navy: '#2f86c4',
    navyHover: '#54a6e0',
    teal: '#19c5b6',
    clusterBg: '#15314c',
    clusterText: '#cfe0ef',
    nodeText: '#ffffff',
    centerStroke: '#0c1a28',
    nodeStroke: 'rgba(8, 20, 32, 0.55)',
    clusterStroke: 'rgba(120, 170, 210, 0.40)',
    btnFill: '#0e2233',
    clusterBtnHover: '#1d4063',
    nodeBtnHover: 'rgba(31, 195, 180, 0.24)',
    shadowCenter: 'rgba(31, 195, 180, 0.45)',
    shadowNode: 'rgba(84, 166, 224, 0.40)',
    link: 'rgba(120, 170, 210, 0.30)',
    linkDim: 'rgba(120, 140, 160, 0.16)',
    arrow: 'rgba(120, 170, 210, 0.55)',
    edge: 'rgba(120, 170, 210, 0.55)',
  },
};

const EMPTY_CONCEPT_NODES: ConceptNode[] = [];

function getConceptLabel(item: ConceptNode, lang: string) {
  if (lang === 'sl') {
    return stripLanguageTag(item.prefLabelSl ?? item.prefLabelEn ?? item.prefLabel) || item.uri;
  }
  return stripLanguageTag(item.prefLabelEn ?? item.prefLabelSl ?? item.prefLabel) || item.uri;
}

// Helper to safely resolve a node's ID regardless of D3 object mutation
function getNodeId(nodeRef: string | GraphNode | NodeObject<GraphNode> | undefined | null): string {
  if (!nodeRef) return '';
  if (typeof nodeRef === 'string') return nodeRef;
  if (typeof nodeRef === 'object') {
    return nodeRef.id || nodeRef.uri || '';
  }
  return '';
}

type HierarchyNodeKind = 'root' | 'broader' | 'shared' | 'narrower';
type HierarchyRelationKind = 'broader' | 'narrower' | 'related';
type HierarchyGroupKind = HierarchyRelationKind;

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
    width: baseWidth + 20,
    height: (kind === 'root' ? 84 : kind === 'shared' ? 76 : 64) + (lines - 1) * 20 + relationRows * 22,
  };
}

// Internal helper types for strongly-typed hitbox access (avoid using `any`)
interface PlusHitbox {
  x: number;
  y: number;
  r: number;
  isCluster?: boolean;
  isCenter?: boolean;
}

type HitboxHolder = { _plusHitbox?: PlusHitbox };

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
      <div
          className={`hierarchy-flow-node hierarchy-flow-node--${data.kind}`}
      >
        {data.kind === 'root' ? null : (
            <Handle type="target" position={Position.Left} className="hierarchy-flow-handle hierarchy-flow-handle--target" />
        )}

        <button
            type="button"
            className={`hierarchy-flow-node-card hierarchy-flow-node-card--${data.kind} nodrag nopan shadow-sm hover:shadow-md transition-shadow rounded-sm border border-[var(--line)] bg-[var(--surface)] text-card-foreground group flex items-start gap-3 p-4`}
            onClick={() => data.onClick(data.uri)}
            onMouseDown={(e) => e.stopPropagation()}
            title={data.uri}
            aria-label={ariaLabel}
        >
        <span className="hierarchy-flow-node-icon bg-[var(--tint-navy)] border border-[var(--brand-navy)]/15 text-[var(--brand-navy)] rounded-sm w-8 h-8 flex items-center justify-center shrink-0 group-hover:border-[var(--brand-teal)]/30 group-hover:bg-[var(--tint-teal)] transition-colors" aria-hidden="true">
          {data.kind === 'root' ? '🎯' : data.kind === 'broader' ? '⬆️' : data.kind === 'narrower' ? '⬇️' : '↔️'}
        </span>
          <span className="hierarchy-flow-node-copy text-left flex flex-col pt-1">
          <span className="hierarchy-flow-node-title font-semibold text-[15px] text-[var(--ink)] group-hover:text-[var(--brand-navy)] transition-colors">{label}</span>
            {relationChips.length > 0 ? (
                <span className="hierarchy-flow-node-relations mt-2 flex flex-wrap gap-1" aria-hidden="true">
              {relationChips.map((relation) => (
                  <span key={relation} className={`hierarchy-flow-node-relation hierarchy-flow-node-relation--${relation} text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-sm bg-[var(--tint-navy)] text-[var(--brand-navy)] border border-[var(--brand-navy)]/15`}>
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

function createHierarchyNode(kind: HierarchyNodeKind, item: ConceptNode, onClick: (uri: string) => void, relations: HierarchyRelationKind[] = [], lang: string): HierarchyFlowNode {
  const label = getConceptLabel(item, lang);
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

function createHierarchyRootNode(concept: Concept, onClick: (uri: string) => void, lang: string): HierarchyFlowNode {
  return createHierarchyNode('root', concept, onClick, [], lang);
}

function buildHierarchyNodes(
    concept: Concept,
    broader: ConceptNode[],
    narrower: ConceptNode[],
    related: ConceptNode[],
    onClick: (uri: string) => void,
    lang: string
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
    return getConceptLabel(left.item, lang).localeCompare(getConceptLabel(right.item, lang), undefined, { sensitivity: 'base' });
  });

  const nodes: HierarchyFlowNode[] = [createHierarchyRootNode(concept, onClick, lang)];
  const edges: HierarchyFlowEdge[] = [];

  sortedEntries.forEach(({ item, relations }) => {
    const relationList = Array.from(relations);
    const kind = relationToKind(relationList);
    const node = createHierarchyNode(kind, item, onClick, relationList, lang);
    nodes.push(node);

    const edgeRelation = relationList.length === 1 ? relationList[0] : 'shared';
    const source = `root:${concept.uri}`;
    const target = node.id;

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

function dedupeConceptNodes(items?: ConceptNode[]) {
  const seen = new Set<string>();

  return (items ?? []).filter((item) => {
    if (seen.has(item.uri)) {
      return false;
    }

    seen.add(item.uri);
    return true;
  });
}

// ─── GraphQL queries ──────────────────────────────────────────────────────────
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

const GET_NEIGHBORHOOD = gql`
  query GetConceptNeighborhood($uri: String!) {
    conceptNeighborhood(uri: $uri) {
      uri
      prefLabel
      prefLabelSl
      prefLabelEn
    }
    conceptNeighborhoodEdges(uri: $uri) {
      sourceUri
      targetUri
      relationType
    }
  }
`;

interface DefinitionOverlayProps {
  concept: Concept;
  translatedTitle: string;
  broaderCount: number;
  narrowerCount: number;
  relatedCount: number;
  lang: string;
  t: TFunction;
}

function DefinitionOverlay({ concept, translatedTitle, relatedCount, broaderCount, narrowerCount, lang, t }: DefinitionOverlayProps) {
  const defState = useConceptDefinition({
    lang,
    definition: concept.definition,
    prefLabelSl: concept.prefLabelSl ?? concept.prefLabel,
    prefLabelEn: concept.prefLabelEn ?? concept.prefLabel,
  });

  const definitionText = defState.status === 'ready' ? defState.text : null;

  const aiBadge =
      defState.status === 'ready' && defState.source !== 'native' ? (
          <span
              className="inline-flex items-center gap-1 text-[9px] uppercase font-bold tracking-wider text-[var(--brand-teal-strong)] mt-1"
              title={defState.source === 'translated' ? 'Translated by AI' : 'Generated by AI'}
              aria-label={defState.source === 'translated' ? 'AI translated definition' : 'AI generated definition'}
          >
        <span aria-hidden="true">✦</span>
            {defState.source === 'translated' ? t('aiTranslated', 'AI translated') : t('aiGenerated', 'AI generated')}
      </span>
      ) : null;

  return (
      <div className="graph-overlay absolute top-4 left-4 z-10 w-72 bg-[var(--surface)]/95 backdrop-blur-sm border border-[var(--line)] shadow-lg shadow-[var(--brand-navy)]/5 p-5 rounded-sm flex flex-col gap-3 pointer-events-none">
        <h3 className="text-lg font-bold leading-tight text-[var(--ink)] font-heading">{translatedTitle}</h3>

        <div className="graph-overlay-definition text-sm text-[var(--ink-muted)] leading-relaxed">
          {defState.status === 'loading' ? (
              <div className="flex flex-col gap-1.5" aria-label={t('loadingDefinition', 'Loading definition…')}>
                <Skeleton className="h-3 w-full rounded bg-[var(--surface-muted)]" />
                <Skeleton className="h-3 w-5/6 rounded bg-[var(--surface-muted)]" />
                <Skeleton className="h-3 w-4/6 rounded bg-[var(--surface-muted)]" />
              </div>
          ) : definitionText ? (
              <>
                <p className="line-clamp-4">{definitionText}</p>
                {aiBadge}
              </>
          ) : null}
        </div>

        <Separator className="graph-overlay-separator my-2" />

        <div className="graph-metrics flex justify-between gap-2" aria-label="Concept relation summary">
          <div className="graph-metric flex flex-col bg-[var(--surface-muted)] border border-[var(--line)] p-2 rounded-sm flex-1 text-center">
            <span className="text-[10px] uppercase font-bold text-[var(--ink-faint)]">{t('broader', 'Broader')}</span>
            <strong className="text-lg text-[var(--brand-navy)]">{broaderCount}</strong>
          </div>
          <div className="graph-metric flex flex-col bg-[var(--surface-muted)] border border-[var(--line)] p-2 rounded-sm flex-1 text-center">
            <span className="text-[10px] uppercase font-bold text-[var(--ink-faint)]">{t('narrower', 'Narrower')}</span>
            <strong className="text-lg text-[var(--brand-navy)]">{narrowerCount}</strong>
          </div>
          <div className="graph-metric flex flex-col bg-[var(--surface-muted)] border border-[var(--line)] p-2 rounded-sm flex-1 min-w-[60px] text-center">
            <span className="text-[10px] uppercase font-bold text-[var(--ink-faint)]">{t('related', 'Related')}</span>
            <strong className="text-lg text-[var(--brand-navy)]">{relatedCount}</strong>
          </div>
          <div className="graph-metric flex flex-col bg-[var(--tint-navy)] border border-[var(--brand-navy)]/15 p-2 rounded-sm flex-1 text-center">
            <span className="text-[10px] uppercase font-bold text-[var(--ink-faint)]">{t('totalLinks', 'Total Links')}</span>
            <strong className="text-lg text-[var(--brand-teal-strong)]">{broaderCount + relatedCount + narrowerCount}</strong>
          </div>
        </div>
      </div>
  );
}

function GraphPage() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const P = CANVAS_PALETTE[theme === 'dark' ? 'dark' : 'light'];
  const selectedLanguage = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const searchLanguage = selectedLanguage.toLowerCase().startsWith('sl') ? 'sl' : 'en';
  const [hoveringButtonOfNode, setHoveringButtonOfNode] = useState<string | null>(null);




  const { uri } = useParams<{ uri: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const [graphViewportElement, setGraphViewportElement] = useState<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const hierarchyFlowInstanceRef = useRef<{ fitView: (options?: { padding?: number }) => void } | null>(null);
  const [hierarchyViewportElement, setHierarchyViewportElement] = useState<HTMLDivElement | null>(null);
  const [hierarchyViewportSize, setHierarchyViewportSize] = useState({ width: 0, height: 0 });

  const [expandedGroups, setExpandedGroups] = useState<Record<HierarchyGroupKind, boolean>>({
    broader: true,
    related: true,
    narrower: false,
  });

  // Modern state tracking replacing explicit useApolloClient calls
  const [targetNeighborhoodUri, setTargetNeighborhoodUri] = useState<string>('');
  const [neighborhoodCache, setNeighborhoodCache] = useState<Map<string, { nodes: ConceptNode[]; edges: ConceptEdge[] }>>(new Map());

  const decodedUri = useMemo(() => decodeURIComponent(uri || ''), [uri]);

  // Main concept data query
  const { loading, error, data } = useQuery<GetConceptResponse>(GET_CONCEPT, {
    variables: { uri: decodedUri },
  });

  // Dynamic Query Hook specifically pulling context changes for dynamic node selection
  const { data: neighborhoodData } = useQuery<NeighborhoodResponse>(GET_NEIGHBORHOOD, {
    variables: { uri: targetNeighborhoodUri },
    skip: !targetNeighborhoodUri,
  });

  // Capture incoming network responses to construct interactive extensions reactively
  useEffect(() => {
    if (neighborhoodData?.conceptNeighborhood && neighborhoodData?.conceptNeighborhoodEdges && targetNeighborhoodUri) {
      // Defer state updates to avoid calling setState synchronously inside the effect
      setTimeout(() => {
        setNeighborhoodCache((prev) => {
          const updated = new Map(prev);
          updated.set(targetNeighborhoodUri, {
            nodes: neighborhoodData.conceptNeighborhood,
            edges: neighborhoodData.conceptNeighborhoodEdges,
          });
          return updated;
        });
        setTargetNeighborhoodUri('');
      }, 0);
    }
  }, [neighborhoodData, targetNeighborhoodUri]);

  // Reset local cluster expansion logs whenever the global center URI changes
  useEffect(() => {
    // Reset cache asynchronously to satisfy react-hooks/set-state-in-effect rule
    setTimeout(() => setNeighborhoodCache(new Map()), 0);
  }, [decodedUri]);

  const activeTab = searchParams.get('tab') === 'hierarchy' ? 'hierarchy' : 'graph';

  useEffect(() => {
    if (!graphViewportElement) return;
    const measure = () => {
      const { width, height } = graphViewportElement.getBoundingClientRect();
      setViewportSize({ width: Math.max(0, Math.floor(width)), height: Math.max(0, Math.floor(height)) });
    };
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(graphViewportElement);
    return () => resizeObserver.disconnect();
  }, [graphViewportElement]);

  useEffect(() => {
    if (!hierarchyViewportElement) return;
    const measure = () => {
      const { width, height } = hierarchyViewportElement.getBoundingClientRect();
      setHierarchyViewportSize({ width: Math.max(0, Math.floor(width)), height: Math.max(0, Math.floor(height)) });
    };
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(hierarchyViewportElement);
    return () => resizeObserver.disconnect();
  }, [hierarchyViewportElement]);

  // Handle graph force bindings on initial mounts safely
  useEffect(() => {
    if (activeTab !== 'graph' || !fgRef.current) return;

    const fg = fgRef.current;
    fg.d3Force('charge')?.strength(-650);
    fg.d3Force('link')?.distance(110);
    fg.d3Force('collide', d3.forceCollide().radius(45).iterations(3));
    fg.d3Force('center', d3.forceCenter());

    const timer = setTimeout(() => {
      try {
        fgRef.current?.zoomToFit(400, 70, () => true);
      } catch {
        void 0;
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [data, activeTab, viewportSize, neighborhoodCache]);

  // ─── GRAPH DATA MAPPING (Matches your Sketch completely) ───
  const graphData = useMemo<GraphData>(() => {
    if (!data?.concept) return { nodes: [], links: [] };

    const concept = data.concept;
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // Helper map to deduplicate physical concept nodes across the interface
    const addedNodes = new Map<string, GraphNode>();

    const getOrAddConceptNode = (item: ConceptNode, isCenter = false) => {
      if (addedNodes.has(item.uri)) {
        return addedNodes.get(item.uri)!;
      }
      const nodeObj: GraphNode = {
        id: item.uri,
        name: getConceptLabel(item, searchLanguage).toUpperCase(),
        uri: item.uri,
        isExpanded: isCenter ? true : neighborhoodCache.has(item.uri)
      };
      nodes.push(nodeObj);
      addedNodes.set(item.uri, nodeObj);
      return nodeObj;
    };

    // 1. Core Focus Root Node
    getOrAddConceptNode(concept, true);

    // Helper to generate localized structural labels
    const getClusterLabel = (kind: 'broader' | 'narrower' | 'related') => {
      if (searchLanguage === 'sl') {
        return kind === 'broader' ? ' Širši' : kind === 'narrower' ? ' Ožji' : ' Sorodni';
      }
      return kind === 'broader' ? ' Broader' : kind === 'narrower' ? ' Narrower' : ' Related';
    };

    // Helper to spin up isolated row sorting points scoped precisely to an individual parent
    const addCategoryCluster = (parentUri: string, kind: 'broader' | 'narrower' | 'related') => {
      const clusterId = `cluster:${kind}:${parentUri}`;
      nodes.push({
        id: clusterId,
        name: getClusterLabel(kind),
        uri: clusterId,
        isCluster: true,
        clusterKind: kind
      });
      links.push({ source: parentUri, target: clusterId });
      return clusterId;
    };

    // 2. Map structural root categories
    const rootGroups = [
      { kind: 'broader' as const, items: concept.broader },
      { kind: 'narrower' as const, items: concept.narrower },
      { kind: 'related' as const, items: concept.related },
    ];

    rootGroups.forEach((group) => {
      if (!group.items || group.items.length === 0) return;
      const clusterId = addCategoryCluster(concept.uri, group.kind);
      group.items.forEach((item) => {
        getOrAddConceptNode(item);
        links.push({ source: clusterId, target: item.uri });
      });
    });

    // 3. Process dynamic cascading neighborhood expansions reactively
    neighborhoodCache.forEach((cacheValue, originUri) => {
      const { nodes: neighborNodes, edges: neighborEdges } = cacheValue;

      // Group neighbor nodes by their URIs for rapid structural indexing
      const neighborMap = new Map(neighborNodes.map(n => [n.uri, n]));

      // Categorize target instances via fetched relationship types
      const sortedByKind: Record<'broader' | 'narrower' | 'related', string[]> = {
        broader: [],
        narrower: [],
        related: []
      };

      neighborEdges.forEach((edge) => {
        // Ensure we only process relationships expanding outward from our current clicked origin node
        if (edge.sourceUri === originUri) {
          const kind = edge.relationType.toLowerCase();
          if (kind === 'broader' || kind === 'narrower' || kind === 'related') {
            sortedByKind[kind].push(edge.targetUri);
          }
        }
      });

      // Construct unique subcategories out from the origin node
      (['broader', 'narrower', 'related'] as const).forEach((kind) => {
        const targetUris = sortedByKind[kind];
        if (targetUris.length === 0) return;

        const clusterId = addCategoryCluster(originUri, kind);

        targetUris.forEach((targetUri) => {
          const rawItem = neighborMap.get(targetUri);
          if (rawItem) {
            getOrAddConceptNode(rawItem);
            // Connect structural cluster node to the final target concept node
            links.push({ source: clusterId, target: targetUri });
          }
        });
      });
    });

    return { nodes, links };
  }, [data, searchLanguage, neighborhoodCache]);

  const concept = data?.concept;
  const canonicalUrl = typeof window !== 'undefined' && uri ? `${window.location.origin}/frontend/graph/${uri}` : undefined;

  const broaderTerms = useMemo(() => dedupeConceptNodes(concept?.broader), [concept?.broader]);
  const narrowerTerms = useMemo(() => dedupeConceptNodes(concept?.narrower), [concept?.narrower]);
  const relatedTerms = useMemo(() => dedupeConceptNodes(concept?.related), [concept?.related]);

  const broaderCount = broaderTerms.length;
  const narrowerCount = narrowerTerms.length;
  const relatedCount = relatedTerms.length;
  const translatedTitle = concept ? getConceptLabel(concept, searchLanguage) : '';
  const seoTitle = concept ? t('seoGraphTitle', { conceptName: translatedTitle, defaultValue: `${translatedTitle} - SGC Navigator` }) : t('seoGraphLoadingTitle', 'Concept details - SGC Navigator');
  const seoDescription = concept ? t('seoGraphDescription', { conceptName: translatedTitle, defaultValue: `Explore semantic graphs for ${translatedTitle}.` }) : t('seoGraphLoadingDescription', 'Loading concept details.');
  const seoKeywords = t('seoGraphKeywords', 'SGC Navigator, COBISS');

  const toggleHierarchyGroup = useCallback((kind: HierarchyGroupKind) => {
    setExpandedGroups((current) => ({ ...current, [kind]: !current[kind] }));
  }, []);

  const buildConceptUrl = useCallback((targetUri: string, tab: 'graph' | 'hierarchy') => `/frontend/graph/${encodeURIComponent(targetUri)}?tab=${tab}`, []);

  const handleTabChange = useCallback((value: string) => {
    const nextTab = value === 'hierarchy' ? 'hierarchy' : 'graph';
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', nextTab);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  /*const handleConceptClick = useCallback((targetUri: string, tab: 'graph' | 'hierarchy') => {
    navigate(buildConceptUrl(targetUri, tab));
  }, [buildConceptUrl, navigate]);*/

  const handleHierarchyConceptClick = useCallback((targetUri: string) => {
    navigate(buildConceptUrl(targetUri, 'hierarchy'));
  }, [buildConceptUrl, navigate]);

  const hierarchyFlow = useMemo(() => {
    if (!concept) return { nodes: [], edges: [] };
    const visibleBroaderTerms = expandedGroups.broader ? broaderTerms : EMPTY_CONCEPT_NODES;
    const visibleRelatedTerms = expandedGroups.related ? dedupeConceptNodes(concept.related) : EMPTY_CONCEPT_NODES;
    const visibleNarrowerTerms = expandedGroups.narrower ? narrowerTerms : EMPTY_CONCEPT_NODES;
    return buildHierarchyNodes(concept, visibleBroaderTerms, visibleNarrowerTerms, visibleRelatedTerms, handleHierarchyConceptClick, searchLanguage);
  }, [concept, expandedGroups.broader, expandedGroups.narrower, expandedGroups.related, broaderTerms, narrowerTerms, handleHierarchyConceptClick, searchLanguage]);

  useEffect(() => {
    if (activeTab !== 'hierarchy' || hierarchyViewportSize.width <= 0 || hierarchyViewportSize.height <= 0 || hierarchyFlow.nodes.length === 0) return;
    const rafId = requestAnimationFrame(() => {
      hierarchyFlowInstanceRef.current?.fitView({ padding: 0.22 });
    });
    return () => cancelAnimationFrame(rafId);
  }, [activeTab, hierarchyFlow.nodes.length, hierarchyViewportSize.height, hierarchyViewportSize.width]);

  if (loading && !concept) {
    return (
        <div className="graph-page w-full min-h-[calc(100vh-3rem)] bg-background flex items-center justify-center">
          <Skeleton className="h-12 w-64 bg-[var(--surface-muted)]" />
        </div>
    );
  }

  if (error || !concept) {
    return <p className="p-8 text-destructive">Error loading concept layout setup.</p>;
  }

  return (
      <>
        <SEO title={seoTitle} description={seoDescription} keywords={seoKeywords} canonicalUrl={canonicalUrl} />
        <div className="graph-page w-full min-h-[calc(100vh-3rem)] bg-linear-to-b from-[var(--surface)] to-[var(--surface-muted)]">
           <section className="graph-shell mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="graph-tabs w-full flex flex-col gap-4">
              <div className="graph-toolbar flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-[var(--surface)] border border-[var(--line)] shadow-sm p-6 rounded-sm">
                <div className="graph-title-block flex flex-col gap-2">
                  <Badge variant="secondary" className="w-fit bg-[var(--tint-navy)] text-[var(--brand-navy)] font-bold tracking-wide uppercase text-[10px] px-2 py-0.5 rounded-sm border border-[var(--brand-navy)]/15">{t('selectedTerm', 'Selected term')}</Badge>
                  <h2 className="graph-title text-3xl font-bold tracking-tight text-[var(--ink-strong)] font-heading">{translatedTitle}</h2>
                  <p className="graph-subtitle text-sm text-[var(--ink-muted)] font-mono bg-[var(--surface-muted)] border border-[var(--line)] px-2 py-1 rounded w-fit">{concept.uri}</p>
                </div>

                <TabsList className="graph-tabs-list bg-[var(--surface-muted)] border border-[var(--line)] p-1 rounded-sm inline-flex h-12 items-center justify-center">
                  <TabsTrigger value="graph" className="rounded-sm px-6 py-2.5 text-sm font-semibold transition-all text-[var(--ink-muted)] hover:text-[var(--ink)] data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--brand-navy)] data-[state=active]:shadow-sm">{t('tabGraph', 'Graph View')}</TabsTrigger>
                  <TabsTrigger value="hierarchy" className="rounded-sm px-6 py-2.5 text-sm font-semibold transition-all text-[var(--ink-muted)] hover:text-[var(--ink)] data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--brand-navy)] data-[state=active]:shadow-sm">{t('tabHierarchy', 'Hierarchy')}</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="graph" className="graph-tab-content m-0 focus-visible:outline-none focus-visible:ring-0">
                <Card className="graph-card rounded-sm shadow-sm border-[var(--line)] overflow-hidden bg-[var(--surface)]">
                   <CardContent className="graph-card-content p-0 m-0 w-full h-[calc(100vh-200px)] relative">
                    <div className="graph-stage w-full h-full flex flex-row">
                      <DefinitionOverlay concept={concept} relatedCount={relatedCount} translatedTitle={translatedTitle} broaderCount={broaderCount} narrowerCount={narrowerCount} lang={searchLanguage} t={t} />

                      <div ref={setGraphViewportElement} className="graph-viewport w-full h-full bg-[var(--surface)] relative flex-1 cursor-grab active:cursor-grabbing">
                        {viewportSize.width > 0 && viewportSize.height > 0 ? (
                            <ForceGraph2D
                                ref={fgRef}
                                graphData={graphData}
                                width={viewportSize.width}
                                height={viewportSize.height}
                                backgroundColor={P.bg}
                                warmupTicks={40}
                                cooldownTicks={120}

                                // 1. CANVAS OBJECT RENDERING WITH TINT EFFECT
                                nodeCanvasObject={(node: NodeObject<GraphNode>, ctx) => {
                                  const isCenter = node.uri === concept.uri;
                                  const isCluster = !!node.isCluster;
                                  const isHovered = node.uri === hoverNode || node.id === hoverNode;
                                  // Check if this exact button target area is currently hovered
                                  const isButtonHovered = hoveringButtonOfNode === node.id || hoveringButtonOfNode === node.uri;

                                  const x = node.x ?? 0;
                                  const y = node.y ?? 0;

                                  // Typography
                                  const fontSize = isCenter ? 12 : 10;
                                  ctx.font = `${(isCenter || isHovered) ? 'bold ' : '500 '}${fontSize}px Inter, sans-serif`;
                                  const textWidth = ctx.measureText(node.name).width;

                                  // Pill dimensions
                                  const padX = 14;
                                  const padY = 8;
                                  const w = textWidth + padX * 2;
                                  const h = fontSize + padY * 2;
                                  const radius = h / 2;

                                  node._width = w;
                                  node._height = h;

                                  ctx.save();

                                  // Dim un-focused paths
                                  if (hoverNode && node.uri !== hoverNode && node.id !== hoverNode) {
                                    const related = graphData.links.some(l => {
                                      const s = getNodeId(l.source);
                                      const t = getNodeId(l.target);
                                      return (s === hoverNode && t === node.id) || (t === hoverNode && s === node.id);
                                    });
                                    if (!related && node.uri !== concept.uri) ctx.globalAlpha = 0.3;
                                  }

                                  // Dynamic box shadows
                                  if (isHovered || isCenter) {
                                    ctx.shadowColor = isCenter ? P.shadowCenter : P.shadowNode;
                                    ctx.shadowBlur = 12;
                                  }

                                  // Primary Theme Colors
                                  ctx.fillStyle = isCenter
                                      ? P.teal
                                      : isCluster
                                          ? P.clusterBg
                                          : isHovered
                                              ? P.navyHover
                                              : P.navy;

                                  // Draw node text body capsule
                                  ctx.beginPath();
                                  if (ctx.roundRect) {
                                    ctx.roundRect(x - w / 2, y - h / 2, w, h, radius);
                                  } else {
                                    ctx.rect(x - w / 2, y - h / 2, w, h);
                                  }
                                  ctx.fill();

                                  ctx.shadowColor = 'transparent';
                                  ctx.shadowBlur = 0;
                                  ctx.lineWidth = isCenter || isHovered ? 1.75 : 1;
                                  ctx.strokeStyle = isCluster
                                      ? P.clusterStroke
                                      : isCenter
                                          ? P.centerStroke
                                          : P.nodeStroke;
                                  ctx.stroke();

                                  // Label text
                                  ctx.fillStyle = isCluster ? P.clusterText : P.nodeText;
                                  ctx.textAlign = 'center';
                                  ctx.textBaseline = 'middle';
                                  ctx.fillText(node.name, isCluster ? x + 12 : x, y);

                                  // Plus / Minus Button Settings
                                  const btnRadius = 9;
                                  if (isCluster) {
                                    const btnX = x - w / 2 + 16;
                                    ctx.beginPath();
                                    ctx.arc(btnX, y, btnRadius, 0, 2 * Math.PI);

                                    // Visual tint feedback effect if hovering just over this specific button circle
                                    ctx.fillStyle = isButtonHovered ? P.clusterBtnHover : P.btnFill;
                                    ctx.fill();
                                    ctx.strokeStyle = isButtonHovered ? P.teal : P.navy;
                                    ctx.lineWidth = 1.5;
                                    ctx.stroke();

                                    // Minus glyph (collapse)
                                    ctx.beginPath();
                                    ctx.moveTo(btnX - 3.5, y);
                                    ctx.lineTo(btnX + 3.5, y);
                                    ctx.strokeStyle = P.navy;
                                    ctx.lineWidth = 1.5;
                                    ctx.stroke();

                                    (node as unknown as HitboxHolder)._plusHitbox = { x: btnX, y, r: btnRadius, isCluster: true };
                                  } else {
                                    const flipLeft = x < 0;
                                    const btnX = flipLeft ? (x - w / 2 - 6) : (x + w / 2 + 6);

                                    ctx.beginPath();
                                    ctx.arc(btnX, y, btnRadius, 0, 2 * Math.PI);

                                    // Visual tint feedback effect if hovering just over this specific button circle
                                    ctx.fillStyle = isButtonHovered ? P.nodeBtnHover : P.btnFill;
                                    ctx.fill();
                                    ctx.strokeStyle = isButtonHovered ? P.teal : (isCenter ? P.teal : P.navy);
                                    ctx.lineWidth = 1.5;
                                    ctx.stroke();

                                    // Horizontal stroke of the +/- glyph
                                    ctx.beginPath();
                                    ctx.moveTo(btnX - 3.5, y);
                                    ctx.lineTo(btnX + 3.5, y);
                                    ctx.strokeStyle = P.navy;
                                    ctx.lineWidth = 1.5;
                                    ctx.stroke();

                                    if (!node.isExpanded && !isCenter) {
                                      ctx.beginPath();
                                      ctx.moveTo(btnX, y - 3.5);
                                      ctx.lineTo(btnX, y + 3.5);
                                      ctx.stroke();
                                    }

                                    (node as unknown as HitboxHolder)._plusHitbox = { x: btnX, y, r: btnRadius, isCenter, isCluster: false };
                                  }

                                  ctx.restore();
                                }}

                                // 2. UPDATED CLICK LOGIC: BOTH CAPSULE & BUTTON INVOKE NEIGHBORS CODE NOW
                                onNodeClick={(node: GraphNode, event: MouseEvent) => {
                                  if (node.isCluster) {
                                    const hitbox = (node as unknown as HitboxHolder)._plusHitbox;
                                    if (hitbox && fgRef.current) {
                                      const graphCoords = fgRef.current.screen2GraphCoords(event.clientX, event.clientY);
                                      const distance = Math.hypot(graphCoords.x - hitbox.x, graphCoords.y - hitbox.y);

                                      if (distance <= (hitbox.r + 5)) {
                                        // Deconstruct parent context from the dynamic cluster id: cluster:{kind}:{parentUri}
                                        const parts = node.id.split(':');
                                        if (parts.length >= 3) {
                                          const parentUri = parts.slice(2).join(':');

                                          setNeighborhoodCache((prev) => {
                                            const updated = new Map(prev);
                                            // If collapsing a primary root category, clean matching items
                                            if (parentUri === concept.uri) {
                                              const itemsToRemove = node.clusterKind === 'broader' ? concept.broader
                                                  : node.clusterKind === 'narrower' ? concept.narrower
                                                      : concept.related;
                                              itemsToRemove?.forEach(item => updated.delete(item.uri));
                                            } else {
                                              // Collapsing an inner nested tree element
                                              updated.delete(parentUri);
                                            }
                                            return updated;
                                          });
                                        }
                                      }
                                    }
                                    return;
                                  }

                                  // CHANGED EFFECT HERE: Primary node clicks and button clicks now invoke neighborhood code
                                  if (node.uri === concept.uri) return; // Core center focus node doesn't change

                                  if (node.isExpanded) {
                                    // Collapse node path out of the neighborhood view state cache
                                    setNeighborhoodCache((prev) => {
                                      const updated = new Map(prev);
                                      updated.delete(node.uri);
                                      return updated;
                                    });
                                  } else {
                                    // Request / Expand neighbors code hook
                                    setTargetNeighborhoodUri(node.uri);
                                  }
                                }}

                                // 3. Footprint mapping matching the oversized boundary boxes
                                nodePointerAreaPaint={(node: NodeObject<GraphNode>, color: string, ctx: CanvasRenderingContext2D) => {
                                  const x = node.x ?? 0;
                                  const y = node.y ?? 0;
                                  const w = node._width || 80;
                                  const h = node._height || 26;
                                  const radius = h / 2;

                                  ctx.fillStyle = color;

                                  ctx.beginPath();
                                  if (ctx.roundRect) {
                                    ctx.roundRect(x - w / 2, y - h / 2, w, h, radius);
                                  } else {
                                    ctx.rect(x - w / 2, y - h / 2, w, h);
                                  }
                                  ctx.fill();

                                    const hitbox = (node as unknown as HitboxHolder)._plusHitbox;
                                  if (hitbox) {
                                    ctx.beginPath();
                                    ctx.arc(hitbox.x, hitbox.y, 16, 0, 2 * Math.PI);
                                    ctx.fill();
                                  }
                                }}

                                // 4. CAPTURING DYNAMIC BUTTON POSITIONING FOR EXCLUSIVE HOVER TINTRULE HOOKS
                                onNodeHover={(node: NodeObject<GraphNode> | null) => {
                                  setHoverNode(node ? node.id : null);

                                   if (!node || !(node as unknown as HitboxHolder)._plusHitbox) {
                                    setHoveringButtonOfNode(null);
                                    return;
                                  }

                                  // Attach a temporary listener over the viewport wrapper to query relative canvas mouse locations
                                  const wrapper = graphViewportElement;
                                  if (wrapper && fgRef.current) {
                                    const handleMouseMove = (e: MouseEvent) => {
                                      //const rect = wrapper.getBoundingClientRect();
                                      const graphCoords = fgRef.current!.screen2GraphCoords(e.clientX, e.clientY);
                                      const hitbox = (node as unknown as HitboxHolder)._plusHitbox;

                                      if (hitbox) {
                                        const distance = Math.hypot(graphCoords.x - hitbox.x, graphCoords.y - hitbox.y);
                                        // Mark button as explicitly focused if cursor sits within the 16px footprint
                                        if (distance <= 16) {
                                          setHoveringButtonOfNode(node.id || node.uri);
                                          return;
                                        }
                                      }
                                      setHoveringButtonOfNode(null);
                                    };

                                    wrapper.addEventListener('mousemove', handleMouseMove, { once: true });
                                  }
                                }}

                                // Connection link customization paths
                                linkWidth={(link) => {
                                  const s = getNodeId(link.source);
                                  const t = getNodeId(link.target);
                                  return (s === hoverNode || t === hoverNode) ? 2.5 : 1.2;
                                }}
                                linkColor={(link) => {
                                  const s = getNodeId(link.source);
                                  const t = getNodeId(link.target);
                                  if (hoverNode) {
                                    if (s === hoverNode || t === hoverNode) return P.teal;
                                    return P.linkDim;
                                  }
                                  return P.link;
                                }}
                                linkDirectionalArrowLength={4}
                                linkDirectionalArrowColor={() => P.arrow}
                                linkDirectionalArrowRelPos={1}
                            />
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="hierarchy" className="graph-tab-content m-0 focus-visible:outline-none focus-visible:ring-0">
                <Card className="graph-card graph-card--hierarchy rounded-sm shadow-sm border-[var(--line)] overflow-hidden bg-[var(--surface)]">
                  <CardHeader className="graph-card-header bg-[var(--surface-subtle)] border-b border-[var(--line)] p-6">
                    <div className="graph-card-heading flex flex-col gap-2">
                      <CardTitle className="text-xl font-bold text-[var(--ink-strong)] font-heading">{t('hierarchyLayoutTitle', 'Concept Hierarchy')}</CardTitle>
                      <CardDescription className="text-[var(--ink-muted)] text-sm">{t('hierarchyLayoutDesc', 'Browse concept layout hierarchies.')}</CardDescription>
                    </div>
                  </CardHeader>
                   <CardContent className="graph-hierarchy-content p-0 h-[calc(100vh-200px)] relative bg-linear-to-br from-[var(--surface)] via-[var(--surface-subtle)] to-[var(--tint-navy)]">
                    <div className="hierarchy-flow-shell w-full h-full flex flex-col">
                      <div className="hierarchy-flow-legend absolute top-4 left-4 z-10 flex gap-2">
                        {(['broader', 'related', 'narrower'] as const).map((kind) => (
                            <button
                                key={kind}
                                type="button"
                                className={`px-4 py-2 text-sm font-semibold rounded-sm border shadow-sm transition-all ${expandedGroups[kind] ? 'bg-[var(--tint-navy)] text-[var(--brand-navy)] border-[var(--brand-navy)]/30' : 'bg-[var(--surface)] text-[var(--ink-muted)] border-[var(--line)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]'}`}
                                onClick={() => toggleHierarchyGroup(kind)}
                            >
                              {kind === 'related' ? t('sharedRelated', 'Shared / Related') : t(`legend${kind}`, kind[0].toUpperCase() + kind.slice(1))}
                            </button>
                        ))}
                      </div>

                      <div ref={setHierarchyViewportElement} className="hierarchy-flow flex-1 w-full h-full">
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
                                  try { instance.fitView({ padding: 0.18 }); } catch { void 0; }
                                }}
                                minZoom={0.45}
                                maxZoom={1.3}
                                panOnDrag
                                zoomOnScroll={false}
                                zoomOnPinch
                                nodesDraggable={true}
                                nodesConnectable={false}
                                elementsSelectable={false}
                                defaultEdgeOptions={{
                                  type: 'smoothstep',
                                  style: { stroke: P.arrow, strokeWidth: 2, opacity: 0.8 },
                                }}
                                proOptions={{ hideAttribution: true }}
                            />
                        ) : (
                            <div className="hierarchy-empty-state w-full h-full flex items-center justify-center text-[var(--ink-faint)]">Preparing view...</div>
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
