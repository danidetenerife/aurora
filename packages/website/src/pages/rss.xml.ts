import rss from '@astrojs/rss';
import type { APIContext } from 'astro';

import { getPublishedPosts } from '../lib/blog/queries';

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();

  return rss({
    title: 'Aurora Blog',
    description: 'Aurora - development blog',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/blog/${post.id}/`,
      categories: post.data.tags,
    })),
  });
}
