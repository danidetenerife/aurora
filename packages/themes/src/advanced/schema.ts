import { z } from 'zod';

export const ThemeVersion = z.literal(1);

// Keys correspond to CSS custom properties in global.css without the leading --
// Example: background, primary, radius, font-family, etc.
export const ThemeVars = z
  .record(z.string(), z.string())
  .refine(
    (obj) =>
      Object.entries(obj).every(
        ([key, val]) =>
          /^[a-zA-Z0-9-]+$/.test(key) &&
          !key.startsWith('--') &&
          !/[{};<>]/.test(val),
      ),
    {
      message:
        'Keys must be valid CSS var names without leading -- and values must not contain rule-breaking characters',
    },
  );

export const AdvancedThemeSchema = z.object({
  version: ThemeVersion,
  name: z.string().min(1),
  author: z.string().min(1).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  palette: z.tuple([z.string(), z.string(), z.string(), z.string()]).optional(),
  vars: ThemeVars.optional(),
  dark: ThemeVars.optional(),
});

export type AdvancedTheme = z.infer<typeof AdvancedThemeSchema>;

export const parseAdvancedTheme = (input: unknown): AdvancedTheme =>
  AdvancedThemeSchema.parse(input);

export const MarketplaceThemeSchema = AdvancedThemeSchema.pick({
  name: true,
  author: true,
  description: true,
  tags: true,
  palette: true,
})
  .required({ author: true, description: true, palette: true })
  .extend({
    id: z.string().min(1),
    path: z.string().min(1),
  });

export type MarketplaceTheme = z.infer<typeof MarketplaceThemeSchema>;

export const MarketplaceThemeRegistrySchema = z.object({
  version: z.number(),
  themes: z.array(MarketplaceThemeSchema),
});
