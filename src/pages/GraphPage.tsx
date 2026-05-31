import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useTranslation } from 'react-i18next';
import * as d3 from 'd3-force';
import ForceGraph2D, { type ForceGraphMethods, type NodeObject } from 'react-force-graph-2d';
import { Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';
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
  definition?: string | null; // always @sl in this dataset
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

const EMPTY_CONCEPT_NODES: ConceptNode[] = [];

function getConceptLabel(item: ConceptNode, lang: string) {
  if (lang === 'sl') {
    return stripLanguageTag(item.prefLabelSl ?? item.prefLabelEn ?? item.prefLabel) || item.uri;
  }
  return stripLanguageTag(item.prefLabelEn ?? item.prefLabelSl ?? item.prefLabel) || item.uri;
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
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={`hierarchy-flow-node hierarchy-flow-node--${data.kind}`}
    >
      {data.kind === 'root' ? null : (
        <Handle type="target" position={Position.Left} className="hierarchy-flow-handle hierarchy-flow-handle--target" />
      )}

      <button
        type="button"
        className={`hierarchy-flow-node-card hierarchy-flow-node-card--${data.kind} nodrag nopan shadow-sm hover:shadow-md transition-all rounded-xl border border-slate-800 bg-slate-900/60 text-card-foreground group flex items-start gap-3 p-4`}
        onClick={() => data.onClick(data.uri)}
        onMouseDown={(e) => e.stopPropagation()}
        title={data.uri}
        aria-label={ariaLabel}
      >
        <span className="hierarchy-flow-node-icon bg-slate-900 border border-slate-800 text-teal-400 rounded-full w-8 h-8 flex items-center justify-center shrink-0 shadow-inner group-hover:border-teal-500/30 group-hover:bg-teal-500/10 transition-colors" aria-hidden="true">
          {data.kind === 'root' ? '🎯' : data.kind === 'broader' ? '⬆️' : data.kind === 'narrower' ? '⬇️' : '↔️'}
        </span>
        <span className="hierarchy-flow-node-copy text-left flex flex-col pt-1">
          <span className="hierarchy-flow-node-title font-semibold text-[15px] group-hover:text-teal-400 transition-colors">{label}</span>
          {relationChips.length > 0 ? (
            <span className="hierarchy-flow-node-relations mt-2 flex flex-wrap gap-1" aria-hidden="true">
              {relationChips.map((relation) => (
                <span key={relation} className={`hierarchy-flow-node-relation hierarchy-flow-node-relation--${relation} text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800/80 text-teal-400 border border-teal-500/20 shadow-sm`}>
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
    </motion.div>
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

// ─── GraphQL query ──────────────────────────────────────────────────────────
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

// ─── Definition overlay sub-component ───────────────────────────────────────
// Isolated so the Groq hook only runs when the graph tab (and this overlay) is rendered.
interface DefinitionOverlayProps {
  concept: Concept;
  translatedTitle: string;
  broaderCount: number;
  narrowerCount: number;
  lang: string;
  t: (key: string, fallback?: string) => string;
}

function DefinitionOverlay({ concept, translatedTitle, broaderCount, narrowerCount, lang, t }: DefinitionOverlayProps) {
  const defState = useConceptDefinition({
    lang,
    definition: concept.definition,
    prefLabelSl: concept.prefLabelSl ?? concept.prefLabel,
    prefLabelEn: concept.prefLabelEn ?? concept.prefLabel,
  });

  const definitionText =
    defState.status === 'ready'
      ? defState.text
      : defState.status === 'loading'
        ? null  // show skeleton
        : null; // soft failure – show nothing

  // Small badge shown when the definition was AI-assisted
  const aiBadge =
    defState.status === 'ready' && defState.source !== 'native' ? (
      <span
        className="inline-flex items-center gap-1 text-[9px] uppercase font-bold tracking-wider text-teal-500/70 mt-1"
        title={defState.source === 'translated' ? 'Translated by AI' : 'Generated by AI'}
        aria-label={defState.source === 'translated' ? 'AI translated definition' : 'AI generated definition'}
      >
        <span aria-hidden="true">✦</span>
        {defState.source === 'translated'
          ? t('aiTranslated', 'AI translated')
          : t('aiGenerated', 'AI generated')}
      </span>
    ) : null;

  return (
    <div className="graph-overlay absolute top-4 left-4 z-10 w-72 bg-slate-900/60/90 backdrop-blur-md border border-slate-800 shadow-lg p-5 rounded-xl flex flex-col gap-3 pointer-events-none">
      <h3 className="text-lg font-bold leading-tight">{translatedTitle}</h3>

      <div className="graph-overlay-definition text-sm text-slate-400 leading-relaxed">
        {defState.status === 'loading' ? (
          <div className="flex flex-col gap-1.5" aria-label={t('loadingDefinition', 'Loading definition…')}>
            <Skeleton className="h-3 w-full rounded bg-slate-700/60" />
            <Skeleton className="h-3 w-5/6 rounded bg-slate-700/60" />
            <Skeleton className="h-3 w-4/6 rounded bg-slate-700/60" />
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
        <div className="graph-metric flex flex-col bg-slate-800/50 p-2 rounded-lg flex-1 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-400">{t('broader', 'Broader')}</span>
          <strong className="text-lg text-teal-400">{broaderCount}</strong>
        </div>
        <div className="graph-metric flex flex-col bg-slate-800/50 p-2 rounded-lg flex-1 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-400">{t('narrower', 'Narrower')}</span>
          <strong className="text-lg text-teal-400">{narrowerCount}</strong>
        </div>
        <div className="graph-metric flex flex-col bg-slate-800/50 p-2 rounded-lg flex-1 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-400">{t('totalLinks', 'Total Links')}</span>
          <strong className="text-lg text-teal-400">{broaderCount + narrowerCount}</strong>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
function GraphPage() {
  const { t, i18n } = useTranslation();
  const selectedLanguage = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const searchLanguage = selectedLanguage.toLowerCase().startsWith('sl') ? 'sl' : 'en';

  const { uri } = useParams<{ uri: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const [graphViewportElement, setGraphViewportElement] = useState<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [graphKey, setGraphKey] = useState(0);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const hierarchyFlowInstanceRef = useRef<{ fitView: (options?: { padding?: number }) => void } | null>(null);
  const [hierarchyViewportElement, setHierarchyViewportElement] = useState<HTMLDivElement | null>(null);
  const [hierarchyViewportSize, setHierarchyViewportSize] = useState({ width: 0, height: 0 });
  const [expandedGroups, setExpandedGroups] = useState<Record<HierarchyGroupKind, boolean>>({
    broader: true,
    related: true,
    narrower: false,
  });
  const { loading, error, data } = useQuery<GetConceptResponse>(GET_CONCEPT, {
    variables: { uri: decodeURIComponent(uri || '') },
  });

  const activeTab = searchParams.get('tab') === 'hierarchy' ? 'hierarchy' : 'graph';

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

  useEffect(() => {
    if (activeTab === 'graph') {
      const id = window.setTimeout(() => setGraphKey((k) => k + 1), 0);
      return () => window.clearTimeout(id);
    }
  }, [activeTab, uri]);

  useEffect(() => {
    if (activeTab !== 'graph') return;
    if (!fgRef.current) return;

    const fg = fgRef.current;
    fg.d3Force('charge')?.strength(-500);
    fg.d3Force('link')?.distance(80);
    fg.d3Force('collide', d3.forceCollide().radius(25).iterations(2));
    fg.d3Force('center', d3.forceCenter());

    const timer = setTimeout(() => {
      if (fgRef.current && activeTab === 'graph') {
        try {
          fgRef.current.zoomToFit(400, 50, () => true);
        } catch {
          // Ignore zoom failures during fast unmounts
        }
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [graphKey, viewportSize, activeTab]);

  const graphData = useMemo<GraphData>(() => {
    if (!data || !data.concept) {
      return { nodes: [], links: [] };
    }

    const concept = data.concept;
    const nodeMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];

    const addNode = (item: ConceptNode) => {
      if (!nodeMap.has(item.uri)) {
        nodeMap.set(item.uri, { id: item.uri, name: getConceptLabel(item, searchLanguage), uri: item.uri });
      }
    };

    const addRelationGroup = (items: ConceptNode[] | undefined) => {
      items?.forEach((item) => {
        addNode(item);
        links.push({ source: concept.uri, target: item.uri });
      });
    };

    addNode(concept);
    addRelationGroup(concept.broader);
    addRelationGroup(concept.narrower);
    addRelationGroup(concept.related);

    const nodes = Array.from(nodeMap.values());
    const angleStep = nodes.length > 1 ? (2 * Math.PI) / nodes.length : 0;
    nodes.forEach((node, i) => {
      node.x = Math.cos(i * angleStep) * 80;
      node.y = Math.sin(i * angleStep) * 80;
    });

    return { nodes, links };
  }, [data, searchLanguage]);

  const concept = data?.concept;
  const canonicalUrl = typeof window !== 'undefined' && uri ? `${window.location.origin}/frontend/graph/${uri}` : undefined;

  const broaderTerms = useMemo(() => {
    const broader = concept?.broader ?? [];
    const seen = new Set<string>();

    return broader.filter((item) => {
      if (seen.has(item.uri)) return false;
      seen.add(item.uri);
      return true;
    });
  }, [concept?.broader]);

  const narrowerTerms = useMemo(() => {
    const narrower = concept?.narrower ?? [];
    const seen = new Set<string>();

    return narrower.filter((item) => {
      if (seen.has(item.uri)) return false;
      seen.add(item.uri);
      return true;
    });
  }, [concept?.narrower]);

  const broaderCount = broaderTerms.length;
  const narrowerCount = narrowerTerms.length;
  const translatedTitle = concept ? getConceptLabel(concept, searchLanguage) : '';
  const seoTitle = concept
    ? t('seoGraphTitle', { conceptName: translatedTitle, defaultValue: `${translatedTitle} - SGC Navigator` })
    : t('seoGraphLoadingTitle', 'Concept details - SGC Navigator');
  const seoDescription = concept
    ? t('seoGraphDescription', {
        conceptName: translatedTitle,
        defaultValue: `Explore the semantic relationships, broader terms, and narrower concepts for ${translatedTitle} inside the COBISS SGC system.`,
      })
    : t('seoGraphLoadingDescription', 'Loading concept details from the COBISS SGC system.');
  const seoKeywords = t('seoGraphKeywords', 'SGC Navigator, COBISS, concept relationships, broader terms, narrower concepts, semantic graph');

  const toggleHierarchyGroup = useCallback((kind: HierarchyGroupKind) => {
    setExpandedGroups((current) => ({
      ...current,
      [kind]: !current[kind],
    }));
  }, []);

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
    navigate(buildConceptUrl(targetUri, 'hierarchy'));
  }, [buildConceptUrl, navigate]);

  const hierarchyFlow = useMemo(() => {
    if (!concept) {
      return { nodes: [], edges: [] };
    }

    const visibleBroaderTerms = expandedGroups.broader ? broaderTerms : EMPTY_CONCEPT_NODES;
    const visibleRelatedTerms = expandedGroups.related ? dedupeConceptNodes(concept.related) : EMPTY_CONCEPT_NODES;
    const visibleNarrowerTerms = expandedGroups.narrower ? narrowerTerms : EMPTY_CONCEPT_NODES;

    return buildHierarchyNodes(concept, visibleBroaderTerms, visibleNarrowerTerms, visibleRelatedTerms, handleHierarchyConceptClick, searchLanguage);
  }, [
    concept,
    expandedGroups.broader,
    expandedGroups.narrower,
    expandedGroups.related,
    broaderTerms,
    narrowerTerms,
    handleHierarchyConceptClick,
    searchLanguage
  ]);

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

  if (loading) {
    return (
      <>
        <SEO title={seoTitle} description={seoDescription} keywords={seoKeywords} canonicalUrl={canonicalUrl} />
        <div className="graph-page w-full min-h-[calc(100vh-(--spacing(12)))] bg-linear-to-b from-slate-950 to-slate-900">
          <section className="graph-shell max-w-350 mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6">
            <div className="graph-toolbar flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-slate-900/80 border border-slate-800 shadow-sm p-6 rounded-2xl">
              <div className="graph-title-block flex flex-col gap-2 w-full max-w-lg">
                <Skeleton className="h-5 w-24 rounded-full bg-primary/20" />
                <Skeleton className="h-10 w-3/4 bg-primary/10" />
                <Skeleton className="h-6 w-1/3 bg-slate-800/80" />
              </div>
              <Skeleton className="h-12 w-64 rounded-xl bg-slate-800/80" />
            </div>
            <Card className="rounded-2xl shadow-md border-slate-800 bg-slate-900/60 overflow-hidden">
              <CardHeader className="bg-slate-900/40 border-b border-slate-800 p-6">
                <Skeleton className="h-6 w-48 mb-2 bg-primary/10" />
                <Skeleton className="h-4 w-96 bg-slate-800/50" />
              </CardHeader>
               <CardContent className="h-162.5 p-6 relative flex items-center justify-center bg-slate-900/20">
                 <motion.div
                    animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.95, 1.05, 0.95] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="w-32 h-32 rounded-full bg-primary/5 blur-3xl absolute"
                 />
                 <Skeleton className="h-full w-full opacity-30 rounded-xl" />
              </CardContent>
            </Card>
          </section>
        </div>
        <Footer />
      </>
    );
  }

  if (error) {
    return (
      <>
        <SEO title={seoTitle} description={seoDescription} keywords={seoKeywords} canonicalUrl={canonicalUrl} />
        <p className="p-8 text-destructive">{t('graphErrorPrefix', 'Error:')} {error.message}</p>
      </>
    );
  }
  if (!concept) {
    return (
      <>
        <SEO title={seoTitle} description={seoDescription} keywords={seoKeywords} canonicalUrl={canonicalUrl} />
        <p className="p-8">{t('noConceptFound', 'No concept found.')}</p>
      </>
    );
  }

  return (
    <>
      <SEO title={seoTitle} description={seoDescription} keywords={seoKeywords} canonicalUrl={canonicalUrl} />
      <div className="graph-page w-full min-h-[calc(100vh-(--spacing(12)))] bg-linear-to-b from-slate-950 to-slate-900">
        <section className="graph-shell max-w-350 mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="graph-tabs w-full flex flex-col gap-4">
            <div className="graph-toolbar flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-slate-900/80 border border-slate-800 shadow-sm p-6 rounded-2xl">
              <div className="graph-title-block flex flex-col gap-2">
                <Badge variant="secondary" className="w-fit text-teal-400 font-bold tracking-wide uppercase text-[10px] px-2 py-0.5 rounded-full">{t('selectedTerm', 'Selected term')}</Badge>
                <h2 className="graph-title text-3xl font-bold tracking-tight text-slate-50">{translatedTitle}</h2>
                <p className="graph-subtitle text-sm text-slate-400 font-mono bg-slate-800/80 px-2 py-1 rounded w-fit">{concept.uri}</p>
              </div>

              <TabsList className="graph-tabs-list bg-slate-800/50 p-1 rounded-xl shadow-inner inline-flex h-12 items-center justify-center">
                <TabsTrigger value="graph" className="rounded-lg px-6 py-2.5 text-sm font-semibold transition-all text-slate-400 hover:text-slate-100 data-[state=active]:bg-slate-900/60 data-[state=active]:text-teal-400 data-[state=active]:shadow-sm">{t('tabGraph', 'Graph View')}</TabsTrigger>
                <TabsTrigger value="hierarchy" className="rounded-lg px-6 py-2.5 text-sm font-semibold transition-all text-slate-400 hover:text-slate-100 data-[state=active]:bg-slate-900/60 data-[state=active]:text-teal-400 data-[state=active]:shadow-sm">{t('tabHierarchy', 'Hierarchy')}</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="graph" className="graph-tab-content m-0 focus-visible:outline-none focus-visible:ring-0">
              <Card className="graph-card rounded-2xl shadow-md border-slate-800 overflow-hidden bg-slate-900/60">
                <CardHeader className="graph-card-header bg-slate-900/40 border-b border-slate-800 p-6">
                  <div className="graph-card-heading">
                    <CardTitle className="text-xl font-bold text-slate-50">{t('graphOverviewTitle', 'Concept Overview')}</CardTitle>
                    <CardDescription className="text-slate-300 text-sm mt-1">
                      {t('graphOverviewDesc', 'Explore the interactive network of related, broader, and narrower concepts.')}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="graph-card-content p-0 m-0 w-full h-162.5 relative">
                  <div className="graph-stage w-full h-full flex flex-row">
                    {/* ── Definition overlay – Groq-powered ── */}
                    <DefinitionOverlay
                      concept={concept}
                      translatedTitle={translatedTitle}
                      broaderCount={broaderCount}
                      narrowerCount={narrowerCount}
                      lang={searchLanguage}
                      t={t}
                    />

                    <div ref={setGraphViewportElement} className="graph-viewport w-full h-full bg-linear-to-br from-slate-950/80 via-slate-900/60 to-slate-950/70 flex-1 cursor-grab active:cursor-grabbing">
                      {viewportSize.width > 0 && viewportSize.height > 0 ? (
                        <ForceGraph2D
                          key={graphKey}
                          ref={fgRef}
                          graphData={graphData}
                          width={viewportSize.width}
                          height={viewportSize.height}
                          nodeLabel="name"
                          nodeAutoColorBy="name"
                          backgroundColor="rgba(2, 6, 23, 0.85)"
                          warmupTicks={10}
                          d3AlphaDecay={0.02}
                          d3AlphaMin={0.01}
                          cooldownTicks={100}
                          cooldownTime={2000}
                          nodeCanvasObject={(node: NodeObject<GraphNode>, ctx, globalScale) => {
                            const isSelected = node.uri === concept.uri;
                            const isHovered = node.uri === hoverNode;
                            const isDimmed = hoverNode && node.uri !== hoverNode && !graphData.links.find(l => {
                              const ls = typeof l.source === 'object' && l.source !== null && 'id' in l.source ? (l.source as { id: string }).id : l.source;
                              const lt = typeof l.target === 'object' && l.target !== null && 'id' in l.target ? (l.target as { id: string }).id : l.target;
                              return (ls === hoverNode && lt === node.uri) || (lt === hoverNode && ls === node.uri);
                            });

                            const baseRadius = 6;
                            const radius = isSelected ? baseRadius * 1.5 : isHovered ? baseRadius * 1.2 : baseRadius;
                            const opacity = isDimmed ? 0.3 : 1;

                            const x = node.x ?? 0;
                            const y = node.y ?? 0;

                            ctx.globalAlpha = opacity;

                            if (isHovered || isSelected) {
                              ctx.shadowColor = isSelected ? 'rgba(0, 169, 157, 0.5)' : 'rgba(0, 75, 135, 0.4)';
                              ctx.shadowBlur = 15;
                            } else {
                              ctx.shadowColor = 'rgba(0,0,0,0.1)';
                              ctx.shadowBlur = 8;
                            }
                            ctx.shadowOffsetX = 0;
                            ctx.shadowOffsetY = 2;

                            ctx.fillStyle = isSelected ? '#00a99d' : isHovered ? '#0070c0' : '#004b87';
                            ctx.beginPath();
                            ctx.arc(x, y, radius, 0, 2 * Math.PI);
                            ctx.fill();

                            ctx.shadowColor = 'transparent';
                            ctx.shadowBlur = 0;

                            if (isSelected || isHovered) {
                              ctx.lineWidth = 2;
                              ctx.strokeStyle = '#fff';
                              ctx.stroke();
                            }

                            if (globalScale > 1.2 || isSelected || isHovered) {
                              const label = node.name;
                              const fontSize = isSelected ? 12 : isHovered ? 11 : 10;
                              ctx.font = `${(isSelected || isHovered) ? 'bold ' : '500 '}${fontSize}px Inter, sans-serif`;

                              const textMetrics = ctx.measureText(label);
                              const bWidth = textMetrics.width + 12;
                              const bHeight = fontSize + 8;

                              const textYOffset = radius + 12;
                              const rectX = x - bWidth / 2;
                              const rectY = y + textYOffset - bHeight / 2;

                              ctx.globalAlpha = (isSelected || isHovered) ? opacity : Math.min(opacity, (globalScale - 1.2) * 2);

                              ctx.fillStyle = 'rgba(30, 30, 35, 0.92)';
                              ctx.beginPath();
                              if (ctx.roundRect) {
                                ctx.roundRect(rectX, rectY, bWidth, bHeight, 4);
                              } else {
                                ctx.rect(rectX, rectY, bWidth, bHeight);
                              }
                              ctx.fill();

                              if (isSelected || isHovered) {
                                ctx.lineWidth = 1.5;
                                ctx.strokeStyle = isSelected ? '#00a99d' : 'rgba(0, 169, 157, 0.5)';
                                ctx.stroke();
                              }

                              ctx.fillStyle = '#f1f5f9';
                              ctx.textAlign = 'center';
                              ctx.textBaseline = 'middle';
                              ctx.fillText(label, x, y + textYOffset);
                            }

                            ctx.globalAlpha = 1;
                          }}
                          nodeRelSize={6}
                          linkWidth={(link) => {
                            const ls = typeof link.source === 'object' && link.source !== null && 'id' in link.source ? (link.source as { id: string }).id : link.source;
                            const lt = typeof link.target === 'object' && link.target !== null && 'id' in link.target ? (link.target as { id: string }).id : link.target;
                            return (ls === hoverNode || lt === hoverNode) ? 3 : 1.5;
                          }}
                          linkColor={(link) => {
                            const ls = typeof link.source === 'object' && link.source !== null && 'id' in link.source ? (link.source as { id: string }).id : link.source;
                            const lt = typeof link.target === 'object' && link.target !== null && 'id' in link.target ? (link.target as { id: string }).id : link.target;
                            if (hoverNode) {
                              if (ls === hoverNode || lt === hoverNode) {
                                return '#00a99d';
                              }
                              return 'rgba(68, 64, 60, 0.15)';
                            }
                            return 'rgba(255, 255, 255, 0.15)';
                          }}
                          linkDirectionalParticles={(link) => {
                            const ls = typeof link.source === 'object' && link.source !== null && 'id' in link.source ? (link.source as { id: string }).id : link.source;
                            const lt = typeof link.target === 'object' && link.target !== null && 'id' in link.target ? (link.target as { id: string }).id : link.target;
                            return (ls === hoverNode || lt === hoverNode) ? 4 : 0;
                          }}
                          linkDirectionalParticleWidth={3}
                          linkDirectionalParticleSpeed={0.015}
                          onNodeClick={(node: GraphNode) => {
                            if (fgRef.current?.resumeAnimation) {
                              fgRef.current.resumeAnimation();
                            }
                            handleConceptClick(node.uri, 'graph');
                          }}
                          onNodeHover={(node: NodeObject<GraphNode> | null) => {
                            setHoverNode(node ? node.uri : null);
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

            <TabsContent value="hierarchy" className="graph-tab-content m-0 focus-visible:outline-none focus-visible:ring-0">
              <Card className="graph-card graph-card--hierarchy rounded-2xl shadow-md border-slate-800 overflow-hidden bg-slate-900/60">
                <CardHeader className="graph-card-header bg-slate-900/40 border-b border-slate-800 p-6">
                  <div className="graph-card-heading flex flex-col gap-2">
                    <CardTitle className="text-xl font-bold text-slate-50">{t('hierarchyLayoutTitle', 'Concept Hierarchy')}</CardTitle>
                    <CardDescription className="text-slate-300 text-sm">
                      {t('hierarchyLayoutDesc', 'Browse the selected concept with broader terms above, shared/related terms grouped, and narrower terms below.')}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="graph-hierarchy-content p-0 h-162.5 relative bg-linear-to-br from-slate-950/80 via-slate-900/60 to-slate-950/70">
                  <div className="hierarchy-flow-shell w-full h-full flex flex-col">
                    <div className="hierarchy-flow-legend absolute top-4 left-4 z-10 flex gap-2" aria-label="Hierarchy relation legend">
                      {(['broader', 'related', 'narrower'] as const).map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          className={`px-4 py-2 text-sm font-semibold rounded-full border shadow-sm transition-all ${expandedGroups[kind] ? 'bg-teal-500/20 text-teal-300 border-teal-500/40' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600/50'}`}
                          onClick={() => toggleHierarchyGroup(kind)}
                          aria-pressed={expandedGroups[kind]}
                          title={expandedGroups[kind] ? t('hideTerms', { kind }) : t('showTerms', { kind })}
                        >
                          {kind === 'related' ? t('sharedRelated', 'Shared / Related') : t(`legend${kind}`, kind[0].toUpperCase() + kind.slice(1))}
                        </button>
                      ))}
                    </div>

                    <div ref={setHierarchyViewportElement} className="hierarchy-flow flex-1 w-full h-full" aria-label="Concept hierarchy tree">
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
                          nodesDraggable={true}
                          nodesConnectable={false}
                          elementsSelectable={false}
                          preventScrolling={false}
                          defaultEdgeOptions={{
                            type: 'smoothstep',
                            focusable: false,
                            selectable: false,
                            style: {
                              stroke: 'rgba(0, 169, 157, 0.5)',
                              strokeWidth: 2,
                              opacity: 0.7,
                            },
                          }}
                          proOptions={{ hideAttribution: true }}
                        />
                      ) : (
                        <div className="hierarchy-empty-state w-full h-full flex items-center justify-center p-8 text-center text-slate-400 font-medium">
                          {expandedGroups.broader || expandedGroups.related || expandedGroups.narrower
                            ? t('preparingHierarchy', 'Preparing hierarchy view…')
                            : t('noGroupsExpanded', 'No groups are expanded. Use the buttons above to show broader, related, or narrower terms.')}
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
