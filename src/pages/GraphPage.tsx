import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import * as d3 from 'd3-force';
import ForceGraph2D, { type ForceGraphMethods, type NodeObject } from 'react-force-graph-2d';
import { Badge } from '@/components/ui/badge.tsx';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { Footer } from '@/components/layout/Footer.tsx';
import { SEO } from '@/components/layout/SEO.tsx';
import {cn, stripLanguageTag} from '@/lib/utils.ts';
import { useTheme } from '@/hooks/useTheme.ts';
import { useConceptDefinition, useConceptScopeNote, type ResolvedTextState } from '@/hooks/useConceptDefinition.ts';
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
  scopeNote?: string | null;
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
  fx?: number;
  fy?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

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

function getNodeId(nodeRef: string | GraphNode | NodeObject<GraphNode> | undefined | null): string {
  if (!nodeRef) return '';
  if (typeof nodeRef === 'string') return nodeRef;
  if (typeof nodeRef === 'object') {
    return nodeRef.id || nodeRef.uri || '';
  }
  return '';
}

// ─── Hierarchy tree types ──────────────────────────────────────────────────
type HierarchyRelationKind = 'broader' | 'narrower' | 'related';
type HierarchyGroupKind = HierarchyRelationKind;
type HierarchyNodeKind = 'root' | 'broader' | 'narrower' | 'shared' | 'related';

interface HierarchyTreeEntry {
  item: ConceptNode;
  kind: Exclude<HierarchyNodeKind, 'root'>;
  relations: HierarchyRelationKind[];
}

interface HierarchyTreeModel {
  parents: HierarchyTreeEntry[];  // pure broader  → stacked above current
  children: HierarchyTreeEntry[]; // pure narrower → tree under current
  related: HierarchyTreeEntry[];  // related + multi-relation ("shared")
}

function buildHierarchyTree(
    broader: ConceptNode[],
    narrower: ConceptNode[],
    related: ConceptNode[],
    lang: string,
): HierarchyTreeModel {
  const grouped = new Map<string, { item: ConceptNode; relations: Set<HierarchyRelationKind> }>();

  const add = (relation: HierarchyRelationKind, item: ConceptNode) => {
    const current = grouped.get(item.uri) ?? { item, relations: new Set<HierarchyRelationKind>() };
    current.item = item;
    current.relations.add(relation);
    grouped.set(item.uri, current);
  };

  broader.forEach((i) => add('broader', i));
  narrower.forEach((i) => add('narrower', i));
  related.forEach((i) => add('related', i));

  const parents: HierarchyTreeEntry[] = [];
  const children: HierarchyTreeEntry[] = [];
  const relatedOut: HierarchyTreeEntry[] = [];

  grouped.forEach(({ item, relations }) => {
    const list = Array.from(relations);
    if (list.length === 1 && list[0] === 'broader') {
      parents.push({ item, kind: 'broader', relations: list });
    } else if (list.length === 1 && list[0] === 'narrower') {
      children.push({ item, kind: 'narrower', relations: list });
    } else {
      relatedOut.push({ item, kind: list.length > 1 ? 'shared' : 'related', relations: list });
    }
  });

  const byLabel = (a: HierarchyTreeEntry, b: HierarchyTreeEntry) =>
      getConceptLabel(a.item, lang).localeCompare(getConceptLabel(b.item, lang), undefined, { sensitivity: 'base' });

  parents.sort(byLabel);
  children.sort(byLabel);
  relatedOut.sort(byLabel);

  return { parents, children, related: relatedOut };
}

// ─── Hierarchy tree node card ──────────────────────────────────────────────
const HierarchyTreeNode = memo(function HierarchyTreeNode({
  kind, label, uri, onClick, t,
}: {
  kind: HierarchyNodeKind;
  label: string;
  uri: string;
  relations: HierarchyRelationKind[];
  onClick?: (uri: string) => void;
  t: TFunction;
}) {
  const isRoot = kind === 'root';
  const cleanLabel = stripLanguageTag(label);

  const relationLabel = isRoot
      ? t('openSelectedTerm', 'Open selected term')
      : kind === 'broader'
          ? t('openBroaderTerm', 'Open broader term')
          : kind === 'narrower'
              ? t('openNarrowerTerm', 'Open narrower term')
              : t('openRelatedTerm', 'Open related term');

  return (
      <button
          type="button"
          className={cn(
              'hierarchy-tree-node-card group flex items-start gap-3 p-4 rounded-sm border text-card-foreground text-left transition-shadow shadow-sm w-full',
              isRoot
                  ? 'border-[var(--brand-teal)] bg-[var(--tint-teal)] cursor-default'
                  : 'border-[var(--line)] bg-[var(--surface)] hover:shadow-md',
          )}
          onClick={isRoot ? undefined : () => onClick?.(uri)}
          disabled={isRoot}
          title={uri}
          aria-label={`${relationLabel} ${cleanLabel}`}
      >
        <span className="flex flex-col pt-1">
          <span className={cn(
              'font-semibold text-[15px] transition-colors',
              isRoot ? 'text-[var(--brand-teal-strong)]' : 'text-[var(--ink)] group-hover:text-[var(--brand-navy)]',
          )}>
            {cleanLabel}
          </span>
        </span>
      </button>
  );
});

// ─── Plus/minus hitbox (graph canvas only) ────────────────────────────────
interface PlusHitbox {
  x: number;
  y: number;
  r: number;
  isCluster?: boolean;
  isCenter?: boolean;
}

type HitboxHolder = { _plusHitbox?: PlusHitbox };

// ─── GraphQL ──────────────────────────────────────────────────────────────
const GET_CONCEPT = gql`
  query GetConcept($uri: String!) {
    concept(uri: $uri) {
      uri
      prefLabel
      prefLabelSl
      scopeNote
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

// ─── CategoryButton ───────────────────────────────────────────────────────
interface CategoryButtonProps {
  kind: 'broader' | 'narrower' | 'related';
  count: number;
  label: string;
  hiddenCategories: Set<'broader' | 'narrower' | 'related'>;
  toggleCategory: (category: 'broader' | 'narrower' | 'related') => void;
}

function CategoryButton({ kind, count, label, hiddenCategories, toggleCategory }: CategoryButtonProps) {
  const isHidden = hiddenCategories.has(kind);
  return (
      <button
          onClick={() => toggleCategory(kind)}
          className={cn(
              "graph-metric flex flex-col p-2 rounded-sm flex-1 text-center transition-all border",
              isHidden
                  ? "bg-[var(--surface-muted)] opacity-50 grayscale border-transparent"
                  : "bg-[var(--surface-muted)] border-[var(--line)] cursor-pointer hover:border-[var(--brand-navy)]"
          )}
      >
        <span className="text-[10px] uppercase font-bold text-[var(--ink-faint)]">{label}</span>
        <strong className="text-lg text-[var(--brand-navy)]">{count}</strong>
      </button>
  );
}

// ─── DefinitionOverlay ────────────────────────────────────────────────────
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

function ResolvedSection({ state, label, t }: { state: ResolvedTextState; label: string; t: TFunction }) {
  if (state.status === 'idle') return null;

  return (
      <div className="graph-overlay-section flex flex-col gap-1 pointer-events-none">
        <span className="text-[9px] uppercase font-bold tracking-wider text-[var(--ink-faint)]">{label}</span>
        {state.status === 'loading' ? (
            <div className="flex flex-col gap-1.5" aria-label={t('loading', 'Loading…')}>
              <Skeleton className="h-3 w-full rounded bg-[var(--surface-muted)]" />
              <Skeleton className="h-3 w-5/6 rounded bg-[var(--surface-muted)]" />
              <Skeleton className="h-3 w-4/6 rounded bg-[var(--surface-muted)]" />
            </div>
        ) : (
            <>
              <p className="text-sm text-[var(--ink-muted)] leading-relaxed line-clamp-4">{state.text}</p>
              {state.source !== 'native' ? (
                  <span
                      className="inline-flex items-center gap-1 text-[9px] uppercase font-bold tracking-wider text-[var(--brand-teal-strong)]"
                      title={state.source === 'translated' ? 'Translated by AI' : 'Generated by AI'}
                  >
                    <span aria-hidden="true">✦</span>
                    {state.source === 'translated' ? t('aiTranslated', 'AI translated') : t('aiGenerated', 'AI generated')}
                  </span>
              ) : null}
            </>
        )}
      </div>
  );
}

function DefinitionOverlay({ concept, translatedTitle, relatedCount, broaderCount, narrowerCount, lang, hiddenCategories, toggleCategory, t }: DefinitionOverlayProps) {
  const labels = {
    prefLabelSl: concept.prefLabelSl ?? concept.prefLabel,
    prefLabelEn: concept.prefLabelEn ?? concept.prefLabel,
  };

  const scopeState = useConceptScopeNote({ lang, scopeNote: concept.scopeNote, ...labels });
  const defState = useConceptDefinition({ lang, definition: concept.definition, ...labels });

  return (
      <div className="graph-overlay absolute top-4 left-4 z-10 w-72 bg-[var(--surface)]/95 backdrop-blur-sm border border-[var(--line)] shadow-lg shadow-[var(--brand-navy)]/5 p-5 rounded-sm flex flex-col gap-3 pointer-events-auto">
        <h3 className="text-lg font-bold leading-tight text-[var(--ink)] font-heading pointer-events-none">{translatedTitle}</h3>

        <div className="graph-overlay-body flex flex-col gap-3">
          <ResolvedSection state={scopeState} label={t('scopeNote', 'Scope note')} t={t} />
          <ResolvedSection state={defState} label={t('definition', 'Definition')} t={t} />
        </div>

        <Separator className="graph-overlay-separator my-2 pointer-events-none" />

        <div className="graph-metrics flex justify-between gap-2" aria-label="Concept relation summary">
          <CategoryButton kind="broader" count={broaderCount} label={t('broader', 'Broader')} hiddenCategories={hiddenCategories} toggleCategory={toggleCategory} />
          <CategoryButton kind="narrower" count={narrowerCount} label={t('narrower', 'Narrower')} hiddenCategories={hiddenCategories} toggleCategory={toggleCategory} />
          <CategoryButton kind="related" count={relatedCount} label={t('related', 'Related')} hiddenCategories={hiddenCategories} toggleCategory={toggleCategory} />

          <div className="graph-metric flex flex-col bg-[var(--tint-navy)] border border-[var(--brand-navy)]/15 p-2 rounded-sm flex-1 text-center pointer-events-none">
            <span className="text-[10px] uppercase font-bold text-[var(--ink-faint)]">{t('totalLinks', 'Total Links')}</span>
            <strong className="text-lg text-[var(--brand-teal-strong)]">{broaderCount + relatedCount + narrowerCount}</strong>
          </div>
        </div>
      </div>
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────
function dedupeConceptNodes(items?: ConceptNode[]) {
  const seen = new Set<string>();
  return (items ?? []).filter((item) => {
    if (seen.has(item.uri)) return false;
    seen.add(item.uri);
    return true;
  });
}

// ─── GraphPage ────────────────────────────────────────────────────────────
function GraphPage() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const P = CANVAS_PALETTE[theme === 'dark' ? 'dark' : 'light'];
  const selectedLanguage = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const searchLanguage = selectedLanguage.toLowerCase().startsWith('sl') ? 'sl' : 'en';
  const [hoveringButtonOfNode, setHoveringButtonOfNode] = useState<string | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<Set<'broader' | 'narrower' | 'related'>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const [popoverNode, setPopoverNode] = useState<GraphNode | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);

  const { uri } = useParams<{ uri: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const [graphViewportElement, setGraphViewportElement] = useState<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [hoverNode, setHoverNode] = useState<string | null>(null);

  // hierarchy tree ref — used to scroll the current term into view
  const hierarchyCurrentRef = useRef<HTMLDivElement | null>(null);

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

  // ─── CASCADE PRUNING REACHABILITY ENGINE ─────────────────────────────────
  const pruneOrphanedCache = useCallback((
      currentCache: Map<string, { nodes: ConceptNode[]; edges: ConceptEdge[] }>,
      rootUri: string
  ) => {
    if (!data?.concept) return currentCache;
    const updated = new Map(currentCache);
    const adj = new Map<string, Set<string>>();

    const rootNeighbors = new Set<string>();
    if (!hiddenCategories.has('broader')) data.concept.broader?.forEach(n => rootNeighbors.add(n.uri));
    if (!hiddenCategories.has('narrower')) data.concept.narrower?.forEach(n => rootNeighbors.add(n.uri));
    if (!hiddenCategories.has('related')) data.concept.related?.forEach(n => rootNeighbors.add(n.uri));
    adj.set(rootUri, rootNeighbors);

    updated.forEach((cacheValue, originUri) => {
      const neighbors = adj.get(originUri) ?? new Set<string>();
      cacheValue.edges.forEach(edge => {
        if (edge.sourceUri === originUri) neighbors.add(edge.targetUri);
      });
      adj.set(originUri, neighbors);
    });

    const visited = new Set<string>([rootUri]);
    const queue = [rootUri];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const neighbors = adj.get(curr);
      if (neighbors) {
        for (const next of neighbors) {
          if (!visited.has(next)) {
            visited.add(next);
            if (updated.has(next)) queue.push(next);
          }
        }
      }
    }

    updated.forEach((_, key) => {
      if (!visited.has(key)) updated.delete(key);
    });

    return updated;
  }, [data, hiddenCategories]);

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
    const defaultOpenCache = new Map();
    defaultOpenCache.set(`root:expanded:broader`, { nodes: [], edges: [] });
    defaultOpenCache.set(`root:expanded:narrower`, { nodes: [], edges: [] });
    defaultOpenCache.set(`root:expanded:related`, { nodes: [], edges: [] });
    setTimeout(() => setNeighborhoodCache(defaultOpenCache), 0);
  }, [decodedUri]);

  useEffect(() => {
    setTimeout(() => {
      setPopoverNode(null);
      setPopoverPos(null);
    }, 0);
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

  const graphData = useMemo<GraphData>(() => {
    if (!data?.concept) return { nodes: [], links: [] };

    const concept = data.concept;
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const addedNodes = new Map<string, GraphNode>();

    const getOrAddConceptNode = (item: ConceptNode, isCenter = false) => {
      if (addedNodes.has(item.uri)) return addedNodes.get(item.uri)!;
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
    const rootNode = addedNodes.get(concept.uri)!;
    rootNode.x = 0; rootNode.y = 0; rootNode.fx = 0; rootNode.fy = 0;

    const getClusterLabel = (kind: 'broader' | 'narrower' | 'related') =>
        kind === 'broader'
            ? ` ${t('clusterBroader', 'Broader')}`
            : kind === 'narrower'
                ? ` ${t('clusterNarrower', 'Narrower')}`
                : ` ${t('clusterRelated', 'Related')}`;

    const addCategoryCluster = (parentUri: string, kind: 'broader' | 'narrower' | 'related') => {
      const clusterId = `cluster:${kind}:${parentUri}`;
      nodes.push({ id: clusterId, name: getClusterLabel(kind), uri: clusterId, isCluster: true, clusterKind: kind });
      links.push({ source: parentUri, target: clusterId });
      return clusterId;
    };

    const rootGroups = [
      { kind: 'broader' as const, items: concept.broader },
      { kind: 'narrower' as const, items: concept.narrower },
      { kind: 'related' as const, items: concept.related },
    ];

    rootGroups.forEach((group) => {
      if (hiddenCategories.has(group.kind)) return;
      if (!group.items || group.items.length === 0) return;
      const clusterId = addCategoryCluster(concept.uri, group.kind);
      if (!collapsedCategories.has(clusterId)) {
        group.items.forEach((item) => {
          getOrAddConceptNode(item);
          links.push({ source: clusterId, target: item.uri });
        });
      }
    });

    neighborhoodCache.forEach((cacheValue, originUri) => {
      if (!addedNodes.has(originUri)) return;
      const { nodes: neighborNodes, edges: neighborEdges } = cacheValue;
      const neighborMap = new Map(neighborNodes.map(n => [n.uri, n]));
      const sortedByKind: Record<'broader' | 'narrower' | 'related', string[]> = { broader: [], narrower: [], related: [] };

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
        if (!collapsedCategories.has(clusterId)) {
          targetUris.forEach((targetUri) => {
            const rawItem = neighborMap.get(targetUri);
            if (rawItem) {
              getOrAddConceptNode(rawItem);
              links.push({ source: clusterId, target: targetUri });
            }
          });
        }
      });
    });

    return { nodes, links };
  }, [data, hiddenCategories, searchLanguage, neighborhoodCache, collapsedCategories, t]);

  useEffect(() => {
    if (activeTab !== 'graph' || !fgRef.current || viewportSize.width === 0) return;
    const fg = fgRef.current;
    fg.d3Force('charge')?.strength(-650);
    fg.d3Force('link')?.distance(110);
    fg.d3Force('collide', d3.forceCollide().radius(45).iterations(3));
    const timer = setTimeout(() => {
      try { fgRef.current?.zoomToFit(400, 70, () => true); } catch { void 0; }
    }, 150);
    return () => clearTimeout(timer);
  }, [activeTab, viewportSize.width, viewportSize.height]);

  useEffect(() => {
    if (activeTab !== 'graph' || !fgRef.current) return;
    fgRef.current.d3ReheatSimulation();
  }, [activeTab, graphData]);

  useEffect(() => {
    setTimeout(() => { setCollapsedCategories(new Set()); }, 0);
  }, [decodedUri]);

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

  // ─── Hierarchy tree model ─────────────────────────────────────────────
  const hierarchyTree = useMemo<HierarchyTreeModel>(() => {
    if (!concept) return { parents: [], children: [], related: [] };
    const visibleBroader = expandedGroups.broader ? broaderTerms : EMPTY_CONCEPT_NODES;
    const visibleNarrower = expandedGroups.narrower ? narrowerTerms : EMPTY_CONCEPT_NODES;
    const visibleRelated = expandedGroups.related ? relatedTerms : EMPTY_CONCEPT_NODES;
    return buildHierarchyTree(visibleBroader, visibleNarrower, visibleRelated, searchLanguage);
  }, [concept, expandedGroups.broader, expandedGroups.narrower, expandedGroups.related, broaderTerms, narrowerTerms, relatedTerms, searchLanguage]);

  // centre the selected term once the tree mounts / concept changes
  useEffect(() => {
    if (activeTab !== 'hierarchy') return;
    const id = requestAnimationFrame(() => {
      hierarchyCurrentRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    });
    return () => cancelAnimationFrame(id);
  }, [activeTab, decodedUri, hierarchyTree.parents.length, hierarchyTree.children.length, hierarchyTree.related.length]);

  // ─── Loading / error states ───────────────────────────────────────────
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

              {/* ── GRAPH TAB ── */}
              <TabsContent value="graph" className="graph-tab-content m-0 focus-visible:outline-none focus-visible:ring-0">
                <Card className="graph-card rounded-sm shadow-sm border-[var(--line)] overflow-hidden bg-[var(--surface)]">
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
                                    ctx.shadowColor = isCenter ? P.shadowCenter : P.shadowNode;
                                    ctx.shadowBlur = 12;
                                  }

                                  ctx.fillStyle = isCenter
                                      ? P.teal
                                      : isCluster
                                          ? P.clusterBg
                                          : isHovered
                                              ? P.navyHover
                                              : P.navy;

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

                                  ctx.fillStyle = isCluster ? P.clusterText : P.nodeText;
                                  ctx.textAlign = 'center';
                                  ctx.textBaseline = 'middle';
                                  ctx.fillText(node.name, isCluster ? x + 12 : x, y);

                                  const btnRadius = 9;
                                  if (isCluster) {
                                    const btnX = x - w / 2 + 16;
                                    ctx.beginPath();
                                    ctx.arc(btnX, y, btnRadius, 0, 2 * Math.PI);
                                    ctx.fillStyle = isButtonHovered ? P.clusterBtnHover : P.btnFill;
                                    ctx.fill();
                                    ctx.strokeStyle = isButtonHovered ? P.teal : P.navy;
                                    ctx.lineWidth = 1.5;
                                    ctx.stroke();

                                    ctx.beginPath();
                                    ctx.moveTo(btnX - 3.5, y);
                                    ctx.lineTo(btnX + 3.5, y);
                                    ctx.strokeStyle = P.navy;
                                    ctx.lineWidth = 1.5;
                                    ctx.stroke();

                                    if (collapsedCategories.has(node.id)) {
                                      ctx.beginPath();
                                      ctx.moveTo(btnX, y - 3.5);
                                      ctx.lineTo(btnX, y + 3.5);
                                      ctx.strokeStyle = P.navy;
                                      ctx.lineWidth = 1.5;
                                      ctx.stroke();
                                    }

                                    (node as unknown as HitboxHolder)._plusHitbox = { x: btnX, y, r: btnRadius, isCluster: true };
                                  } else {
                                    const flipLeft = x < 0;
                                    const btnX = flipLeft ? (x - w / 2 - 6) : (x + w / 2 + 6);

                                    ctx.beginPath();
                                    ctx.arc(btnX, y, btnRadius, 0, 2 * Math.PI);
                                    ctx.fillStyle = isButtonHovered ? P.nodeBtnHover : P.btnFill;
                                    ctx.fill();
                                    ctx.strokeStyle = isButtonHovered ? P.teal : (isCenter ? P.teal : P.navy);
                                    ctx.lineWidth = 1.5;
                                    ctx.stroke();

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

                                onNodeClick={(node: GraphNode, event: MouseEvent) => {
                                  const hitbox = (node as unknown as HitboxHolder)._plusHitbox;

                                  if (node.isCluster) {
                                    const clusterId = node.id;
                                    const prefixEnd = clusterId.indexOf(':', 8);
                                    const parentUri = prefixEnd !== -1 ? clusterId.slice(prefixEnd + 1) : '';

                                    setCollapsedCategories((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(clusterId)) next.delete(clusterId);
                                      else next.add(clusterId);
                                      return next;
                                    });

                                    if (!collapsedCategories.has(clusterId) && parentUri !== concept.uri && !neighborhoodCache.has(parentUri)) {
                                      setTargetNeighborhoodUri(parentUri);
                                    }
                                    return;
                                  }

                                  if (hitbox && fgRef.current) {
                                    const graphCoords = fgRef.current.screen2GraphCoords(event.clientX, event.clientY);
                                    const distance = Math.hypot(graphCoords.x - hitbox.x, graphCoords.y - hitbox.y);

                                    if (distance <= (hitbox.r + 5)) {
                                      if (node.uri === concept.uri) return;
                                      const isCurrentlyExpanded = neighborhoodCache.has(node.uri);
                                      if (isCurrentlyExpanded) {
                                        setNeighborhoodCache((prev) => {
                                          const updated = new Map(prev);
                                          updated.delete(node.uri);
                                          return pruneOrphanedCache(updated, concept.uri);
                                        });
                                      } else {
                                        setTargetNeighborhoodUri(node.uri);
                                      }
                                      return;
                                    }
                                  }

                                  if (node.uri === concept.uri) return;

                                  if (fgRef.current && node.x !== undefined && node.y !== undefined) {
                                    const screenCoords = fgRef.current.graph2ScreenCoords(node.x, node.y);
                                    setPopoverPos({ x: screenCoords.x, y: screenCoords.y });
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
                                  setTimeout(() => { setHoverNode(node ? node.id : null); }, 0);

                                  if (!node || !(node as unknown as HitboxHolder)._plusHitbox) {
                                    setTimeout(() => { setHoveringButtonOfNode(null); }, 0);
                                    return;
                                  }

                                  const wrapper = graphViewportElement;
                                  if (wrapper && fgRef.current) {
                                    const handleMouseMove = (e: MouseEvent) => {
                                      const graphCoords = fgRef.current!.screen2GraphCoords(e.clientX, e.clientY);
                                      const hitbox = (node as unknown as HitboxHolder)._plusHitbox;
                                      if (hitbox) {
                                        const distance = Math.hypot(graphCoords.x - hitbox.x, graphCoords.y - hitbox.y);
                                        if (distance <= 16) { setHoveringButtonOfNode(node.id || node.uri); return; }
                                      }
                                      setHoveringButtonOfNode(null);
                                    };
                                    wrapper.addEventListener('mousemove', handleMouseMove, { once: true });
                                  }
                                }}

                                onBackgroundClick={() => { setPopoverNode(null); setPopoverPos(null); }}
                                onZoom={() => {
                                  if (popoverNode) { setTimeout(() => { setPopoverNode(null); setPopoverPos(null); }, 0); }
                                }}
                                onNodeDrag={() => {
                                  if (popoverNode) { setTimeout(() => { setPopoverNode(null); setPopoverPos(null); }, 0); }
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
                                        return pruneOrphanedCache(updated, concept.uri);
                                      });
                                    } else {
                                      setTargetNeighborhoodUri(popoverNode.uri);
                                    }
                                    setPopoverNode(null);
                                    setPopoverPos(null);
                                  }}
                              >
                                {neighborhoodCache.has(popoverNode.uri) ? (
                                    <><span>✕</span> {t('collapseConnections', 'Collapse Connections')}</>
                                ) : (
                                    <>{t('expandConnections', 'Expand Connections')}</>
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
                                {t('viewConceptPage', 'View Concept Page')}
                              </button>
                            </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── HIERARCHY TAB ── */}
              <TabsContent value="hierarchy" className="graph-tab-content m-0 focus-visible:outline-none focus-visible:ring-0">
                <Card className="graph-card graph-card--hierarchy rounded-sm shadow-sm border-[var(--line)] overflow-hidden bg-[var(--surface)]">
                  <CardHeader className="graph-card-header bg-[var(--surface-subtle)] border-b border-[var(--line)] p-6">
                    <div className="graph-card-heading flex flex-col gap-2">
                      <CardTitle className="text-xl font-bold text-[var(--ink-strong)] font-heading">{t('hierarchyLayoutTitle', 'Concept Hierarchy')}</CardTitle>
                      <CardDescription className="text-[var(--ink-muted)] text-sm">{t('hierarchyLayoutDesc', 'Browse concept layout hierarchies.')}</CardDescription>
                    </div>
                  </CardHeader>

                  <CardContent className="graph-hierarchy-content p-0 h-[calc(100vh-200px)] relative bg-linear-to-br from-[var(--surface)] via-[var(--surface-subtle)] to-[var(--tint-navy)]">
                    <div className="hierarchy-tree-shell w-full h-full flex flex-col">

                      {/* scrollable indented tree */}
                      <div className="hierarchy-tree-scroll flex-1 w-full overflow-auto pt-6 pb-12 px-6">
                        <div className="hierarchy-tree">

                          {/* BROADER ancestors stacked above current, joined by a spine */}
                          <div className="hierarchy-tree-spine">
                            
                            {/* Inline Broader Toggle */}
                            {broaderCount > 0 && (
                              <div className="hierarchy-tree-spine-row mb-2">
                                <button
                                  type="button"
                                  onClick={() => toggleHierarchyGroup('broader')}
                                  className="flex items-center gap-3 w-full p-2 hover:bg-[var(--surface-muted)] rounded-sm transition-colors text-left group"
                                >
                                  <span className="w-8 h-8 flex items-center justify-center shrink-0 border border-[var(--brand-navy)]/30 bg-[var(--surface)] text-[var(--brand-navy)] group-hover:bg-[var(--tint-navy)] rounded-sm transition-colors font-bold text-lg">
                                    {expandedGroups.broader ? '−' : '+'}
                                  </span>
                                  <span className="font-semibold text-sm text-[var(--ink)] group-hover:text-[var(--brand-navy)]">
                                    {t('broader', 'Broader terms')} <span className="text-[var(--ink-muted)] font-normal">({broaderCount})</span>
                                  </span>
                                </button>
                              </div>
                            )}

                            {expandedGroups.broader && hierarchyTree.parents.map((entry) => (
                                <div key={entry.item.uri} className="hierarchy-tree-spine-row">
                                  <HierarchyTreeNode
                                      kind="broader"
                                      label={getConceptLabel(entry.item, searchLanguage)}
                                      uri={entry.item.uri}
                                      relations={entry.relations}
                                      onClick={handleHierarchyConceptClick}
                                      t={t}
                                  />
                                </div>
                            ))}

                            {/* current / root term */}
                            <div ref={hierarchyCurrentRef} className="hierarchy-tree-spine-row hierarchy-tree-spine-row--current">
                              <HierarchyTreeNode
                                  kind="root"
                                  label={getConceptLabel(concept, searchLanguage)}
                                  uri={concept.uri}
                                  relations={[]}
                                  t={t}
                              />
                            </div>
                          </div>

                          {/* NARROWER as children below */}
                          {narrowerCount > 0 && (
                              <ul className="hierarchy-tree-children">
                                {/* Inline Narrower Toggle */}
                                <li className="hierarchy-tree-child">
                                  <button
                                    type="button"
                                    onClick={() => toggleHierarchyGroup('narrower')}
                                    className="flex items-center gap-3 w-full p-2 hover:bg-[var(--surface-muted)] rounded-sm transition-colors text-left group"
                                  >
                                    <span className="w-8 h-8 flex items-center justify-center shrink-0 border border-[var(--brand-navy)]/30 bg-[var(--surface)] text-[var(--brand-navy)] group-hover:bg-[var(--tint-navy)] rounded-sm transition-colors font-bold text-lg">
                                      {expandedGroups.narrower ? '−' : '+'}
                                    </span>
                                    <span className="font-semibold text-sm text-[var(--ink)] group-hover:text-[var(--brand-navy)]">
                                      {t('narrower', 'Narrower terms')} <span className="text-[var(--ink-muted)] font-normal">({narrowerCount})</span>
                                    </span>
                                  </button>
                                </li>
                                {expandedGroups.narrower && hierarchyTree.children.map((entry) => (
                                    <li key={entry.item.uri} className="hierarchy-tree-child">
                                      <HierarchyTreeNode
                                          kind="narrower"
                                          label={getConceptLabel(entry.item, searchLanguage)}
                                          uri={entry.item.uri}
                                          relations={entry.relations}
                                          onClick={handleHierarchyConceptClick}
                                          t={t}
                                      />
                                    </li>
                                ))}
                              </ul>
                          )}

                          {/* RELATED as children below */}
                          {relatedCount > 0 && (
                              <ul className="hierarchy-tree-children">
                                {/* Inline Related Toggle */}
                                <li className="hierarchy-tree-child hierarchy-tree-child--related">
                                  <button
                                    type="button"
                                    onClick={() => toggleHierarchyGroup('related')}
                                    className="flex items-center gap-3 w-full p-2 hover:bg-[var(--surface-muted)] rounded-sm transition-colors text-left group"
                                  >
                                    <span className="w-8 h-8 flex items-center justify-center shrink-0 border border-[var(--brand-teal)]/40 bg-[var(--surface)] text-[var(--brand-teal-strong)] group-hover:bg-[var(--tint-teal)] rounded-sm transition-colors font-bold text-lg">
                                      {expandedGroups.related ? '−' : '+'}
                                    </span>
                                    <span className="font-semibold text-sm text-[var(--ink)] group-hover:text-[var(--brand-teal-strong)]">
                                      {t('sharedRelated', 'Shared / Related')} <span className="text-[var(--ink-muted)] font-normal">({relatedCount})</span>
                                    </span>
                                  </button>
                                </li>
                                {expandedGroups.related && hierarchyTree.related.map((entry) => (
                                    <li key={entry.item.uri} className="hierarchy-tree-child hierarchy-tree-child--related">
                                      <HierarchyTreeNode
                                          kind={entry.kind}
                                          label={getConceptLabel(entry.item, searchLanguage)}
                                          uri={entry.item.uri}
                                          relations={entry.relations}
                                          onClick={handleHierarchyConceptClick}
                                          t={t}
                                      />
                                    </li>
                                ))}
                              </ul>
                          )}

                          {broaderCount + narrowerCount + relatedCount === 0 ? (
                              <div className="hierarchy-empty-state w-full flex items-center justify-center text-[var(--ink-faint)] py-16">
                                {t('noRelations', 'No related terms to display.')}
                              </div>
                          ) : null}

                        </div>
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
