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
import { Card, CardContent } from '@/components/ui/card.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { Footer } from '@/components/layout/Footer.tsx';
import { SEO } from '@/components/layout/SEO.tsx';
import { stripLanguageTag } from '@/lib/utils.ts';
import { useConceptDefinition } from '@/hooks/useConceptDefinition.ts';
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



// ─── COBISS canvas palette ──────────────────────────────────────────────────
const CANVAS_BG = '#ffffff';
const C_NAVY = '#004b87';
const C_NAVY_HOVER = '#0070c0';
const C_TEAL = '#00a99d';
const C_CLUSTER_BG = '#eef3f8';
const C_CLUSTER_TEXT = '#1f3a52';
const C_NODE_TEXT = '#ffffff';

const EMPTY_CONCEPT_NODES: ConceptNode[] = [];

function getConceptLabel(item: ConceptNode, lang: string) {
  if (lang === 'sl') {
    return stripLanguageTag(item.prefLabelSl ?? item.prefLabelEn ?? item.prefLabel) || item.uri;
  }
  return stripLanguageTag(item.prefLabelEn ?? item.prefLabelSl ?? item.prefLabel) || item.uri;
}

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
  const { t } = useTranslation(); // <-- Add this hook

  const label = stripLanguageTag(data.label);

  // Use t() for accessibility labels
  const relationLabel =
      data.kind === 'root'
          ? t('openSelectedTerm', 'Open selected term')
          : data.kind === 'broader'
              ? t('openBroaderTerm', 'Open broader term')
              : data.kind === 'narrower'
                  ? t('openNarrowerTerm', 'Open narrower term')
                  : t('openRelatedTerm', 'Open related term');

  const relationChips = data.kind === 'root' ? [] : data.relations.map((relation) => relation);
  const ariaLabel = `${relationLabel} ${label}`;

  return (
      <div className={`hierarchy-flow-node hierarchy-flow-node--${data.kind}`}>
        {data.kind === 'root' ? null : (
            <Handle type="target" position={Position.Left} className="hierarchy-flow-handle hierarchy-flow-handle--target" />
        )}

        <button
            type="button"
            className={`hierarchy-flow-node-card hierarchy-flow-node-card--${data.kind} nodrag nopan shadow-sm hover:shadow-md transition-shadow rounded-sm border border-[#e4ebf2] bg-white text-card-foreground group flex items-start gap-3 p-4`}
            onClick={() => data.onClick(data.uri)}
            onMouseDown={(e) => e.stopPropagation()}
            title={data.uri}
            aria-label={ariaLabel}
        >
        <span className="hierarchy-flow-node-icon bg-[#eaf1f8] border border-[#004b87]/15 text-[#004b87] rounded-sm w-8 h-8 flex items-center justify-center shrink-0 group-hover:border-[#00a99d]/30 group-hover:bg-[#e3f5f3] transition-colors" aria-hidden="true">
          {data.kind === 'root' ? '🎯' : data.kind === 'broader' ? '⬆️' : data.kind === 'narrower' ? '⬇️' : '↔️'}
        </span>
          <span className="hierarchy-flow-node-copy text-left flex flex-col pt-1">
          <span className="hierarchy-flow-node-title font-semibold text-[15px] text-[#14283b] group-hover:text-[#004b87] transition-colors">{label}</span>
            {relationChips.length > 0 ? (
                <span className="hierarchy-flow-node-relations mt-2 flex flex-wrap gap-1" aria-hidden="true">
              {relationChips.map((relation) => (
                  <span key={relation} className={`hierarchy-flow-node-relation hierarchy-flow-node-relation--${relation} text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-sm bg-[#eaf1f8] text-[#004b87] border border-[#004b87]/15`}>
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
  hiddenCategories: Set<'broader' | 'narrower' | 'related'>;
  toggleCategory: (category: 'broader' | 'narrower' | 'related') => void;
}



function DefinitionOverlay({ concept, translatedTitle, relatedCount, broaderCount, narrowerCount, lang, hiddenCategories, toggleCategory, t }: DefinitionOverlayProps) {
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
              className="inline-flex items-center gap-1 text-[9px] uppercase font-bold tracking-wider text-[#008c82] mt-1"
              title={defState.source === 'translated' ? 'Translated by AI' : 'Generated by AI'}
              aria-label={defState.source === 'translated' ? 'AI translated definition' : 'AI generated definition'}
          >
        <span aria-hidden="true">✦</span>
            {defState.source === 'translated' ? t('aiTranslated', 'AI translated') : t('aiGenerated', 'AI generated')}
      </span>
      ) : null;

  // Create a helper for the buttons
  const CategoryButton = ({ kind, count, label }: { kind: 'broader' | 'narrower' | 'related', count: number, label: string }) => {
    const isHidden = hiddenCategories.has(kind);
    return (
        <button
            onClick={() => toggleCategory(kind)}
            className={`graph-metric flex flex-col p-2 rounded-sm flex-1 text-center transition-all border
          ${isHidden ? 'bg-gray-50 opacity-50 grayscale border-transparent' : 'bg-[#f3f6fa] border-[#e4ebf2] cursor-pointer hover:border-[#004b87]'}`}
        >
          <span className="text-[10px] uppercase font-bold text-[#7c8ba0]">{label}</span>
          <strong className="text-lg text-[#004b87]">{count}</strong>
        </button>
    );
  };

  return (
      // Line 460 — change pointer-events-none → pointer-events-auto
      <div className="graph-overlay absolute top-4 left-4 z-10 w-72 bg-white/95 backdrop-blur-sm border border-[#dce4ec] shadow-lg shadow-[#004b87]/5 p-5 rounded-sm flex flex-col gap-3 pointer-events-auto">
        <h3 className="text-lg font-bold leading-tight text-[#14283b] font-heading pointer-events-none">{translatedTitle}</h3>

        <div className="graph-overlay-definition text-sm text-[#586a7b] leading-relaxed pointer-events-none">
          {defState.status === 'loading' ? (
              <div className="flex flex-col gap-1.5" aria-label={t('loadingDefinition', 'Loading definition…')}>
                <Skeleton className="h-3 w-full rounded bg-[#eef2f6]" />
                <Skeleton className="h-3 w-5/6 rounded bg-[#eef2f6]" />
                <Skeleton className="h-3 w-4/6 rounded bg-[#eef2f6]" />
              </div>
          ) : definitionText ? (
              <>
                <p className="line-clamp-4">{definitionText}</p>
                {aiBadge}
              </>
          ) : null}
        </div>

        <Separator className="graph-overlay-separator my-2 pointer-events-none" />

        <div className="graph-metrics flex justify-between gap-2" aria-label="Concept relation summary">
          <CategoryButton kind="broader" count={broaderCount} label={t('broader', 'Broader')} />
          <CategoryButton kind="narrower" count={narrowerCount} label={t('narrower', 'Narrower')} />
          <CategoryButton kind="related" count={relatedCount} label={t('related', 'Related')} />
          <div className="graph-metric flex flex-col bg-[#eaf1f8] border border-[#004b87]/15 p-2 rounded-sm flex-1 text-center">
            <span className="text-[10px] uppercase font-bold text-[#7c8ba0]">{t('totalLinks', 'Total Links')}</span>
            <strong className="text-lg text-[#008c82]">{broaderCount + relatedCount + narrowerCount}</strong>
          </div>
        </div>
      </div>
  );
}

function GraphPage() {
  const { t, i18n } = useTranslation();
  const selectedLanguage = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const searchLanguage = selectedLanguage.toLowerCase().startsWith('sl') ? 'sl' : 'en';
  const [hoveringButtonOfNode, setHoveringButtonOfNode] = useState<string | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<Set<'broader' | 'narrower' | 'related'>>(new Set());

  // ─── SELECTION POPOVER TRACKING STATE ──────────────────────────────────────
  const [popoverNode, setPopoverNode] = useState<GraphNode | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);

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

  const toggleCategory = (category: 'broader' | 'narrower' | 'related') => {
    setHiddenCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const [targetNeighborhoodUri, setTargetNeighborhoodUri] = useState<string>('');
  const [neighborhoodCache, setNeighborhoodCache] = useState<Map<string, { nodes: ConceptNode[]; edges: ConceptEdge[] }>>(new Map());

  const decodedUri = useMemo(() => decodeURIComponent(uri || ''), [uri]);

  const { loading, error, data } = useQuery<GetConceptResponse>(GET_CONCEPT, {
    variables: { uri: decodedUri },
  });

  const { data: neighborhoodData } = useQuery<NeighborhoodResponse>(GET_NEIGHBORHOOD, {
    variables: { uri: targetNeighborhoodUri },
    skip: !targetNeighborhoodUri,
  });

  useEffect(() => {
    if (neighborhoodData?.conceptNeighborhood && neighborhoodData?.conceptNeighborhoodEdges && targetNeighborhoodUri) {
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

  useEffect(() => {
    setTimeout(() => setNeighborhoodCache(new Map()), 0);
  }, [decodedUri]);

  // Clean popovers safely whenever views shift
  useEffect(() => {
    setPopoverNode(null);
    setPopoverPos(null);
  }, [decodedUri, searchParams]);

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

  const graphData = useMemo<GraphData>(() => {
    if (!data?.concept) return { nodes: [], links: [] };

    const concept = data.concept;
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

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

    getOrAddConceptNode(concept, true);

    const getClusterLabel = (kind: 'broader' | 'narrower' | 'related') => {
      return kind === 'broader'
          ? ` ${t('clusterBroader', 'Broader')}`
          : kind === 'narrower'
              ? ` ${t('clusterNarrower', 'Narrower')}`
              : ` ${t('clusterRelated', 'Related')}`;
    };



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

    const rootGroups = [
      { kind: 'broader' as const, items: concept.broader },
      { kind: 'narrower' as const, items: concept.narrower },
      { kind: 'related' as const, items: concept.related },
    ];

    rootGroups.forEach((group) => {
      // If this category is in hiddenCategories, skip it entirely
      if (hiddenCategories.has(group.kind)) return;

      if (!group.items || group.items.length === 0) return;
      const clusterId = addCategoryCluster(concept.uri, group.kind);
      group.items.forEach((item) => {
        getOrAddConceptNode(item);
        links.push({ source: clusterId, target: item.uri });
      });
    });

    neighborhoodCache.forEach((cacheValue, originUri) => {
      const { nodes: neighborNodes, edges: neighborEdges } = cacheValue;

      const neighborMap = new Map(neighborNodes.map(n => [n.uri, n]));

      const sortedByKind: Record<'broader' | 'narrower' | 'related', string[]> = {
        broader: [],
        narrower: [],
        related: []
      };

      neighborEdges.forEach((edge) => {
        if (edge.sourceUri === originUri) {
          const kind = edge.relationType.toLowerCase();
          if (kind === 'broader' || kind === 'narrower' || kind === 'related') {
            sortedByKind[kind].push(edge.targetUri);
          }
        }
      });

      (['broader', 'narrower', 'related'] as const).forEach((kind) => {
        const targetUris = sortedByKind[kind];
        if (targetUris.length === 0) return;

        const clusterId = addCategoryCluster(originUri, kind);

        targetUris.forEach((targetUri) => {
          const rawItem = neighborMap.get(targetUri);
          if (rawItem) {
            getOrAddConceptNode(rawItem);
            links.push({ source: clusterId, target: targetUri });
          }
        });
      });
    });

    return { nodes, links };
  }, [data, hiddenCategories, searchLanguage, neighborhoodCache]);

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
          <Skeleton className="h-12 w-64 bg-[#eef2f6]" />
        </div>
    );
  }

  if (error || !concept) {
    return <p className="p-8 text-destructive">Error loading concept layout setup.</p>;
  }

  return (
      <>
        <SEO title={seoTitle} description={seoDescription} keywords={seoKeywords} canonicalUrl={canonicalUrl} />
        <div className="graph-page w-full min-h-[calc(100vh-3rem)] bg-linear-to-b from-white to-[#f3f6fa]">
          <section className="graph-shell mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="graph-tabs w-full flex flex-col gap-4">
              <div className="graph-toolbar flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white border border-[#e4ebf2] shadow-sm p-6 rounded-sm">
                <div className="graph-title-block flex flex-col gap-2">
                  <Badge variant="secondary" className="w-fit bg-[#eaf1f8] text-[#004b87] font-bold tracking-wide uppercase text-[10px] px-2 py-0.5 rounded-sm border border-[#004b87]/15">{t('selectedTerm', 'Selected term')}</Badge>
                  <h2 className="graph-title text-3xl font-bold tracking-tight text-[#0d2436] font-heading">{translatedTitle}</h2>
                  <p className="graph-subtitle text-sm text-[#586a7b] font-mono bg-[#f3f6fa] border border-[#e4ebf2] px-2 py-1 rounded w-fit">{concept.uri}</p>
                </div>

                <TabsList className="graph-tabs-list bg-[#f3f6fa] border border-[#e4ebf2] p-1 rounded-sm inline-flex h-12 items-center justify-center">
                  <TabsTrigger value="graph" className="rounded-sm px-6 py-2.5 text-sm font-semibold transition-all text-[#586a7b] hover:text-[#14283b] data-[state=active]:bg-white data-[state=active]:text-[#004b87] data-[state=active]:shadow-sm">{t('tabGraph', 'Graph View')}</TabsTrigger>
                  <TabsTrigger value="hierarchy" className="rounded-sm px-6 py-2.5 text-sm font-semibold transition-all text-[#586a7b] hover:text-[#14283b] data-[state=active]:bg-white data-[state=active]:text-[#004b87] data-[state=active]:shadow-sm">{t('tabHierarchy', 'Hierarchy')}</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="graph" className="graph-tab-content m-0 focus-visible:outline-none focus-visible:ring-0">
                <Card className="graph-card rounded-sm shadow-sm border-[#e4ebf2] overflow-hidden bg-white">
                  <CardContent className="graph-card-content p-0 m-0 w-full h-[calc(100vh-200px)] relative">
                    <div className="graph-stage w-full h-full flex flex-row">
                      <DefinitionOverlay
                          concept={concept}
                          relatedCount={relatedCount}
                          translatedTitle={translatedTitle}
                          broaderCount={broaderCount}
                          narrowerCount={narrowerCount}
                          lang={searchLanguage}
                          t={t}
                          hiddenCategories={hiddenCategories}
                          toggleCategory={toggleCategory}
                      />

                      <div ref={setGraphViewportElement} className="graph-viewport w-full h-full bg-white relative flex-1 cursor-grab active:cursor-grabbing">
                        {viewportSize.width > 0 && viewportSize.height > 0 ? (
                            <ForceGraph2D
                                ref={fgRef}
                                graphData={graphData}
                                width={viewportSize.width}
                                height={viewportSize.height}
                                backgroundColor={CANVAS_BG}
                                warmupTicks={40}
                                cooldownTicks={120}

                                nodeCanvasObject={(node: NodeObject<GraphNode>, ctx) => {
                                  const isCenter = node.uri === concept.uri;
                                  const isCluster = !!node.isCluster;
                                  const isHovered = node.uri === hoverNode || node.id === hoverNode;
                                  const isButtonHovered = hoveringButtonOfNode === node.id || hoveringButtonOfNode === node.uri;

                                  const x = node.x ?? 0;
                                  const y = node.y ?? 0;

                                  const fontSize = isCenter ? 12 : 10;
                                  ctx.font = `${(isCenter || isHovered) ? 'bold ' : '500 '}${fontSize}px Inter, sans-serif`;
                                  const textWidth = ctx.measureText(node.name).width;

                                  const padX = 14;
                                  const padY = 8;
                                  const w = textWidth + padX * 2;
                                  const h = fontSize + padY * 2;
                                  const radius = h / 2;

                                  node._width = w;
                                  node._height = h;

                                  ctx.save();

                                  if (hoverNode && node.uri !== hoverNode && node.id !== hoverNode) {
                                    const related = graphData.links.some(l => {
                                      const s = getNodeId(l.source);
                                      const t = getNodeId(l.target);
                                      return (s === hoverNode && t === node.id) || (t === hoverNode && s === node.id);
                                    });
                                    if (!related && node.uri !== concept.uri) ctx.globalAlpha = 0.3;
                                  }

                                  if (isHovered || isCenter) {
                                    ctx.shadowColor = isCenter ? 'rgba(0, 169, 157, 0.35)' : 'rgba(0, 75, 135, 0.25)';
                                    ctx.shadowBlur = 12;
                                  }

                                  ctx.fillStyle = isCenter
                                      ? C_TEAL
                                      : isCluster
                                          ? C_CLUSTER_BG
                                          : isHovered
                                              ? C_NAVY_HOVER
                                              : C_NAVY;

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
                                      ? 'rgba(0, 75, 135, 0.22)'
                                      : isCenter
                                          ? '#ffffff'
                                          : 'rgba(255, 255, 255, 0.85)';
                                  ctx.stroke();

                                  ctx.fillStyle = isCluster ? C_CLUSTER_TEXT : C_NODE_TEXT;
                                  ctx.textAlign = 'center';
                                  ctx.textBaseline = 'middle';
                                  ctx.fillText(node.name, isCluster ? x + 12 : x, y);

                                  const btnRadius = 9;
                                  if (isCluster) {
                                    const btnX = x - w / 2 + 16;
                                    ctx.beginPath();
                                    ctx.arc(btnX, y, btnRadius, 0, 2 * Math.PI);

                                    ctx.fillStyle = isButtonHovered ? '#d6e3f0' : '#ffffff';
                                    ctx.fill();
                                    ctx.strokeStyle = isButtonHovered ? C_TEAL : C_NAVY;
                                    ctx.lineWidth = 1.5;
                                    ctx.stroke();

                                    ctx.beginPath();
                                    ctx.moveTo(btnX - 3.5, y);
                                    ctx.lineTo(btnX + 3.5, y);
                                    ctx.strokeStyle = C_NAVY;
                                    ctx.lineWidth = 1.5;
                                    ctx.stroke();

                                    (node as unknown as HitboxHolder)._plusHitbox = { x: btnX, y, r: btnRadius, isCluster: true };
                                  } else {
                                    const flipLeft = x < 0;
                                    const btnX = flipLeft ? (x - w / 2 - 6) : (x + w / 2 + 6);

                                    ctx.beginPath();
                                    ctx.arc(btnX, y, btnRadius, 0, 2 * Math.PI);

                                    ctx.fillStyle = isButtonHovered ? 'rgba(0, 169, 157, 0.16)' : '#ffffff';
                                    ctx.fill();
                                    ctx.strokeStyle = isButtonHovered ? C_TEAL : (isCenter ? C_TEAL : C_NAVY);
                                    ctx.lineWidth = 1.5;
                                    ctx.stroke();

                                    ctx.beginPath();
                                    ctx.moveTo(btnX - 3.5, y);
                                    ctx.lineTo(btnX + 3.5, y);
                                    ctx.strokeStyle = C_NAVY;
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

                                // ─── UPDATED INTERACTIVE SELECTION POPOVER TRIGGER CODE ──────────────────
                                onNodeClick={(node: GraphNode, event: MouseEvent) => {
                                  if (node.isCluster) {
                                    const hitbox = (node as unknown as HitboxHolder)._plusHitbox;
                                    if (hitbox && fgRef.current) {
                                      const graphCoords = fgRef.current.screen2GraphCoords(event.clientX, event.clientY);
                                      const distance = Math.hypot(graphCoords.x - hitbox.x, graphCoords.y - hitbox.y);

                                      if (distance <= (hitbox.r + 5)) {
                                        const parts = node.id.split(':');
                                        if (parts.length >= 3) {
                                          const parentUri = parts.slice(2).join(':');

                                          setNeighborhoodCache((prev) => {
                                            const updated = new Map(prev);
                                            if (parentUri === concept.uri) {
                                              const itemsToRemove = node.clusterKind === 'broader' ? concept.broader
                                                  : node.clusterKind === 'narrower' ? concept.narrower
                                                      : concept.related;
                                              itemsToRemove?.forEach(item => updated.delete(item.uri));
                                            } else {
                                              updated.delete(parentUri);
                                            }
                                            return updated;
                                          });
                                        }
                                      }
                                    }
                                    return;
                                  }

                                  // Ignore clicks on the core center node (we are already on its page)
                                  if (node.uri === concept.uri) return;

                                  // Convert graph vector metrics to layout viewport pixels dynamically
                                  if (fgRef.current && node.x !== undefined && node.y !== undefined) {
                                    // graph2ScreenCoords returns pixels RELATIVE to the canvas container natively
                                    const screenCoords = fgRef.current.graph2ScreenCoords(node.x, node.y);

                                    // Directly assign the coordinates without subtracting the window bounds
                                    setPopoverPos({
                                      x: screenCoords.x,
                                      y: screenCoords.y
                                    });

                                    setPopoverNode(node);
                                  }
                                }}

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

                                onNodeHover={(node: NodeObject<GraphNode> | null) => {
                                  // 1. Defer hover state out of the render loop
                                  setTimeout(() => {
                                    setHoverNode(node ? node.id : null);
                                  }, 0);

                                  if (!node || !(node as unknown as HitboxHolder)._plusHitbox) {
                                    setTimeout(() => {
                                      setHoveringButtonOfNode(null);
                                    }, 0);
                                    return;
                                  }

                                  const wrapper = graphViewportElement;
                                  if (wrapper && fgRef.current) {
                                    const handleMouseMove = (e: MouseEvent) => {
                                      const graphCoords = fgRef.current!.screen2GraphCoords(e.clientX, e.clientY);
                                      const hitbox = (node as unknown as HitboxHolder)._plusHitbox;

                                      if (hitbox) {
                                        const distance = Math.hypot(graphCoords.x - hitbox.x, graphCoords.y - hitbox.y);
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

                                // ─── CLEAR FLOATING POPOVER ON CANVAS VIEWPORT MANIPULATIONS ──────────────
                                onBackgroundClick={() => {
                                  setPopoverNode(null);
                                  setPopoverPos(null);
                                }}
                                onZoom={() => {
                                  if (popoverNode) {
                                    setTimeout(() => {
                                      setPopoverNode(null);
                                      setPopoverPos(null);
                                    }, 0);
                                  }
                                }}

                                onNodeDrag={() => {
                                  if (popoverNode) {
                                    setTimeout(() => {
                                      setPopoverNode(null);
                                      setPopoverPos(null);
                                    }, 0);
                                  }
                                }}

                                linkWidth={(link) => {
                                  const s = getNodeId(link.source);
                                  const t = getNodeId(link.target);
                                  return (s === hoverNode || t === hoverNode) ? 2.5 : 1.2;
                                }}
                                linkColor={(link) => {
                                  const s = getNodeId(link.source);
                                  const t = getNodeId(link.target);
                                  if (hoverNode) {
                                    if (s === hoverNode || t === hoverNode) return C_TEAL;
                                    return 'rgba(100, 116, 139, 0.18)';
                                  }
                                  return 'rgba(0, 75, 135, 0.22)';
                                }}
                                linkDirectionalArrowLength={4}
                                linkDirectionalArrowColor={() => 'rgba(0, 75, 135, 0.45)'}
                                linkDirectionalArrowRelPos={1}
                            />
                        ) : null}

                        {/* ─── STRATEGY 1 SELECTION POPOVER HTML COMPONENT CONTAINER ────────────────────── */}
                        {popoverNode && popoverPos && (
                            <div
                                className="absolute z-30 bg-white border border-[#e4ebf2] shadow-xl rounded-sm p-1.5 flex flex-col gap-0.5 w-52 animate-in fade-in zoom-in-95 duration-100 select-none"
                                style={{
                                  left: `${popoverPos.x}px`,
                                  top: `${popoverPos.y - 20}px`,
                                  transform: 'translate(-50%, -100%)',
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                            >
                              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#7c8ba0] border-b border-[#f3f6fa] mb-1 truncate">
                                {popoverNode.name}
                              </div>
                              <button
                                  type="button"
                                  className="w-full text-left px-2 py-1.5 text-xs font-semibold text-[#14283b] hover:bg-[#f3f6fa] hover:text-[#004b87] rounded-sm transition-colors flex items-center gap-2"
                                  onClick={() => {
                                    const isCurrentlyExpanded = neighborhoodCache.has(popoverNode.uri);
                                    if (isCurrentlyExpanded) {
                                      setNeighborhoodCache((prev) => {
                                        const updated = new Map(prev);
                                        updated.delete(popoverNode.uri);
                                        return updated;
                                      });
                                    } else {
                                      setTargetNeighborhoodUri(popoverNode.uri);
                                    }
                                    setPopoverNode(null);
                                    setPopoverPos(null);
                                  }}
                              >
                                {neighborhoodCache.has(popoverNode.uri) ? (
                                    <><span>x</span> {t('collapseConnections', 'Collapse Connections')}</>
                                ) : (
                                    <><span></span> {t('expandConnections', 'Expand Connections')}</>
                                )}
                              </button>
                              <button
                                  type="button"
                                  className="w-full text-left px-2 py-1.5 text-xs font-semibold text-[#14283b] hover:bg-[#f3f6fa] hover:text-[#004b87] rounded-sm transition-colors flex items-center gap-2"
                                  onClick={() => {
                                    navigate(buildConceptUrl(popoverNode.uri, 'graph'));
                                    setPopoverNode(null);
                                    setPopoverPos(null);
                                  }}
                              >
                                <span></span> {t('viewConceptPage', 'View Concept Page')}
                              </button>
                            </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="hierarchy" className="graph-tab-content m-0 focus-visible:outline-none focus-visible:ring-0">
                <Card className="graph-card graph-card--hierarchy rounded-sm shadow-sm border-[#e4ebf2] overflow-hidden bg-white">
                  <CardContent className="graph-hierarchy-content p-0 h-[calc(100vh-200px)] relative bg-linear-to-br from-white via-[#f7fafc] to-[#eef3f8]">
                    <div className="hierarchy-flow-shell w-full h-full flex flex-col">
                      <div className="hierarchy-flow-legend absolute top-4 left-4 z-10 flex gap-2">
                        {(['broader', 'related', 'narrower'] as const).map((kind) => (
                            <button
                                key={kind}
                                type="button"
                                className={`px-4 py-2 text-sm font-semibold rounded-sm border shadow-sm transition-all ${expandedGroups[kind] ? 'bg-[#eaf1f8] text-[#004b87] border-[#004b87]/30' : 'bg-white text-[#586a7b] border-[#e4ebf2] hover:bg-[#f3f6fa] hover:text-[#14283b]'}`}
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
                                  style: { stroke: 'rgba(0, 75, 135, 0.45)', strokeWidth: 2, opacity: 0.8 },
                                }}
                                proOptions={{ hideAttribution: true }}
                            />
                        ) : (
                            <div className="hierarchy-empty-state w-full h-full flex items-center justify-center text-[#7c8ba0]">
                              {t('preparingView', 'Preparing view...')}
                            </div>
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