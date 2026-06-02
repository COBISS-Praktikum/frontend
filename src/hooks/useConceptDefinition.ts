import { useEffect, useState } from 'react';

export type ResolvedSource = 'native' | 'translated' | 'generated';

export type ResolvedTextState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; text: string; source: ResolvedSource };

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
      max_tokens: 200,
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

// System prompt used when GENERATING a definition from scratch (definition only).
function definitionSystemPrompt(targetLang: string): string {
  if (targetLang === 'sl') {
    return (
      'Si terminološki asistent za bibliografsko geslovnico COBISS SGC. ' +
      'Odgovarjaš SAMO v slovenščini. ' +
      'Napiši kratko, nevtralno definicijo koncepta (1–2 stavka, največ 10 besed). ' +
      'Brez uvoda, brez navednic, brez dodatnih razlag — samo definicija.'
    );
  }
  return (
    'You are a terminology assistant for the COBISS SGC bibliographic thesaurus. ' +
    'Reply ONLY in English. ' +
    'Write a short, neutral definition of the concept (1–2 sentences, max 10 words). ' +
    'No preamble, no quotes, no extra commentary — definition only.'
  );
}

// System prompt used when TRANSLATING existing Slovenian text (definition or scope note).
function translateSystemPrompt(targetLang: string): string {
  if (targetLang === 'sl') {
    return (
      'Si prevajalski asistent za bibliografsko geslovnico COBISS SGC. ' +
      'Besedilo zvesto prevedi v slovenščino. ' +
      'Brez uvoda, brez navednic — samo prevod.'
    );
  }
  return (
    'You are a translation assistant for the COBISS SGC bibliographic thesaurus. ' +
    'Translate the given Slovenian text faithfully into English. ' +
    'No preamble, no quotes — output the translation only.'
  );
}

interface UseConceptDefinitionOptions {
  lang: string;
  definition?: string | null;
  prefLabelSl?: string | null;
  prefLabelEn?: string | null;
}

/**
 * Resolves the best available DEFINITION for a concept, with Groq as fallback.
 *
 *   lang=sl + definition present  -> use it directly, no API call (source: native)
 *   lang=en + definition present  -> translate the Slovenian text via Groq (translated)
 *   definition absent (any lang)  -> generate a fresh definition via Groq (generated)
 */
export function useConceptDefinition({
  lang,
  definition,
  prefLabelSl,
  prefLabelEn,
}: UseConceptDefinitionOptions): ResolvedTextState {
  const isSl = lang === 'sl';
  const defStr = cleanLabel(definition); // strips the trailing @sl tag
  const labelSl = cleanLabel(prefLabelSl);
  const labelEn = cleanLabel(prefLabelEn);

  const initialState: ResolvedTextState =
    isSl && defStr ? { status: 'ready', text: defStr, source: 'native' } : { status: 'idle' };

  const [state, setState] = useState<ResolvedTextState>(initialState);

  useEffect(() => {
    if (!labelSl && !labelEn) return;

    // sl + native definition: resolve synchronously, no Groq.
    if (isSl && defStr) {
      setTimeout(() => setState({ status: 'ready', text: defStr, source: 'native' }), 0);
      return;
    }

    setTimeout(() => setState({ status: 'loading' }), 0);
    let active = true;

    const system = defStr ? translateSystemPrompt(lang) : definitionSystemPrompt(lang);
    const user = defStr
      ? `Concept: "${labelEn || labelSl}"\nTranslate this Slovenian definition into ${isSl ? 'Slovenian' : 'English'}. Output the translation only:\n\n${defStr}`
      : isSl
        ? `Napiši kratko definicijo za naslednji bibliografski koncept: "${labelSl || labelEn}"`
        : `Write a short definition for the following bibliographic concept: "${labelEn || labelSl}"`;

    callGroq(system, user)
      .then((text) => {
        if (active) setState({ status: 'ready', text, source: defStr ? 'translated' : 'generated' });
      })
      .catch((err) => {
        console.error('[useConceptDefinition] Groq call failed:', err);
        if (active) setState({ status: 'idle' });
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, defStr, labelSl, labelEn, isSl]);

  return state;
}

interface UseConceptScopeNoteOptions {
  lang: string;
  scopeNote?: string | null;
  prefLabelSl?: string | null;
  prefLabelEn?: string | null;
}

/**
 * Resolves the SCOPE NOTE for a concept. Unlike the definition, a scope note is
 * never invented by AI — it is editorial cataloguing guidance, so:
 *
 *   lang=sl + scopeNote present  -> use it directly, no API call (source: native)
 *   lang=en + scopeNote present  -> translate the Slovenian text via Groq (translated)
 *   scopeNote absent (any lang)  -> idle (the overlay renders nothing for it)
 */
export function useConceptScopeNote({
  lang,
  scopeNote,
  prefLabelSl,
  prefLabelEn,
}: UseConceptScopeNoteOptions): ResolvedTextState {
  const isSl = lang === 'sl';
  const noteStr = cleanLabel(scopeNote); // strips the trailing @sl tag
  const labelSl = cleanLabel(prefLabelSl);
  const labelEn = cleanLabel(prefLabelEn);

  const initialState: ResolvedTextState =
    noteStr && isSl ? { status: 'ready', text: noteStr, source: 'native' } : { status: 'idle' };

  const [state, setState] = useState<ResolvedTextState>(initialState);

  useEffect(() => {
    // No scope note for this concept -> show nothing. Never generate one.
    if (!noteStr) {
      setTimeout(() => setState({ status: 'idle' }), 0);
      return;
    }

    // sl: use the DB value directly.
    if (isSl) {
      setTimeout(() => setState({ status: 'ready', text: noteStr, source: 'native' }), 0);
      return;
    }

    // en: translate the Slovenian scope note.
    setTimeout(() => setState({ status: 'loading' }), 0);
    let active = true;

    callGroq(
      translateSystemPrompt(lang),
      `Concept: "${labelEn || labelSl}"\nTranslate this Slovenian scope note into English. Output the translation only:\n\n${noteStr}`,
    )
      .then((text) => {
        if (active) setState({ status: 'ready', text, source: 'translated' });
      })
      .catch((err) => {
        console.error('[useConceptScopeNote] Groq call failed:', err);
        if (active) setState({ status: 'idle' });
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, noteStr, labelSl, labelEn, isSl]);

  return state;
}
