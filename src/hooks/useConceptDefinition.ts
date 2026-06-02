import { useEffect, useState } from 'react';

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
  // Extract stable primitives once so the effect never depends on object identity
  const isSl = lang === 'sl';
  const defStr = definition ?? '';
  const labelSl = cleanLabel(prefLabelSl);
  const labelEn = cleanLabel(prefLabelEn);

  // Derive an initial state synchronously to avoid calling setState inside an effect
  const initialState: DefinitionState = isSl && defStr
    ? { status: 'ready', text: defStr, source: 'native' }
    : { status: 'idle' };

  const [state, setState] = useState<DefinitionState>(initialState);

  useEffect(() => {
    // Nothing to work with yet — GQL data hasn't arrived
    if (!labelSl && !labelEn) return;

    // If we've already resolved a native definition synchronously, skip effect work
    if (initialState.status === 'ready') return;

    // Cases 2 & 3 require Groq; set loading asynchronously so we don't call setState synchronously in the effect
    setTimeout(() => setState({ status: 'loading' }), 0);

    // Use a local variable instead of a ref — the closure captures it cleanly
    let active = true;

    callGroq(
      buildSystemPrompt(lang),
      defStr
        // Case 2: translate the existing Slovenian definition into English
        ? `Concept: "${labelEn || labelSl}"\nTranslate this Slovenian definition into English. Output the translation only, no preamble:\n\n${defStr}`
        // Case 3: generate a definition from scratch
        : isSl
          ? `Napiši kratko definicijo za naslednji bibliografski koncept: "${labelSl || labelEn}"`
          : `Write a short definition for the following bibliographic concept: "${labelEn || labelSl}"`,
    )
      .then((text) => {
        if (active) {
          setState({
            status: 'ready',
            text,
            source: defStr ? 'translated' : 'generated',
          });
        }
      })
      .catch((err) => {
        console.error('[useConceptDefinition] Groq call failed:', err);
        if (active) setState({ status: 'idle' });
      });

    return () => {
      active = false;
    };
  // Depend only on primitives — never on object references
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, defStr, labelSl, labelEn]);

  return state;
}
