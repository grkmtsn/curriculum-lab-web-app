export type NoveltyCheckInput = {
  title: string;
  concept: string;
  recentConcepts: string[];
  threshold: number;
};

export type NoveltyCheckResult =
  | { ok: true; score: number; mostSimilar?: string }
  | { ok: false; score: number; mostSimilar?: string };

export function checkNovelty(input: NoveltyCheckInput): NoveltyCheckResult {
  const { title, concept, recentConcepts, threshold } = input;
  if (!recentConcepts.length) {
    return { ok: true, score: 0 };
  }

  const candidate = `${title} ${concept}`.trim();
  const candidateTokens = tokenize(candidate);

  let maxScore = 0;
  let mostSimilar: string | undefined;

  for (const recent of recentConcepts) {
    const recentTokens = tokenize(recent);
    const score = jaccard(candidateTokens, recentTokens);
    if (score > maxScore) {
      maxScore = score;
      mostSimilar = recent;
    }
  }

  if (maxScore >= threshold) {
    return { ok: false, score: maxScore, mostSimilar };
  }

  return { ok: true, score: maxScore, mostSimilar };
}

function tokenize(input: string): Set<string> {
  const tokens = input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) {
    return 0;
  }

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
