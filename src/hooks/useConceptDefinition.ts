import { useEffect, useRef, useState } from 'react';

type DefinitionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; text: string; source: 'native' | 'translated' | 'generated' };

interface UseConceptDefinitionOptions {
  lang: string;
  definition?: string | null;
  prefLabelSl?: string | null;
  prefLabelEn?: string | null;
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const GROQ_KEY = import.meta.env.VITE_GROQ_KEY as string;

function cleanLabel(label?: string | null): string {
  return (label ?? '').replace(/@\w+$/, '').trim();
}

async function callGroq(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 120,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned empty content');
  return content.trim();
}

function buildSystemPrompt(targetLang: string): string {
  if (targetLang === 'sl') {
    return (
      'Si terminološki asistent za bibliografsko geslovnico COBISS SGC. ' +
      'Odgovarjaš SAMO v slovenščini. ' +
      'Napiši kratko, nevtralno definicijo koncepta (1–2 stavka, največ 40 besed). ' +
      'Brez uvoda, brez navednic, brez dodatnih razlag — samo definicija.'
    );
  }
  return (
    'You are a terminology assistant for the COBISS SGC bibliographic thesaurus. ' +
    'Reply ONLY in English. ' +
    'Write a short, neutral definition of the concept (1–2 sentences, max 40 words). ' +
    'No preamble, no quotes, no extra commentary — definition only.'
  );
}

/**
 * Resolves the best available definition for a concept, with Groq as fallback.
 *
 *   lang=sl + definition present  → use it directly, no API call
 *   lang=en + definition present  → translate the Slovenian text via Groq
 *   definition absent (any lang)  → generate a fresh definition via Groq
 */
export function useConceptDefinition({
  lang,
  definition,
  prefLabelSl,
  prefLabelEn,
}: UseConceptDefinitionOptions): DefinitionState {
  const [state, setState] = useState<DefinitionState>({ status: 'idle' });

  // Primitive stable key — avoids re-firing when Apollo returns new object refs
  // but the actual string values haven't changed.
  const isSl = lang === 'sl';
  const defStr = definition ?? '';
  const labelSlStr = cleanLabel(prefLabelSl);
  const labelEnStr = cleanLabel(prefLabelEn);

  // Track whether the current key has already been resolved so we don't
  // fire duplicate Groq calls when the parent re-renders with the same data.
  const resolvedKeyRef = useRef<string>('');

  useEffect(() => {
    const key = `${lang}||${defStr}||${labelSlStr}||${labelEnStr}`;

    if (resolvedKeyRef.current === key) return;
    resolvedKeyRef.current = key;

    // ── Case 1: Slovenian UI + KB definition exists → no API call needed ──
    if (isSl && defStr) {
      setState({ status: 'ready', text: defStr, source: 'native' });
      return;
    }

    // ── Skip if we have no labels to work with at all (data not loaded yet) ──
    if (!labelSlStr && !labelEnStr) {
      return;
    }

    setState({ status: 'loading' });
    let cancelled = false;

    (async () => {
      try {
        const system = buildSystemPrompt(lang);
        let text: string;
        let source: 'translated' | 'generated';

        if (defStr) {
          // Case 2: English UI + Slovenian definition exists → translate it
          const labelHint = labelEnStr || labelSlStr;
          const prompt =
            `Concept: "${labelHint}"\n` +
            `Translate this Slovenian definition into English. ` +
            `Output the translation only, no preamble:\n\n${defStr}`;
          text = await callGroq(system, prompt);
          source = 'translated';
        } else {
          // Case 3: No definition in the KB → generate one
          const label = isSl ? (labelSlStr || labelEnStr) : (labelEnStr || labelSlStr);
          const prompt = isSl
            ? `Napiši kratko definicijo za naslednji bibliografski koncept: "${label}"`
            : `Write a short definition for the following bibliographic concept: "${label}"`;
          text = await callGroq(system, prompt);
          source = 'generated';
        }

        if (!cancelled) setState({ status: 'ready', text, source });
      } catch (err) {
        if (!cancelled) {
          console.error('[useConceptDefinition] Groq call failed:', err);
          setState({ status: 'idle' });
        }
      }
    })();

    return () => { cancelled = true; };

  // Depend on the primitive strings, not object references
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, defStr, labelSlStr, labelEnStr]);

  return state;
}
