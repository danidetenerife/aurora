import { z } from 'zod';

import type { PluginManifest } from '@aurora/plugin-sdk';

const PluginIconLinkSchema = z
  .object({ type: z.literal('link'), link: z.string().min(1) })
  .strict();

const PluginIconSchema = PluginIconLinkSchema;

const AuroraSchema = z
  .object({
    displayName: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    categories: z.array(z.string().min(1)).optional(),
    icon: PluginIconSchema.optional(),
    permissions: z.array(z.string().min(1)).optional(),
  })
  .passthrough();

const PackageJsonSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    description: z.string().min(1),
    author: z.string().min(1),
    main: z.string().min(1).optional(),
    aurora: AuroraSchema.optional(),
  })
  .passthrough();

type AuroraType = NonNullable<PluginManifest['aurora']>;

const normalizePermissions = (
  perms: unknown,
  warnings: string[],
): string[] | undefined => {
  if (!Array.isArray(perms)) {
    return undefined;
  }
  const trimmed = perms
    .map((permission) =>
      typeof permission === 'string' ? permission.trim() : '',
    )
    .filter((permission) => permission.length > 0);
  const before = trimmed.length;
  const deduped = Array.from(new Set(trimmed));
  if (deduped.length < before) {
    warnings.push('Duplicate permissions removed.');
  }
  return deduped.sort((first, second) => first.localeCompare(second));
};

const collectUnknownAuroraKeys = (aurora: Record<string, unknown>): string[] =>
  Object.keys(aurora).filter(
    (key) =>
      ![
        'displayName',
        'category',
        'categories',
        'icon',
        'permissions',
      ].includes(key),
  );

const normalizeAurora = (
  aurora: z.infer<typeof AuroraSchema> | undefined,
  warnings: string[],
): AuroraType | undefined => {
  if (!aurora) {
    return undefined;
  }
  const unknown = collectUnknownAuroraKeys(aurora as Record<string, unknown>);
  if (unknown.length > 0) {
    warnings.push(`aurora contains unknown keys: ${unknown.join(', ')}`);
  }
  const permissions = normalizePermissions(aurora.permissions, warnings);
  const category = aurora.category?.trim();
  const categories = aurora.categories ?? (category ? [category] : []);
  return {
    displayName: aurora.displayName?.trim(),
    category,
    categories,
    icon: aurora.icon as AuroraType['icon'],
    permissions,
  };
};

type SafeParseSuccess = {
  success: true;
  data: PluginManifest;
  warnings: string[];
};

type SafeParseFailure = {
  success: false;
  errors: string[];
  warnings: string[];
};

type SafeParseResult = SafeParseSuccess | SafeParseFailure;

export const safeParsePluginManifest = (raw: unknown): SafeParseResult => {
  const warnings: string[] = [];
  const result = PackageJsonSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    return { success: false, errors, warnings };
  }

  const data = result.data;

  if (!data.main) {
    warnings.push(
      'package.json missing "main"; will attempt fallback resolution (index.js/ts or dist variants).',
    );
  }

  const auroraMetadata = normalizeAurora(data.aurora, warnings);

  const manifest: PluginManifest = {
    name: data.name.trim(),
    version: data.version.trim(),
    description: data.description.trim(),
    author: data.author.trim(),
    main: data.main?.trim(),
    aurora: auroraMetadata,
  };

  return { success: true, data: manifest, warnings };
};

export const parsePluginManifest = (raw: unknown): PluginManifest => {
  const res = safeParsePluginManifest(raw);
  if (res.success) {
    return res.data;
  }
  const msg = res.errors.join('; ');
  throw new Error(`Invalid package.json: ${msg}`);
};

export const isPluginManifest = (raw: unknown): raw is PluginManifest =>
  PackageJsonSchema.safeParse(raw).success;
