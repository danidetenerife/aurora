let stargazersCount: number | null = null;

try {
  const response = await fetch(
    'https://api.github.com/repos/danidetenerife/aurora',
  );
  if (response.ok) {
    const data = (await response.json()) as { stargazers_count?: unknown };
    if (
      typeof data.stargazers_count === 'number' &&
      data.stargazers_count > 0
    ) {
      stargazersCount = data.stargazers_count;
    }
  }
} catch {
  stargazersCount = null;
}

export const stars: string | null =
  stargazersCount !== null
    ? stargazersCount >= 1000
      ? `${(stargazersCount / 1000).toFixed(1)}k`
      : String(stargazersCount)
    : null;
